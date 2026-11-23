// Moving a dinner: the meal's serve time and every step of its dishes shift by the same amount.
// Errands (steps with no dish, like the shopping trip) stay where they are. Pure functions.

import { addMinutes, diffMinutes } from './time.js';

/**
 * @returns {{ delta: number, dishes: object[], patches: {id, startAt}[] }}
 *   delta is minutes (negative = earlier); patches are the new start times for the affected steps.
 */
export function planMealMove(meal, newServeAt, dishes, steps) {
  const delta = diffMinutes(meal.serveAt, newServeAt);
  const mine = dishes.filter((d) => d.mealId === meal.id);
  const ids = new Set(mine.map((d) => d.id));
  const patches = steps.filter((s) => ids.has(s.dishId)).map((s) => ({ id: s.id, startAt: addMinutes(s.startAt, delta) }));
  return { delta, dishes: mine, patches };
}

/** 1560 -> "1 day 2 hr later", -45 -> "45 min earlier". */
export function describeDelta(min) {
  if (min === 0) return 'no change';
  const abs = Math.abs(min);
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;
  const parts = [];
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours) parts.push(`${hours} hr`);
  if (mins) parts.push(`${mins} min`);
  return `${parts.join(' ')} ${min > 0 ? 'later' : 'earlier'}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const AUTO_NAME = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) Dinner( \d+)?$/;

/** "Friday Dinner": the weekday of the serve date plus " Dinner". */
export function mealName(meal) {
  const [y, m, d] = meal.serveAt.slice(0, 10).split('-').map(Number);
  return `${DAY_NAMES[new Date(y, m - 1, d).getDay()]} Dinner`;
}

/**
 * Meals with their names kept in step with their dates. A name like "Saturday Dinner" follows the
 * serve day; a custom name is left alone. Two dinners on one day get " 2", " 3" so they stay apart.
 */
export function namedMeals(meals) {
  const seen = {};
  return [...meals]
    .sort((a, b) => (a.serveAt < b.serveAt ? -1 : 1))
    .map((m) => {
      if (!AUTO_NAME.test(m.name || '')) return m;
      const base = mealName(m);
      seen[base] = (seen[base] || 0) + 1;
      return { ...m, name: seen[base] > 1 ? `${base} ${seen[base]}` : base };
    });
}
