// Backup: everything about an event in one file, in the same format as the menu file, so
// restoring is just Settings > Import menu file. Includes cook picks, scale, edited block times,
// errands, and which shopping items are ticked. Pure builder plus a small download helper.

import { sortDishes } from './palette.js';

/**
 * @param event   the event doc ({ name, year, startDate, endDate })
 * @param detail  { meals, dishes, steps } as loaded from Firestore
 * @param shopping the shopping docs (for the have / in-cart ticks)
 */
export function buildBackup(event, detail, shopping = [], now = new Date()) {
  const dishes = sortDishes(detail.dishes).map((d) => ({
    id: d.id,
    meal: d.mealId,
    title: d.title,
    cook: d.cookName || '',
    emoji: d.emoji || '',
    color: d.color || '',
    scale: d.scale ?? 1,
    servings: d.servings || '',
    source: d.source || '',
    ingredients: d.ingredients || [],
    method: d.method || [],
    notes: d.notes || '',
  }));

  const byTime = (a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0);
  const sorted = [...detail.steps].sort(byTime);
  const steps = sorted
    .filter((s) => s.dishId)
    .map((s) => ({
      dish: s.dishId,
      kind: s.kind || '',
      text: s.text,
      startAt: s.startAt,
      durationMin: s.durationMin,
      resource: s.resource || 'none',
    }));
  const errands = sorted
    .filter((s) => !s.dishId)
    .map((s) => ({ text: s.text, startAt: s.startAt, durationMin: s.durationMin }));

  const shoppingState = {};
  shopping.forEach((i) => {
    if (i.have || i.checked) shoppingState[i.id] = { have: !!i.have, checked: !!i.checked };
  });

  return {
    _note: 'Turkey Day Planner backup. Restore with Settings > Import menu file. Keep this file private: it holds recipe text.',
    _backupAt: now.toISOString(),
    event: { name: event.name, year: event.year, startDate: event.startDate, endDate: event.endDate },
    meals: [...detail.meals]
      .sort((a, b) => (a.serveAt < b.serveAt ? -1 : 1))
      .map((m) => ({ id: m.id, name: m.name, serveAt: m.serveAt })),
    dishes,
    steps,
    events_other: errands,
    shoppingState,
  };
}

/** "thanksgiving-2026-backup-2026-11-21-0930.json" */
export function backupFilename(now, year) {
  const p = (n) => String(n).padStart(2, '0');
  return `thanksgiving-${year}-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** Save an object as a .json file on this device. */
export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
