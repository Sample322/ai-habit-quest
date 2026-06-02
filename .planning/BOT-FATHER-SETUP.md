# BotFather setup — AI Habit Quest

Пошаговый гайд для @BotFather. Делается один раз, ничего не стоит.

После этих шагов:
- В чатах Telegram реф-ссылка `t.me/AI_Habit_Tracking_bot?start=ref_<code>` показывает превью с твоей иконкой и описанием.
- В чате бота снизу появляется голубая кнопка-меню «Открыть AI Habit Quest».
- Deep-link `t.me/AI_Habit_Tracking_bot?startapp=ref_<code>` открывает Main Mini App с `start_param`.
- Бот листается в поиске по описанию.

---

## 0. Подготовка

Открой [@BotFather](https://t.me/BotFather) в Telegram. Дальше все команды отправляются ему.

Текстовые ассеты:
- **Username бота:** `@AI_Habit_Tracking_bot`
- **URL Mini App:** `https://sample322-ai-habit-quest-0676.twc1.net`
- **Описание короткое (≤120 симв.):** `Привычки с AI-планом — цель, ежедневные задачи, серии, лиги и сезоны.`
- **Описание длинное (≤512 симв.):** см. RU-описание в [CATALOG-SUBMISSION.md](CATALOG-SUBMISSION.md).
- **Аватар бота:** 512×512 PNG (тот же, что для иконки Mini App — TODO).

---

## 1. About + description бота

```
/mybots
→ выбрать @AI_Habit_Tracking_bot
→ Edit Bot
```

### Edit About text
Короткое описание (видно в профиле бота, ≤120 симв.):
```
Привычки с AI-планом — цель, ежедневные задачи, серии, лиги и сезоны.
```

### Edit Description
Длинное описание (≤512 симв.; видно когда чат с ботом ещё не открывался):
```
AI Habit Quest — геймифицированный трекер привычек. Выбираешь цель — AI собирает план из ежедневных шагов. Серии, XP, лиги Бронза→Алмаз, 4-нед сезоны с наградами, рамки и титулы. Premium: безлимит целей, 30-дневный план, восстановление серии, ежедневное Premium AI-задание.
```

### Edit Botpic
Загрузить иконку 512×512 PNG (без прозрачного фона).

---

## 2. Включить Main Mini App

Самое важное — это то, что превращает приложение в «Mini App» с deep-link.

```
/mybots
→ @AI_Habit_Tracking_bot
→ Bot Settings
→ Configure Mini App
```

В появившемся меню:

1. **Enable Mini App** — да.
2. **Mini App URL** — указать:
   ```
   https://sample322-ai-habit-quest-0676.twc1.net
   ```
3. **Mini App description** — короткое описание (то же, что выше).
4. **Mini App photo** — иконка 640×360 (preview в каталоге Telegram).
5. **Mini App animation** — опционально, MP4/GIF 320×320, до 1 MB.

После этого:
- В чате бота снизу появится кнопка-меню «Open Mini App» — переименуй в «Открыть AI Habit Quest» через `Edit Menu Button Text`.
- Deep-links `?startapp=…` и `?startapp=ref_<code>` начнут открывать Mini App с `start_param`.

---

## 3. Menu button (кнопка снизу в чате бота)

```
/setmenubutton
→ @AI_Habit_Tracking_bot
```

BotFather попросит:
1. URL — тот же `https://sample322-ai-habit-quest-0676.twc1.net`.
2. Text — `Открыть AI Habit Quest` (или `🚀 Открыть`).

После этого в чате с ботом слева от поля ввода появится голубая кнопка вместо «/».

---

## 4. Commands (короткий список команд)

```
/setcommands
→ @AI_Habit_Tracking_bot
```

Вставь:
```
start - Открыть приложение
help - Команды
feedback - Отправить отзыв
```

Это даст автокомплит при наборе `/` в чате.

---

## 5. Privacy mode (нужно отключить)

Чтобы бот мог принимать в личке payload deep-link'а:

```
/mybots
→ @AI_Habit_Tracking_bot
→ Bot Settings
→ Group Privacy
→ Turn OFF
```

(В личке бот всегда видит все сообщения; этот свитч важен только если когда-нибудь добавишь бота в группу.)

---

## 6. Inline mode (опционально)

Если позже захочешь, чтобы юзер мог делиться своими целями inline:

```
/setinline
→ @AI_Habit_Tracking_bot
→ написать placeholder, напр. "поделиться целью"
```

Пока не нужно.

---

## 7. Проверка

После всех шагов:

1. **Поиск по описанию.** Введи в Telegram «AI Habit Quest» — должен находиться твой бот с иконкой и описанием.
2. **Deep-link главный.** Открой `https://t.me/AI_Habit_Tracking_bot?startapp=open` — должен открыться Mini App сразу.
3. **Реф-ссылка.** Открой `https://t.me/AI_Habit_Tracking_bot?start=ref_TEST` на тест-аккаунте — должен открыться чат с ботом, бот шлёт welcome-сообщение + кнопку «🚀 Открыть AI Habit Quest», клик по которой открывает Mini App с `start_param=ref_TEST`.
4. **Menu button.** В чате с ботом снизу слева — голубая кнопка-меню.

Если шаг 3 не сработал — проверь, что `Enable Mini App` действительно стоит в `Configure Mini App`. Без этого `?start=` payload в бот доходит, но `?startapp=` deep-link не открывает Mini App.

---

## 8. Что осталось ДО публичной подачи в каталоги

Подавать в tApps Center / appss.pro / etc. имеет смысл только когда:
- [ ] Все 7 шагов выше выполнены.
- [ ] Иконка 512² + 3-5 скринов сняты.
- [ ] Stars активирован и протестирован хотя бы на одном тестовом аккаунте.
- [ ] Privacy/ToS актуальны.

Сама подача — формы на сайтах каталогов. Тексты лежат в `CATALOG-SUBMISSION.md`.
