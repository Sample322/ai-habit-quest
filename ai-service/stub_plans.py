"""Deterministic per-category plans used in v1 and as Ollama fallback."""

from __future__ import annotations

RU = {
    "sport": {
        "habits": [
            {"title": "Утренняя разминка", "description": "5 минут лёгких упражнений сразу после подъёма"},
            {"title": "Активность днём", "description": "10–20 минут ходьбы или короткой тренировки"},
            {"title": "Вечерняя растяжка", "description": "Пара минут растяжки перед сном"},
        ],
        "days": [
            ["Разминка 5 минут", "Прогулка 10 минут", "Растяжка 2 минуты"],
            ["Разминка + 10 приседаний", "Прогулка 15 минут", "Растяжка 3 минуты"],
            ["Разминка + 10 отжиманий с колен", "Прогулка 20 минут", "Растяжка 5 минут"],
            ["Полная разминка", "20 приседаний за день", "Дыхательные упражнения 3 минуты"],
            ["Разминка", "15 минут активной ходьбы", "Растяжка спины"],
            ["Тренировка 15 минут", "Прогулка после ужина", "Растяжка перед сном"],
            ["Длинная прогулка 30+ минут", "Дневник самочувствия", "Растяжка всех групп мышц"],
        ],
    },
    "study": {
        "habits": [
            {"title": "Утреннее повторение", "description": "Короткая сессия повторения накануне выученного"},
            {"title": "Новый материал", "description": "Один сфокусированный 25-минутный блок"},
            {"title": "Вечерний разбор", "description": "Заметка о том, что узнал сегодня"},
        ],
        "days": [
            ["Сформулировать главную цель", "Один Pomodoro 25 минут", "3 заметки по итогам дня"],
            ["Повторить вчерашнее (10 минут)", "Один Pomodoro по новой теме", "Записать 1 вопрос"],
            ["Повторение 10 минут", "Два Pomodoro подряд (с перерывом)", "Ответить на вчерашний вопрос"],
            ["Разобрать сложное место", "Pomodoro 25 минут", "Объяснить тему вслух на 2 минуты"],
            ["Тест/упражнение по пройденному", "Pomodoro по новой теме", "Заметка о слабых местах"],
            ["Повторить слабые места", "Длинный блок 45 минут", "Сформулировать план на следующую неделю"],
            ["Итоговое мини-резюме", "Pomodoro по любимой теме", "Подвести недельный итог"],
        ],
    },
    "discipline": {
        "habits": [
            {"title": "Подъём в одно и то же время", "description": "Без откладываний «ещё 5 минут»"},
            {"title": "Один важный шаг", "description": "Самое важное действие — в первый час бодрствования"},
            {"title": "Цифровой перерыв", "description": "20 минут без телефона перед сном"},
        ],
        "days": [
            ["Встать без откладывания", "Сделать главный шаг до завтрака", "20 минут без телефона перед сном"],
            ["Подъём вовремя", "Один Pomodoro по важной задаче", "Дневник: 1 строка про день"],
            ["Подъём вовремя", "Главный шаг до 10 утра", "Без телефона за 30 минут до сна"],
            ["Утренний душ + подъём", "Pomodoro по самой неприятной задаче", "30 минут без соцсетей вечером"],
            ["Подъём вовремя", "Сделать то, что откладываешь", "Прочитать страницу книги перед сном"],
            ["Подъём вовремя", "Помочь кому-то одним маленьким делом", "40 минут без телефона вечером"],
            ["Подъём вовремя", "Подвести итог недели на 5 минут", "Запланировать следующую неделю"],
        ],
    },
    "custom": {
        "habits": [
            {"title": "Минимальный шаг", "description": "Действие на 2 минуты, которое всегда возможно"},
            {"title": "Основная привычка", "description": "Главное действие дня по твоей цели"},
            {"title": "Заметка о прогрессе", "description": "Одна строка вечером — что получилось"},
        ],
        "days": [
            ["Сделать минимальный шаг", "Основное действие по цели", "Заметка о прогрессе"],
            ["Минимальный шаг утром", "Основное действие", "Заметка о трудностях"],
            ["Минимальный шаг", "Основное действие (чуть больше, чем вчера)", "Что улучшить завтра?"],
            ["Минимальный шаг", "Основное действие", "Поделиться прогрессом с другом"],
            ["Минимальный шаг", "Основное действие", "Сравнить с днём 1"],
            ["Минимальный шаг", "Основное действие", "Похвалить себя за конкретный успех"],
            ["Минимальный шаг", "Финальный заход недели", "Планирование следующей недели"],
        ],
    },
}

