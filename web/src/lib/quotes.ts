// 30 hand-picked motivational quotes per language. Index = day-of-year mod 30
// so every user sees the same quote on the same day, no API call needed.

interface Quote {
  text: string;
  author?: string;
}

const RU: Quote[] = [
  { text: 'Маленькие шаги каждый день — большой путь за год.' },
  { text: 'Дисциплина побеждает мотивацию.' },
  { text: 'Сегодня — лучший день начать снова.' },
  { text: 'Один процент в день = +37× за год.' },
  { text: 'Не идеально, но регулярно.' },
  { text: 'Действие создаёт мотивацию, не наоборот.' },
  { text: 'Серия из 1 дня лучше, чем планы из 100.' },
  { text: 'Сначала привычка. Результат подтянется.', author: 'James Clear' },
  { text: 'Решение принято — спор закончен.', author: 'Тим Феррис' },
  { text: 'Сделай это плохо. Сделай это быстро. Сделай это снова.' },
  { text: 'Полчаса сейчас > час завтра.' },
  { text: 'Сила не в обещаниях, а в повторах.' },
  { text: 'Ты — то, что делаешь ежедневно.' },
  { text: 'Не сравнивай себя со вчерашним «бы». Сравнивай с сегодняшним «есть».' },
  { text: 'Мозг любит маленькие выигрыши. Дай ему один прямо сейчас.' },
  { text: 'Серия — самый честный показатель характера.' },
  { text: 'Закрой день — начни новую серию.' },
  { text: 'Время уйдёт всё равно. Что после него останется?' },
  { text: 'Привычка — это процент, который копится.' },
  { text: 'Голод по результату убивает результат. Корми процесс.' },
  { text: 'Никто не отметит твои задания за тебя.' },
  { text: 'Самый дорогой шаг — следующий.' },
  { text: 'Streak — это уважение к себе будущему.' },
  { text: 'Лучше неидеально начать, чем идеально откладывать.' },
  { text: 'Каждое «да» себе делает следующее «да» легче.' },
  { text: 'Прогресс — не прямая, но вектор.' },
  { text: 'Не жди вдохновения. Жди себя.' },
  { text: 'Малое регулярное побеждает большое разовое.' },
  { text: 'Сделанное — это сила. Запланированное — это надежда.' },
  { text: 'Привычка — это голосование за себя, кем хочешь стать.', author: 'James Clear' },
];

const EN: Quote[] = [
  { text: 'Small steps every day add up to a long road in a year.' },
  { text: 'Discipline beats motivation.' },
  { text: 'Today is the best day to start over.' },
  { text: '1% per day = +37× in a year.' },
  { text: 'Not perfect — just consistent.' },
  { text: 'Action creates motivation, not the other way around.' },
  { text: 'A 1-day streak beats a 100-day plan.' },
  { text: 'Habits first. Results follow.', author: 'James Clear' },
  { text: 'Decision made — debate over.', author: 'Tim Ferriss' },
  { text: 'Do it badly. Do it fast. Do it again.' },
  { text: 'Half an hour now > one hour tomorrow.' },
  { text: 'Strength lives in reps, not promises.' },
  { text: 'You are what you do every day.' },
  { text: 'Compare today\'s real you to yesterday\'s real you.' },
  { text: 'The brain loves small wins. Give it one right now.' },
  { text: 'Streaks are the most honest character signal.' },
  { text: 'Close today. Start a new streak.' },
  { text: 'Time passes anyway. What will be left after?' },
  { text: 'A habit is a percentage that compounds.' },
  { text: 'Hunger for the result kills the result. Feed the process.' },
  { text: 'No one will tick your tasks for you.' },
  { text: 'The most expensive step is the next one.' },
  { text: 'A streak is respect for your future self.' },
  { text: 'Better start imperfectly than delay perfectly.' },
  { text: 'Every "yes" to yourself makes the next "yes" easier.' },
  { text: 'Progress is a vector, not a straight line.' },
  { text: 'Don\'t wait for inspiration. Wait for yourself.' },
  { text: 'Small + regular beats big + once.' },
  { text: 'Done is power. Planned is hope.' },
  { text: 'A habit is a vote for the person you want to become.', author: 'James Clear' },
];

function dayOfYear(d: Date = new Date()): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = d.getTime() - start;
  return Math.floor(diff / 86_400_000);
}

export function quoteOfDay(lang: 'ru' | 'en', date: Date = new Date()): Quote {
  const arr = lang === 'en' ? EN : RU;
  const idx = dayOfYear(date) % arr.length;
  return arr[idx];
}
