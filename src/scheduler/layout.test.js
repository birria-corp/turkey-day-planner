import { describe, it, expect } from 'vitest';
import seed from '../seed/seed-2025.json';
import { shiftSeed } from './seed.js';
import { gridRange, layoutLanes, slotLabel, withMinutes } from './layout.js';
import { dayKey } from './time.js';

const blk = (id, startAt, durationMin) => withMinutes({ id, startAt, durationMin });

describe('layoutLanes', () => {
  it('gives a lone block the full width', () => {
    const [b] = layoutLanes([blk('a', '2026-11-26T10:00', 60)]);
    expect(b).toMatchObject({ lane: 0, lanes: 1 });
  });

  it('puts overlapping blocks in separate lanes', () => {
    const out = layoutLanes([blk('a', '2026-11-26T10:00', 60), blk('b', '2026-11-26T10:30', 60)]);
    expect(out.map((b) => b.lane).sort()).toEqual([0, 1]);
    expect(out.every((b) => b.lanes === 2)).toBe(true);
  });

  it('reuses a lane once a block ends and resets between clusters', () => {
    const out = layoutLanes([
      blk('a', '2026-11-26T10:00', 30),
      blk('b', '2026-11-26T10:30', 30),
      blk('c', '2026-11-26T14:00', 30),
    ]);
    expect(out.every((b) => b.lanes === 1 && b.lane === 0)).toBe(true);
  });

  it('Thursday of the sample event needs 3 lanes (turkey, lasagna, stacked dishes)', () => {
    const s = shiftSeed(seed, 2026);
    const thu = s.steps.filter((x) => dayKey(x.startAt) === '2026-11-26').map(withMinutes);
    const out = layoutLanes(thu);
    expect(Math.max(...out.map((b) => b.lanes))).toBe(3);
    // no two blocks in the same lane overlap
    for (const a of out) {
      for (const b of out) {
        if (a.id !== b.id && a.lane === b.lane) {
          expect(a.endMin <= b.startMin || b.endMin <= a.startMin).toBe(true);
        }
      }
    }
  });
});

describe('gridRange', () => {
  it('defaults to 10 AM to 9 PM', () => {
    expect(gridRange([])).toEqual({ startMin: 600, endMin: 1260 });
  });
  it('widens to cover early and late blocks', () => {
    const r = gridRange([blk('a', '2026-11-26T08:15', 60), blk('b', '2026-11-26T21:30', 90)]);
    expect(r).toEqual({ startMin: 480, endMin: 1380 });
  });
});

describe('slotLabel', () => {
  it('formats minutes since midnight', () => {
    expect(slotLabel(600)).toBe('10:00 AM');
    expect(slotLabel(750)).toBe('12:30 PM');
    expect(slotLabel(0)).toBe('12:00 AM');
  });
});
