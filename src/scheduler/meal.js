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
