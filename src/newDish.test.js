import { describe, it, expect } from 'vitest';
import { buildNewDish, copyTitle } from './newDish.js';

const thu = { id: 'thu', name: 'Thursday Dinner', serveAt: '2026-11-26T16:00' };
const fri = { id: 'sat', name: 'Friday Dinner', serveAt: '2026-11-27T15:00' };
const mashed = { id: 'mashed', mealId: 'thu', title: 'Mashed Potatoes', scale: 2, color: 'cream', cookName: 'AJ', ingredients: [{ name: 'Russet potatoes' }], method: ['Boil'], myNotes: 'x' };
const steps = [
  { id: 's1', dishId: 'mashed', kind: 'prep', text: 'Peel', startAt: '2026-11-26T13:30', durationMin: 40, resource: 'hands', done: true },
];

describe('buildNewDish', () => {
  it('builds a blank dish with no steps', () => {
    const { dish, steps: s } = buildNewDish({ title: 'Rolls', targetMeal: fri, order: 9, source: null });
    expect(dish).toMatchObject({ title: 'Rolls', mealId: 'sat', order: 9, scale: 1, ingredients: [] });
    expect(s).toEqual([]);
  });
  it('copies a dish and moves its steps by the dinner gap', () => {
    const { dish, steps: s } = buildNewDish({
      title: 'Mashed Potatoes (Friday)', targetMeal: fri, order: 9, source: mashed, sourceMeal: thu, sourceSteps: steps,
    });
    expect(dish).toMatchObject({ mealId: 'sat', scale: 2, cookName: 'AJ', myNotes: '' });
    expect(dish.id).toBeUndefined();
    expect(s[0]).toMatchObject({ startAt: '2026-11-27T12:30', done: false, text: 'Peel' });
    expect(s[0].id).toBeUndefined();
    expect(s[0].dishId).toBeUndefined();
  });
  it('names a copy after the day', () => {
    expect(copyTitle(mashed, fri)).toBe('Mashed Potatoes (Friday)');
  });
});
