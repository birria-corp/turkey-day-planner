import { describe, it, expect } from 'vitest';
import { findConflicts } from './conflicts.js';

const step = (id, startAt, durationMin, resource) => ({ id, startAt, durationMin, resource });

describe('findConflicts', () => {
  it('allows two things in the oven', () => {
    const steps = [
      step('roast', '2026-11-26T11:30', 150, 'oven'),
      step('stuffing', '2026-11-26T13:00', 40, 'oven'),
    ];
    expect(findConflicts(steps)).toEqual([]);
  });

  it('flags a third oven item and names the window and the steps', () => {
    const steps = [
      step('roast', '2026-11-26T11:30', 150, 'oven'),
      step('stuffing', '2026-11-26T13:00', 40, 'oven'),
      step('pie', '2026-11-26T13:30', 35, 'oven'),
    ];
    const c = findConflicts(steps);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ resource: 'oven', from: '2026-11-26T13:30', to: '2026-11-26T13:40', count: 3, capacity: 2 });
    expect(c[0].stepIds.sort()).toEqual(['pie', 'roast', 'stuffing']);
  });

  it('does not count back-to-back steps as an overlap', () => {
    const steps = [
      step('a', '2026-11-26T11:00', 60, 'oven'),
      step('b', '2026-11-26T11:00', 60, 'oven'),
      step('c', '2026-11-26T12:00', 60, 'oven'),
    ];
    expect(findConflicts(steps)).toEqual([]);
  });

  it('checks the smoker (holds 1) and ignores hands and fridge', () => {
    const steps = [
      step('s1', '2026-11-28T10:00', 120, 'smoker'),
      step('s2', '2026-11-28T11:00', 60, 'smoker'),
      step('h1', '2026-11-28T11:00', 60, 'hands'),
      step('h2', '2026-11-28T11:00', 60, 'hands'),
      step('h3', '2026-11-28T11:00', 60, 'hands'),
      step('f1', '2026-11-28T11:00', 600, 'fridge'),
    ];
    const c = findConflicts(steps);
    expect(c).toHaveLength(1);
    expect(c[0].resource).toBe('smoker');
  });

  it('merges a continuing overlap into one conflict', () => {
    const steps = [
      step('a', '2026-11-26T11:00', 120, 'oven'),
      step('b', '2026-11-26T11:00', 120, 'oven'),
      step('c', '2026-11-26T11:30', 30, 'oven'),
      step('d', '2026-11-26T12:00', 30, 'oven'),
    ];
    const c = findConflicts(steps);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ from: '2026-11-26T11:30', to: '2026-11-26T12:30' });
  });
});
