// Turns the 2025 seed into an event for any year by moving every timestamp by the
// same whole number of days (the gap between the two Thanksgivings), so weekdays
// and times of day are preserved. Pure function: no Firestore here.

import { thanksgivingDate } from './dates.js';

const pad = (n) => String(n).padStart(2, '0');

/** Move a "YYYY-MM-DDTHH:mm" stamp by whole days, keeping the time of day. */
export function shiftStamp(stamp, dayOffset) {
  const [datePart, timePart] = stamp.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const out = new Date(y, m - 1, d + dayOffset, hh, mm);
  return `${out.getFullYear()}-${pad(out.getMonth() + 1)}-${pad(out.getDate())}T${pad(out.getHours())}:${pad(out.getMinutes())}`;
}

/** Whole days between two years' Thanksgivings. 2025 -> 2026 is 364. */
export function dayOffsetBetweenYears(fromYear, toYear) {
  const ms = thanksgivingDate(toYear) - thanksgivingDate(fromYear);
  return Math.round(ms / 86400000);
}

/**
 * @returns {{ event, meals, dishes, steps }} shaped for Firestore under events/{id}.
 * Ids are stable so the same seed always writes the same documents.
 */
export function shiftSeed(seed, year) {
  const offset = dayOffsetBetweenYears(seed.event.year, year);
  const shiftDate = (d) => shiftStamp(`${d}T00:00`, offset).slice(0, 10);

  const event = {
    name: `Thanksgiving ${year}`,
    year,
    startDate: shiftDate(seed.event.startDate),
    endDate: shiftDate(seed.event.endDate),
  };

  const meals = seed.meals.map((m) => ({
    id: m.id,
    name: m.name,
    serveAt: shiftStamp(m.serveAt, offset),
  }));

  const dishes = seed.dishes.map((d) => ({
    id: d.id,
    mealId: d.meal,
    recipeId: null,
    title: d.title,
    cookName: d.cook,
  }));

  const dishSteps = seed.steps.map((s) => ({
    dishId: s.dish,
    text: s.text,
    startAt: shiftStamp(s.startAt, offset),
    durationMin: s.durationMin,
    resource: s.resource,
    anchor: s.anchor,
  }));

  // Event-level items (the shopping trip) are steps that belong to no dish.
  const otherSteps = (seed.events_other || []).map((s) => ({
    dishId: '',
    text: s.text,
    startAt: shiftStamp(s.startAt, offset),
    durationMin: s.durationMin,
    resource: 'none',
    anchor: 'fixed',
  }));

  const steps = [...dishSteps, ...otherSteps].map((s, i) => ({ id: `s${pad(i + 1)}`, ...s }));

  return { event, meals, dishes, steps };
}
