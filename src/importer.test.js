import { describe, it, expect } from 'vitest';
import { toEventDocs, validateImport } from './importer.js';
import { fmtDuration, fmtRange, shortLabel, stepKind, stepLabel } from './labels.js';

const menu = () => ({
  event: { name: 'Thanksgiving 2026', year: 2026, startDate: '2026-11-23', endDate: '2026-11-28' },
  meals: [{ id: 'thu', name: 'Thursday Dinner', serveAt: '2026-11-26T15:00' }],
  dishes: [
    {
      id: 'mash',
      meal: 'thu',
      title: 'Mashed Potatoes',
      cook: 'AJ',
      emoji: '🥔',
      color: 'cream',
      scale: 2,
      ingredients: [{ name: 'Russet potatoes', qty: 2, unit: 'lb', aisle: 'Produce' }],
      method: ['Boil.', 'Mash.'],
    },
    { id: 'stock', meal: 'thu', title: 'Turkey stock', cook: 'Spencer' },
  ],
  steps: [
    { dish: 'mash', kind: 'prep', text: 'Peel', startAt: '2026-11-26T12:30', durationMin: 40, resource: 'hands' },
    { dish: 'mash', kind: 'cook', text: 'Boil', startAt: '2026-11-26T13:10', durationMin: 45, resource: 'stovetop' },
  ],
  events_other: [{ text: 'Shopping', startAt: '2026-11-24T16:00', durationMin: 90 }],
});

describe('validateImport', () => {
  it('accepts a good menu', () => {
    expect(validateImport(menu())).toEqual([]);
  });
  it('reports bad times, unknown dishes and meals', () => {
    const m = menu();
    m.steps[0].startAt = 'Wed 5pm';
    m.steps[1].dish = 'nope';
    m.dishes[1].meal = 'fri';
    const errors = validateImport(m);
    expect(errors.some((e) => e.includes('startAt'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown dish'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown meal'))).toBe(true);
  });
  it('rejects non-objects', () => {
    expect(validateImport(null)).toHaveLength(1);
  });
});

describe('toEventDocs', () => {
  const docs = toEventDocs(menu());

  it('keeps dish recipes and order', () => {
    expect(docs.dishes[0]).toMatchObject({ id: 'mash', order: 0, mealId: 'thu', cookName: 'AJ', scale: 2, emoji: '🥔' });
    expect(docs.dishes[0].method).toEqual(['Boil.', 'Mash.']);
    expect(docs.dishes[1]).toMatchObject({ order: 1, scale: 1, ingredients: [] });
  });

  it('turns errands into steps with no dish', () => {
    const shop = docs.steps.find((s) => s.text === 'Shopping');
    expect(shop).toMatchObject({ dishId: '', kind: 'event', durationMin: 90 });
    expect(docs.steps.map((s) => s.id)).toEqual(['s01', 's02', 's03']);
  });

  it('builds the shopping list with scale applied', () => {
    expect(docs.shopping).toHaveLength(1);
    expect(docs.shopping[0]).toMatchObject({ name: 'Russet potatoes', qtyText: '4 lb', aisle: 'Produce' });
    expect(docs.shopping[0].family).toBeUndefined();
  });

  it('has no undefined values (Firestore rejects them)', () => {
    expect(JSON.stringify(docs)).not.toContain('undefined');
    expect(() => JSON.parse(JSON.stringify(docs))).not.toThrow();
  });
});

describe('labels', () => {
  it('guesses the kind of older steps from their resource', () => {
    expect(stepKind({ dishId: 'a', resource: 'oven' })).toBe('cook');
    expect(stepKind({ dishId: 'a', resource: 'hands' })).toBe('prep');
    expect(stepKind({ dishId: 'a', resource: 'none' })).toBe('rest');
    expect(stepKind({ dishId: '', resource: 'none' })).toBe('event');
    expect(stepKind({ dishId: 'a', kind: 'cook', resource: 'hands' })).toBe('cook');
  });
  it('builds a label from dish emoji, kind marker and text', () => {
    expect(stepLabel({ dishId: 'a', kind: 'cook', text: 'Roast' }, { emoji: '🦃' })).toBe('🦃 🔥 Roast');
    expect(stepLabel({ dishId: '', text: 'Shopping' }, undefined)).toBe('🛒 Shopping');
  });
  it('builds short grid labels: Prep, Cook with the appliance, Rest', () => {
    const dish = { emoji: '🦃' };
    expect(shortLabel({ dishId: 'a', kind: 'prep', text: 'Pan, truss, preheat', resource: 'hands' }, dish)).toBe('🦃 🔪 Prep');
    expect(shortLabel({ dishId: 'a', kind: 'cook', text: 'Roast', resource: 'oven' }, dish)).toBe('🦃 🔥 Cook · Oven');
    expect(shortLabel({ dishId: 'a', kind: 'cook', text: 'Gravy', resource: 'stovetop' }, dish)).toBe('🦃 🔥 Cook · Stovetop');
    expect(shortLabel({ dishId: 'a', kind: 'cook', text: 'Finish', resource: 'hands' }, dish)).toBe('🦃 🔥 Cook');
    expect(shortLabel({ dishId: 'a', kind: 'rest', text: 'Rest', resource: 'none' }, dish)).toBe('🦃 ⏲️ Rest');
    expect(shortLabel({ dishId: '', kind: 'event', text: 'Shopping' }, undefined)).toBe('🛒 Shopping');
  });
  it('formats durations and ranges', () => {
    expect(fmtDuration(40)).toBe('40 min');
    expect(fmtDuration(150)).toBe('2 hr 30 min');
    expect(fmtDuration(1365)).toBe('22 hr 45 min');
    expect(fmtRange('2026-11-25T17:00', 40)).toBe('Wed, 11/25 5:00 PM – 5:40 PM');
    expect(fmtRange('2026-11-23T09:00', 3030)).toBe('Mon, 11/23 9:00 AM → Wed, 11/25 11:30 AM');
  });
});
