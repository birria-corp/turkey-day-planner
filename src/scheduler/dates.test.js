import { describe, it, expect } from 'vitest';
import { thanksgivingDate, eventRange, daysInRange } from './dates.js';

const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe('thanksgivingDate', () => {
  it.each([
    [2025, 27],
    [2026, 26],
    [2027, 25],
    [2028, 23],
    [2029, 22], // November starts on a Thursday
  ])('%i -> Nov %i', (year, day) => {
    const d = thanksgivingDate(year);
    expect(ymd(d)).toEqual([year, 11, day]);
    expect(d.getDay()).toBe(4);
  });
});

describe('eventRange', () => {
  it('2025 runs Mon Nov 24 to Sat Nov 29', () => {
    const { start, end } = eventRange(2025);
    expect(ymd(start)).toEqual([2025, 11, 24]);
    expect(start.getDay()).toBe(1);
    expect(ymd(end)).toEqual([2025, 11, 29]);
    expect(end.getDay()).toBe(6);
  });
});

describe('daysInRange', () => {
  it('labels real weekdays', () => {
    const { start, end } = eventRange(2025);
    const days = daysInRange(start, end);
    expect(days.map((d) => d.weekday)).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ]);
    expect(days[0].iso).toBe('2025-11-24');
  });
});