EN = {
    "sport": {
        "habits": [
            {"title": "Morning warm-up", "description": "5 minutes right after waking"},
            {"title": "Daytime activity", "description": "10-20 minutes walking or short workout"},
            {"title": "Evening stretch", "description": "A couple of minutes before bed"},
        ],
        "days": [
            ["5-min warm-up", "10-min walk", "2-min stretch"],
            ["Warm-up + 10 squats", "15-min walk", "3-min stretch"],
            ["Warm-up + 10 knee push-ups", "20-min walk", "5-min stretch"],
            ["Full warm-up", "20 squats across the day", "3 min breathing"],
            ["Warm-up", "15-min brisk walk", "Back stretch"],
            ["15-min workout", "Walk after dinner", "Pre-sleep stretch"],
            ["30+ min walk", "Wellness journal entry", "Full-body stretch"],
        ],
    },
    "study": {
        "habits": [
            {"title": "Morning review", "description": "Short review of yesterday"},
            {"title": "New material block", "description": "One focused 25-min session"},
            {"title": "Evening recap", "description": "One line about what you learned"},
        ],
        "days": [
            ["Define today's focus", "One 25-min Pomodoro", "3 notes from the day"],
            ["Review yesterday (10 min)", "One Pomodoro on new material", "Write down 1 question"],
            ["10-min review", "Two Pomodoros (with a break)", "Answer yesterday's question"],
            ["Tackle a hard spot", "25-min Pomodoro", "Explain the topic aloud for 2 min"],
            ["Quiz yourself", "Pomodoro on new topic", "Note weak spots"],
            ["Revisit weak spots", "45-min long block", "Plan next week"],
            ["Mini summary", "Pomodoro on a favorite topic", "Weekly recap"],
        ],
    },
    "discipline": {
        "habits": [
            {"title": "Wake at the same time", "description": "No snooze"},
            {"title": "One important step", "description": "The most important action in the first hour"},
            {"title": "Digital wind-down", "description": "20 minutes off the phone before sleep"},
        ],
        "days": [
            ["Wake without snoozing", "Do the main step before breakfast", "20 min off phone before sleep"],
            ["Wake on time", "One Pomodoro on the important task", "Journal: one line about the day"],
            ["Wake on time", "Main step before 10am", "30 min off phone before sleep"],
            ["Shower + wake on time", "Pomodoro on the least pleasant task", "30 min off social media at night"],
            ["Wake on time", "Do the thing you've been postponing", "Read one page before bed"],
            ["Wake on time", "Help someone with one small thing", "40 min off phone at night"],
            ["Wake on time", "5-min weekly recap", "Plan next week"],
        ],
    },
    "custom": {
        "habits": [
            {"title": "Minimum step", "description": "2-minute action that is always possible"},
            {"title": "Main habit", "description": "Your main daily action toward the goal"},
            {"title": "Progress note", "description": "One line in the evening"},
        ],
        "days": [
            ["Do the minimum step", "Main action toward the goal", "Progress note"],
            ["Minimum step in the morning", "Main action", "Note on difficulties"],
            ["Minimum step", "Main action (a notch above yesterday)", "What to improve tomorrow?"],
            ["Minimum step", "Main action", "Share progress with a friend"],
            ["Minimum step", "Main action", "Compare with day 1"],
            ["Minimum step", "Main action", "Praise yourself for one specific win"],
            ["Minimum step", "Final push of the week", "Plan next week"],
        ],
    },
}


def build_stub_plan(category: str, horizon_days: int, language: str) -> dict:
    tpl = (EN if language == "en" else RU)[category]
    horizon = max(1, min(int(horizon_days), 30))
    schedule = []
    for i in range(horizon):
        schedule.append({"day": i + 1, "tasks": tpl["days"][i % len(tpl["days"])][:3]})
    return {"habits": tpl["habits"], "schedule": schedule}
