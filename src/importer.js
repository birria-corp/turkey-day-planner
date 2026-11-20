// Turns a menu file (JSON from Spencer's Desktop) into Firestore documents.
// The recipe text lives in that file only; it is never bundled into the public repo.

import { buildShoppingList } from './shopping.js';

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** List of human-readable problems; empty means the file is usable. */
export function validateImport(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['The file is not a menu file.'];
  const ev = data.event;
  if (!ev || !ev.year || !ev.startDate || !ev.endDate) errors.push('event needs year, startDate and endDate');
  const meals = data.meals || [];
  const dishes = data.dishes || [];
  const steps = data.steps || [];
  if (!meals.length) errors.push('no meals');
  if (!dishes.length) errors.push('no dishes');

  const mealIds = new Set();
  meals.forEach((m) => {
    if (!m.id || !m.name) errors.push('every meal needs an id and a name');
    if (!STAMP.test(m.serveAt || '')) errors.push(`meal ${m.id}: serveAt must look like 2026-11-26T15:00`);
    mealIds.add(m.id);
  });

  const dishIds = new Set();
  dishes.forEach((d) => {
    if (!d.id || !d.title) errors.push('every dish needs an id and a title');
    if (!mealIds.has(d.meal)) errors.push(`dish ${d.id}: unknown meal "${d.meal}"`);
    if (dishIds.has(d.id)) errors.push(`duplicate dish id ${d.id}`);
    dishIds.add(d.id);
  });

  const checkTimes = (s, label) => {
    if (!STAMP.test(s.startAt || '')) errors.push(`${label}: startAt must look like 2026-11-26T15:00`);
    if (!(s.durationMin > 0)) errors.push(`${label}: durationMin must be a positive number`);
  };
  steps.forEach((s, i) => {
    if (!dishIds.has(s.dish)) errors.push(`step ${i + 1}: unknown dish "${s.dish}"`);
    checkTimes(s, `step ${i + 1} (${s.text})`);
  });
  (data.events_other || []).forEach((s, i) => checkTimes(s, `errand ${i + 1} (${s.text})`));
  return errors;
}

/** Drop undefined values (Firestore rejects them). */
const clean = (obj) => JSON.parse(JSON.stringify(obj));

/** @returns {{ event, meals, dishes, steps, shopping }} each doc has an `id`. */
export function toEventDocs(data) {
  const event = {
    name: data.event.name || `Thanksgiving ${data.event.year}`,
    year: data.event.year,
    startDate: data.event.startDate,
    endDate: data.event.endDate,
  };

  const meals = data.meals.map((m) => ({ id: m.id, name: m.name, serveAt: m.serveAt }));

  const dishes = data.dishes.map((d, i) =>
    clean({
      id: d.id,
      order: i,
      mealId: d.meal,
      recipeId: null,
      title: d.title,
      cookName: d.cook || '',
      emoji: d.emoji || '',
      color: d.color || '',
      scale: d.scale ?? 1,
      servings: d.servings || '',
      source: d.source || '',
      ingredients: d.ingredients || [],
      method: d.method || [],
      notes: d.notes || '',
    }),
  );

  const pad = (n) => String(n).padStart(2, '0');
  const dishSteps = (data.steps || []).map((s) => ({
    dishId: s.dish,
    kind: s.kind || '',
    text: s.text,
    startAt: s.startAt,
    durationMin: s.durationMin,
    resource: s.resource || 'none',
    anchor: 'fixed',
  }));
  const errands = (data.events_other || []).map((s) => ({
    dishId: '',
    kind: 'event',
    text: s.text,
    startAt: s.startAt,
    durationMin: s.durationMin,
    resource: 'none',
    anchor: 'fixed',
  }));
  const steps = [...dishSteps, ...errands].map((s, i) => ({ id: `s${pad(i + 1)}`, ...s }));

  const shopping = buildShoppingList(dishes).map(({ family, ...item }) => item);

  return { event, meals, dishes, steps, shopping };
}
