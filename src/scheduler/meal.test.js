import { describe, it, expect } from 'vitest';
import { describeDelta, planMealMove } from './meal.js';

const meal = { id: 'thu', name: 'Thursday Dinner', serveAt: '2026-11-26T15:00' };
const dishes = [
  { id: 'turkey', mealId: 'thu' },
  { id: 'mash', mealId: 'thu' },
  { id: 'beans', mealId: 'sat' },
];
const steps = [
  { id: 's1', dishId: 'turkey', startAt: '2026-11-23T09:00' },
  { id: 's2', dishId: 'turkey', startAt: '2026-11-26T11:30' },
  { id: 's3', dishId: 'mash', startAt: '2026-11-26T12:30' },
  { id: 's4', dishId: 'beans', startAt: '2026-11-28T14:00' },
  { id: 's5', dishId: '', startAt: '2026-11-24T16:00' },
];

describe('planMealMove', () => {
  it('moves only the steps of this dinner\'s dishes, by the same amount', () => {
    const p = planMealMove(meal, '2026-11-27T17:30', dishes, steps);
    expect(p.delta).toBe(1590); // 1 day and 2 1/2 hours later
    expect(p.dishes.map((d) => d.id)).toEqual(['turkey', 'mash']);
    expect(p.patches).toEqual([
      { id: 's1', startAt: '2026-11-24T11:30' },
      { id: 's2', startAt: '2026-11-27T14:00' },
      { id: 's3', startAt: '2026-11-27T15:00' },
    ]);
  });

  it('leaves the other dinner and errands alone', () => {
    const ids = planMealMove(meal, '2026-11-26T16:00', dishes, steps).patches.map((p) => p.id);
    expect(ids).not.toContain('s4');
    expect(ids).not.toContain('s5');
  });

  it('can move earlier, and a no-op moves nothing by zero', () => {
    expect(planMealMove(meal, '2026-11-26T14:00', dishes, steps).patches[1]).toEqual({ id: 's2', startAt: '2026-11-26T10:30' });
    expect(planMealMove(meal, meal.serveAt, dishes, steps).delta).toBe(0);
  });
});

describe('describeDelta', () => {
  it('says it in days, hours and minutes', () => {
    expect(describeDelta(1560)).toBe('1 day 2 hr later');
    expect(describeDelta(-45)).toBe('45 min earlier');
    expect(describeDelta(2880 + 90)).toBe('2 days 1 hr 30 min later');
    expect(describeDelta(0)).toBe('no change');
  });
});
