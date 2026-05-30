"""AI Habit Quest plan-generation service.

Provider switch (env AI_PROVIDER):
  - "stub"   : deterministic per-category plans, used as MVP/fallback.
  - "openai" : any OpenAI-compatible Chat Completions endpoint
               (OpenRouter, DeepInfra, Together.ai, vLLM, LiteLLM, etc.).
  - "ollama" : a local Ollama instance (qwen3:4b, gemma3:4b, ...).

All providers must return a plan with the same shape (habits[], schedule[]).
On any provider failure we silently fall back to the stub so the user never
sees a broken onboarding.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from stub_plans import build_stub_plan

logger = logging.getLogger("ai-service")
logging.basicConfig(level=logging.INFO)

AI_PROVIDER = os.getenv("AI_PROVIDER", "stub").lower()

# OpenAI-compatible cloud config (OpenRouter by default, DeepInfra/Together also work)
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
OPENAI_APP_NAME = os.getenv("OPENAI_APP_NAME", "AI Habit Quest")
OPENAI_APP_URL = os.getenv("OPENAI_APP_URL", "https://ai-habit-quest.local")
# OpenRouter load-balances a model across several upstream providers. Some of
# them (e.g. WandB) geo-block the region this service runs in and answer with
# 403 "unsupported_country_region_territory", which silently degrades us to the
# stub — intermittently, depending on which provider OpenRouter picked. Tell
# OpenRouter to never route to those. Comma-separated; extend via env as new
# blockers show up in the logs.
OPENROUTER_IGNORE_PROVIDERS = [
    p.strip() for p in os.getenv("OPENROUTER_IGNORE_PROVIDERS", "wandb").split(",") if p.strip()
]

# Ollama config (local self-hosted)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b")

app = FastAPI(title="AI Habit Quest — plan generator", version="0.2.0")


Category = Literal["sport", "study", "discipline", "custom"]
Language = Literal["ru", "en"]


class PlanRequest(BaseModel):
    category: Category
    goalTitle: str = Field(min_length=1, max_length=200)
    horizonDays: int = Field(ge=1, le=30)
    level: Literal["beginner", "intermediate", "advanced"] | None = "beginner"
    language: Language | None = "ru"


class PlanHabit(BaseModel):
    title: str
    description: str | None = None


class PlanDay(BaseModel):
    day: int
    tasks: list[str]


class PlanResponse(BaseModel):
    provider: Literal["stub", "openai", "ollama"]
    category: Category
    horizonDays: int
    habits: list[PlanHabit]
    schedule: list[PlanDay]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {
        "status": "ok",
        "provider": AI_PROVIDER,
        "openai_base_url": OPENAI_BASE_URL if AI_PROVIDER == "openai" else "",
        "openai_model": OPENAI_MODEL if AI_PROVIDER == "openai" else "",
    }


@app.post("/generate-plan", response_model=PlanResponse)
async def generate_plan(req: PlanRequest) -> PlanResponse:
    logger.info(
        "generate-plan: provider=%s category=%s horizon=%s title=%r",
        AI_PROVIDER, req.category, req.horizonDays, req.goalTitle,
    )
    if AI_PROVIDER == "openai":
        try:
            result = await _generate_with_openai(req)
            logger.info(
                "openai success: %d schedule days for %r",
                len(result.schedule), req.goalTitle,
            )
            return result
        except Exception as exc:  # noqa: BLE001
            logger.warning("OpenAI provider failed, falling back to stub: %s", exc)
    elif AI_PROVIDER == "ollama":
        try:
            return await _generate_with_ollama(req)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Ollama provider failed, falling back to stub: %s", exc)
    return _generate_with_stub(req)


# ----------------------------------------------------------------------------
# Stub provider
# ----------------------------------------------------------------------------

def _generate_with_stub(req: PlanRequest) -> PlanResponse:
    data = build_stub_plan(
        category=req.category,
        horizon_days=req.horizonDays,
        language=req.language or "ru",
    )
    return PlanResponse(
        provider="stub",
        category=req.category,
        horizonDays=req.horizonDays,
        habits=[PlanHabit(**h) for h in data["habits"]],
        schedule=[PlanDay(**d) for d in data["schedule"]],
    )


# ----------------------------------------------------------------------------
# OpenAI-compatible provider (OpenRouter, DeepInfra, ...)
# ----------------------------------------------------------------------------

async def _generate_with_openai(req: PlanRequest) -> PlanResponse:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    prompt = _build_prompt(req)
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
        # OpenRouter recommends sending these for analytics + rate-limit fairness.
        "HTTP-Referer": OPENAI_APP_URL,
        "X-Title": OPENAI_APP_NAME,
    }
    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a habit-coach producing structured daily plans. "
                    "Respond ONLY with strict JSON matching the requested schema. "
                    "No markdown fences, no prose, no commentary."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": 2000,
        "response_format": {"type": "json_object"},
    }
    # OpenRouter-only knob: exclude providers that geo-block our region so we
    # don't intermittently 403 -> stub. Gated by base URL so non-OpenRouter
    # OpenAI-compatible endpoints (which reject unknown fields) stay unaffected.
    if "openrouter.ai" in OPENAI_BASE_URL and OPENROUTER_IGNORE_PROVIDERS:
        payload["provider"] = {"ignore": OPENROUTER_IGNORE_PROVIDERS}

    logger.info(
        "calling openai-compatible: base=%s model=%s key_prefix=%s",
        OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_API_KEY[:8] if OPENAI_API_KEY else "(empty)",
    )
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{OPENAI_BASE_URL}/chat/completions", json=payload, headers=headers)
        if resp.status_code >= 400:
            logger.error(
                "openai HTTP %s body=%s",
                resp.status_code, resp.text[:500],
            )
            raise HTTPException(status_code=502, detail=f"OpenAI API {resp.status_code}: {resp.text[:200]}")
        body = resp.json()

    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI response missing content: {exc}") from exc

    parsed = _parse_plan_json(content)
    return _build_plan_response(req, parsed, provider="openai")


# ----------------------------------------------------------------------------
# Ollama provider (kept for self-hosted GPU deployments)
# ----------------------------------------------------------------------------

async def _generate_with_ollama(req: PlanRequest) -> PlanResponse:
    prompt = _build_prompt(req)
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.4},
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
        resp.raise_for_status()
        body = resp.json()
    parsed = _parse_plan_json(body.get("response", ""))
    return _build_plan_response(req, parsed, provider="ollama")


# ----------------------------------------------------------------------------
# Shared helpers
# ----------------------------------------------------------------------------

def _build_prompt(req: PlanRequest) -> str:
    lang = "Russian" if req.language == "ru" else "English"
    return (
        f"Build a JSON plan for category={req.category}, goalTitle={req.goalTitle!r}, "
        f"level={req.level}, horizonDays={req.horizonDays}.\n"
        f"Output strict JSON with exactly these keys:\n"
        f'  "habits": array of up to 3 objects {{ "title": short string, "description": one-sentence string }}\n'
        f'  "schedule": array of {req.horizonDays} objects, one per day, each with\n'
        f'              {{ "day": 1..{req.horizonDays}, "tasks": array of exactly 3 short imperative strings }}\n'
        f"Each task is a single concrete action the user can do today, max 80 characters.\n"
        f"Day 1 should be very easy (entry barrier). Difficulty progresses gradually.\n"
        f"All text written in {lang}. Do not wrap in markdown. JSON only."
    )


def _parse_plan_json(raw: str) -> dict:
    raw = raw.strip()
    # Some models still wrap output in ``` despite instructions. Strip it.
    if raw.startswith("```"):
        raw = raw.strip("`").lstrip("json").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Model returned non-JSON: {exc}") from exc


def _build_plan_response(req: PlanRequest, parsed: dict, provider: str) -> PlanResponse:
    habits_raw = parsed.get("habits") or []
    schedule_raw = parsed.get("schedule") or []
    if not habits_raw or not schedule_raw:
        raise HTTPException(status_code=502, detail="Plan missing habits or schedule")

    habits = [
        PlanHabit(
            title=str(h.get("title", "Habit"))[:120],
            description=(str(h["description"])[:200] if h.get("description") else None),
        )
        for h in habits_raw[:3]
    ]
    schedule: list[PlanDay] = []
    for i, d in enumerate(schedule_raw[: req.horizonDays]):
        tasks_raw = d.get("tasks") or []
        tasks = [str(t)[:120] for t in tasks_raw][:3]
        # Some models emit fewer than 3 tasks — pad with the last habit to keep the daily loop intact.
        while len(tasks) < 3 and habits:
            tasks.append(habits[-1].title)
        schedule.append(PlanDay(day=int(d.get("day", i + 1)), tasks=tasks))

    return PlanResponse(
        provider=provider,  # type: ignore[arg-type]
        category=req.category,
        horizonDays=req.horizonDays,
        habits=habits,
        schedule=schedule,
    )
