import { describe, it, expect } from 'vitest';
import seed from '../seed/seed-2025.json';
import { shiftSeed, shiftStamp, dayOffsetBetweenYears } from './seed.js';
import { addMinutes, fmtTime, dayKey } from './time.js';

describe('seed shifting', () => {
  it('2025 -> 2026 Thanksgivings are 364 days apart (same weekday)', () => {
    expect(dayOffsetBetweenYears(2025, 2026)).toBe(364);
  });

  it('shiftStamp keeps the time of day', () => {
    expect(shiftStamp('2025-11-27T15:00', 364)).toBe('2026-11-26T15:00');
    expect(shiftStamp('2025-11-25T16:00', 364)).toBe('2026-11-24T16:00');
  });

  it('shifting to the same year changes nothing', () => {
    const same = shiftSeed(seed, 2025);
    expect(same.meals[0].serveAt).toBe('2025-11-27T15:00');
    expect(same.event.startDate).toBe('2025-11-24');
  });

  const s = shiftSeed(seed, 2026);

  it('lands on 2026 dates', () => {
    expect(s.event).toMatchObject({ name: 'Thanksgiving 2026', startDate: '2026-11-23', endDate: '2026-11-28' });
    expect(s.meals.find((m) => m.id === 'thu').serveAt).toBe('2026-11-26T15:00');
    expect(s.meals.find((m) => m.id === 'sat').serveAt).toBe('2026-11-28T15:00');
  });

  it('keeps all content: 2 meals, 12 dishes, 21 steps + shopping', () => {
    expect(s.meals).toHaveLength(2);
    expect(s.dishes).toHaveLength(12);
    expect(s.steps).toHaveLength(22);
  });

  it('puts the shopping trip on Tuesday 4 PM', () => {
    const shop = s.steps.find((x) => x.text === 'Shopping');
    expect(shop.startAt).toBe('2026-11-24T16:00');
    expect(shop.dishId).toBe('');
  });

  it('step ids are unique and stable', () => {
    const ids = s.steps.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('s01');
  });

  it('splits Thursday turkey: oven ends where the rest starts and the rest ends at serve time', () => {
    const oven = s.steps.find((x) => x.text === 'Turkey in oven');
    const rest = s.steps.find((x) => x.text === 'Turkey rests');
    expect(addMinutes(oven.startAt, oven.durationMin)).toBe(rest.startAt);
    expect(addMinutes(rest.startAt, rest.durationMin)).toBe(s.meals.find((m) => m.id === 'thu').serveAt);
  });
});

describe('time helpers', () => {
  it('formats 12-hour times', () => {
    expect(fmtTime('2026-11-26T00:05')).toBe('12:05 AM');
    expect(fmtTime('2026-11-26T12:00')).toBe('12:00 PM');
    expect(fmtTime('2026-11-26T13:30')).toBe('1:30 PM');
  });
  it('addMinutes crosses midnight', () => {
    expect(addMinutes('2026-11-26T23:30', 60)).toBe('2026-11-27T00:30');
    expect(dayKey('2026-11-27T00:30')).toBe('2026-11-27');
  });
});
