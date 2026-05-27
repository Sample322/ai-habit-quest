"""AI Habit Quest plan-generation service.

Provider switch (env AI_PROVIDER):
  - "stub"   : deterministic per-category plans, used in v1.
  - "ollama" : calls a local Ollama instance (e.g. qwen3:4b or gemma3:4b).
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
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b")

app = FastAPI(title="AI Habit Quest — plan generator", version="0.1.0")


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
    provider: Literal["stub", "ollama"]
    category: Category
    horizonDays: int
    habits: list[PlanHabit]
    schedule: list[PlanDay]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "provider": AI_PROVIDER}


@app.post("/generate-plan", response_model=PlanResponse)
async def generate_plan(req: PlanRequest) -> PlanResponse:
    if AI_PROVIDER == "ollama":
        try:
            plan = await _generate_with_ollama(req)
            return plan
        except Exception as exc:  # noqa: BLE001 — fall back to stub on any provider failure
            logger.warning("Ollama failed, falling back to stub: %s", exc)
    return _generate_with_stub(req)


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
    raw = body.get("response", "")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Ollama returned non-JSON: {exc}") from exc

    habits = parsed.get("habits") or []
    schedule = parsed.get("schedule") or []
    if not habits or not schedule:
        raise HTTPException(status_code=502, detail="Ollama plan missing habits or schedule")

    return PlanResponse(
        provider="ollama",
        category=req.category,
        horizonDays=req.horizonDays,
        habits=[PlanHabit(title=h.get("title", "Habit"), description=h.get("description")) for h in habits[:3]],
        schedule=[
            PlanDay(day=int(d.get("day", i + 1)), tasks=[str(t) for t in (d.get("tasks") or [])][:3])
            for i, d in enumerate(schedule[: req.horizonDays])
        ],
    )


def _build_prompt(req: PlanRequest) -> str:
    lang = "Russian" if req.language == "ru" else "English"
    return (
        f"You are a habit-coach. Build a JSON plan for category={req.category}, "
        f"goalTitle={req.goalTitle!r}, level={req.level}, horizonDays={req.horizonDays}. "
        f"Output strict JSON with keys: habits (array of {{title, description}}, max 3 items), "
        f"schedule (array of {{day, tasks}} where tasks is an array of at most 3 short imperative strings, "
        f"one per habit, day starts at 1). All text in {lang}. No prose, JSON only."
    )
