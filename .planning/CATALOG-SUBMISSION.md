# Подача AI Habit Quest в каталоги Telegram Mini Apps

Практический чек-лист и готовые тексты для публикации.

## Готовые ссылки

- **Mini App (Main):** `https://t.me/AI_Habit_Tracking_bot?startapp=open`
- **Бот:** [@AI_Habit_Tracking_bot](https://t.me/AI_Habit_Tracking_bot)
- **Веб (прямой):** https://sample322-ai-habit-quest-0676.twc1.net
- **Политика конфиденциальности:** https://sample322-ai-habit-quest-0676.twc1.net/privacy.html
- **Условия использования:** https://sample322-ai-habit-quest-0676.twc1.net/terms.html
- **Оператор:** Галкин Иван Александрович, самозанятый, ИНН 526223011902, ivan.galkin13@gmail.com

## Тексты

**Название:** AI Habit Quest

**Короткое описание (≤ ~80 симв.):**
> Привычки с AI-планом: цель → план → задачи, серии, лиги, сезоны.

**Полное описание (RU):**
> AI Habit Quest — геймифицированный трекер привычек с AI-планом. Выбираешь
> цель (спорт, учёба, дисциплина или свою) — AI собирает персональный план из
> маленьких ежедневных шагов. Отмечаешь задания, копишь XP, держишь серию.
>
> Внутри: ранги от Новичка до Легенды, 13 ачивок (включая секретные),
> недельные лиги (Бронза → Алмаз), 4-недельные сезоны с наградами для топ-10,
> аватарные рамки и титулы, лидерборд глобальный и по друзьям, 30-дневный
> heatmap по каждой цели.
>
> Premium открывает безлимит целей, 30-дневный план, перегенерацию AI-плана,
> восстановление серии (streak-freeze), Premium AI-микрозадание каждый день и
> приоритетные сезонные награды.

**Полное описание (EN):**
> AI Habit Quest is a gamified habit tracker powered by AI. Pick a goal
> (sport, study, discipline or custom) and the AI assembles a personal plan
> of tiny daily steps. Tick them off, earn XP, keep your streak alive.
>
> Inside: ranks from Novice to Legend, 13 achievements (incl. secret ones),
> weekly leagues (Bronze → Diamond), 4-week seasons with rewards for the
> top 10, avatar frames and titles, global and friends leaderboards, a
> 30-day heatmap per goal.
>
> Premium unlocks unlimited goals, 30-day plans, AI plan regeneration,
> streak freeze, a daily Premium AI bonus task and priority season rewards.

**Категория/теги:** Productivity, Lifestyle, Self-improvement, Habits, Gamification, AI.

## Ассеты (TODO — подготовить)

- [ ] **Иконка** 512×512 PNG (квадрат, без прозрачного фона).
- [ ] **Скриншоты** (3–5), вертикальные, мобильный размер (напр. 1080×1920 или 1284×2778):
  1. Онбординг — выбор цели + готовые шаблоны.
  2. Генерация плана (поэтапная анимация).
  3. «Сегодня» — Hero Ring + бонус AI + цели.
  4. «Прогресс» — ранг-кольцо, сезон, лига, ачивки.
  5. Premium-экран (Crown + benefits).
- [ ] **Демо-GIF/видео** 15–30с (необязательно, но повышает конверсию).

Скриншоты снимай прямо в Telegram (открой Mini App → системный скриншот).

## Куда подавать

1. **Telegram (официально):**
   - В @BotFather → `/mybots` → бот → **Bot Settings → Configure Mini App**.
   - Полный пошаговый гайд: [BOT-FATHER-SETUP.md](BOT-FATHER-SETUP.md).
2. **tApps Center** (https://tapps.center) — крупный каталог. Submit → форма
   с названием/описанием/категориями/ссылкой/скриншотами + Privacy/ToS.
3. **appss.pro** — каталог Telegram Mini Apps. Submit → те же поля.
4. **MiniTelegramApps / @MiniAppsCatalog** — подача через бота.

## Чек-лист перед подачей

- [x] Mini App открывается, авторизация работает.
- [x] Цель создаётся с реальным AI-планом.
- [x] Privacy/ToS открываются и содержат реквизиты.
- [x] Бот в webhook mode (через CF Worker proxy) — стабильный отклик.
- [x] Bot reminders cron — работает (минутный tick).
- [x] Welcome-flow по реферальной ссылке через бота.
- [x] Premium UI обновлён под текущий feature set.
- [x] Шаблоны целей в онбординге.
- [x] First-run туториал (4 шага).
- [ ] Иконка 512² PNG.
- [ ] 3–5 скриншотов.
- [ ] BotFather: Main Mini App URL, описание, аватар, кнопка-меню → [гайд](BOT-FATHER-SETUP.md).
- [ ] (Перед монетизацией) Stars активация — `TELEGRAM_STARS_ENABLED=true`.

## Заметки

- Реферальная ссылка: `https://t.me/AI_Habit_Tracking_bot?start=ref_<КОД>` (код у
  каждого юзера на экране «Сегодня» → «Пригласи друга»). Открывает чат с ботом
  → бот шлёт welcome + кнопку в Mini App с `?startapp=ref_<КОД>`. Реферал-бонусы
  (+3д Premium инвайтеру, +3д gift приглашённому) начисляются при создании
  ПЕРВОЙ цели приглашённым.
- Stars/платежи — после `TELEGRAM_STARS_ENABLED=true` и проверки на тестовом
  аккаунте.
- YooKassa — нужны `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY` + `YOOKASSA_RETURN_URL`,
  затем real `/v3/payments` impl в `yookassa.provider.ts`.
