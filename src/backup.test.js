import { describe, it, expect } from 'vitest';
import { backupFilename, buildBackup } from './backup.js';
import { toEventDocs, validateImport } from './importer.js';
import { buildKeepText, ingredientLine } from './shopping.js';

const event = {
  name: 'Thanksgiving 2026',
  year: 2026,
  startDate: '2026-11-23',
  endDate: '2026-11-28',
  cooks: ['AJ', 'Lauren', 'Baker', 'Spencer'],
};
const detail = {
  meals: [
    { id: 'sat', name: 'Saturday Dinner', serveAt: '2026-11-28T15:00' },
    { id: 'thu', name: 'Thursday Dinner', serveAt: '2026-11-26T15:00' },
  ],
  dishes: [
    {
      id: 'mash', mealId: 'thu', order: 1, title: 'Mashed Potatoes', cookName: 'AJ', emoji: '🥔', color: 'cream', scale: 2,
      ingredients: [{ name: 'Russet potatoes', qty: 2, unit: 'lb', aisle: 'Produce' }], method: ['Boil.'], notes: 'n',
      myNotes: 'Use the big pot. AJ likes extra butter.',
    },
    { id: 'turkey', mealId: 'thu', order: 0, title: 'Turkey', cookName: 'Spencer', emoji: '🦃', color: 'brown', scale: 1, ingredients: [], method: [] },
  ],
  steps: [
    { id: 'b', dishId: 'mash', kind: 'cook', text: 'Boil', startAt: '2026-11-26T13:10', durationMin: 45, resource: 'stovetop' },
    { id: 'a', dishId: 'mash', kind: 'prep', text: 'Peel', startAt: '2026-11-26T12:30', durationMin: 40, resource: 'hands', done: true },
    { id: 'e', dishId: '', kind: 'event', text: 'Shopping', startAt: '2026-11-24T16:00', durationMin: 90, resource: 'none' },
  ],
};
const shopping = [
  { id: 'russet-potatoes-wt', have: true, checked: false },
  { id: 'salt-vol', have: false, checked: true },
  { id: 'untouched', have: false, checked: false },
];

describe('buildBackup', () => {
  const b = buildBackup(event, detail, shopping, new Date('2026-11-21T15:30:00Z'));

  it('is valid for the importer, so restoring is just Import', () => {
    expect(validateImport(b)).toEqual([]);
  });

  it('keeps cook picks, scale, dish order and meal order', () => {
    expect(b.dishes.map((d) => d.id)).toEqual(['turkey', 'mash']);
    expect(b.dishes[1]).toMatchObject({ cook: 'AJ', scale: 2, meal: 'thu', color: 'cream' });
    expect(b.meals.map((m) => m.id)).toEqual(['thu', 'sat']);
  });

  it('keeps edited block times and errands, in time order', () => {
    expect(b.steps.map((s) => s.text)).toEqual(['Peel', 'Boil']);
    expect(b.steps[0]).toMatchObject({ dish: 'mash', kind: 'prep', startAt: '2026-11-26T12:30', durationMin: 40, done: true });
    expect(b.steps[1].done).toBe(false);
    expect(b.events_other).toEqual([{ text: 'Shopping', startAt: '2026-11-24T16:00', durationMin: 90, done: false }]);
  });

  it('keeps the cook list and done ticks through a restore', () => {
    expect(b.event.cooks).toEqual(['AJ', 'Lauren', 'Baker', 'Spencer']);
    const docs = toEventDocs(b);
    expect(docs.event.cooks).toEqual(['AJ', 'Lauren', 'Baker', 'Spencer']);
    expect(docs.steps.find((s) => s.text === 'Peel').done).toBe(true);
    expect(docs.steps.find((s) => s.text === 'Boil').done).toBe(false);
  });

  it('records only the shopping ticks that are set', () => {
    expect(b.shoppingState).toEqual({
      'russet-potatoes-wt': { have: true, checked: false },
      'salt-vol': { have: false, checked: true },
    });
  });

  it('round-trips through the importer without losing the plan', () => {
    const docs = toEventDocs(b);
    expect(docs.dishes.find((d) => d.id === 'mash')).toMatchObject({
      cookName: 'AJ',
      scale: 2,
      myNotes: 'Use the big pot. AJ likes extra butter.',
    });
    expect(docs.steps).toHaveLength(3);
    expect(docs.steps.find((s) => s.text === 'Shopping')).toMatchObject({ dishId: '', kind: 'event' });
    expect(docs.shopping.map((i) => i.id)).toContain('russet-potatoes-wt');
  });
});

describe('backupFilename', () => {
  it('names the file with the year and a timestamp', () => {
    expect(backupFilename(new Date(2026, 10, 21, 9, 5), 2026)).toBe('thanksgiving-2026-backup-2026-11-21-0905.json');
  });
});

describe('Keep text', () => {
  const items = [
    { id: '1', name: 'Apples', aisle: 'Produce', group: 'Fruit & citrus', qtyText: '2', dishes: [], note: '' },
    { id: '2', name: 'Brussels sprouts', aisle: 'Produce', group: 'Other vegetables', qtyText: '2 lb', dishes: [], note: '', have: true },
    { id: '3', name: 'Salt', aisle: 'Spices', group: 'Salt & pepper', qtyText: 'as needed', dishes: [], note: '' },
  ];
  const text = buildKeepText(items);

  it('leaves out items already at home, has aisle headings, one item per line, no blank lines', () => {
    expect(text.split('\n')).toEqual([
      'PRODUCE',
      '2 Apples',
      'SPICES',
      'Salt (as needed)',
    ]);
    expect(text).not.toMatch(/\n\n/);
  });

  it('formats an ingredient line with the dish scale', () => {
    expect(ingredientLine({ name: 'Garlic', qty: 2, unit: 'clove' }, 1.5)).toEqual({ amount: '3 cloves', name: 'Garlic' });
    expect(ingredientLine({ name: 'Salt', qty: null }, 2)).toEqual({ amount: 'as needed', name: 'Salt' });
  });
});
