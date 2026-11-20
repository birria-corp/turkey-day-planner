import { describe, it, expect } from 'vitest';
import seed from '../seed/seed-2025.json';
import { shiftSeed } from './seed.js';
import { gridRange, layoutDay, layoutLanes, slotLabel, withMinutes } from './layout.js';
import { dayKey, diffMinutes, stampAt } from './time.js';

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

const lb = (id, startAt, durationMin, laneKey) => ({ ...withMinutes({ id, startAt, durationMin }), laneKey });

describe('layoutDay', () => {
  it('keeps a quiet day plain and full width', () => {
    const day = layoutDay([lb('a', '2026-11-27T10:00', 60, 'prep'), lb('b', '2026-11-27T10:30', 60, 'oven')]);
    expect(day.mode).toBe('plain');
    expect(day.units).toBe(2);
    expect(day.blocks.map((b) => [b.col, b.span]).sort()).toEqual([[0, 1], [1, 1]]);
  });

  it('switches a busy day to Prep | Stovetop | Oven lanes', () => {
    const blocks = [
      lb('p1', '2026-11-26T12:00', 60, 'prep'),
      lb('p2', '2026-11-26T12:00', 60, 'prep'),
      lb('s1', '2026-11-26T12:00', 60, 'stove'),
      lb('o1', '2026-11-26T12:00', 60, 'oven'),
      lb('o2', '2026-11-26T12:30', 60, 'oven'),
    ];
    const day = layoutDay(blocks);
    expect(day.mode).toBe('lanes');
    expect(day.lanes.map((l) => [l.key, l.units])).toEqual([['prep', 2], ['stove', 1], ['oven', 2]]);
    expect(day.units).toBe(5);
    const byId = Object.fromEntries(day.blocks.map((b) => [b.id, b]));
    expect(byId.s1.col).toBe(2);
    expect(byId.o1.col).toBeGreaterThanOrEqual(3);
  });

  it('only gives a lane the width its own overlap needs', () => {
    const blocks = [
      lb('p1', '2026-11-26T12:00', 60, 'prep'),
      lb('s1', '2026-11-26T12:00', 60, 'stove'),
      lb('s2', '2026-11-26T12:15', 60, 'stove'),
      lb('o1', '2026-11-26T12:00', 60, 'oven'),
      lb('o2', '2026-11-26T12:30', 60, 'oven'),
      lb('o3', '2026-11-26T12:45', 60, 'oven'),
      lb('p9', '2026-11-26T14:00', 60, 'prep'),
    ];
    const day = layoutDay(blocks, 3);
    expect(day.mode).toBe('lanes');
    const widthOf = (k) => day.lanes.find((l) => l.key === k).units;
    expect(widthOf('prep')).toBe(1);
    expect(widthOf('stove')).toBe(2);
    expect(widthOf('oven')).toBe(3);
  });

  it('omits lanes with nothing in them', () => {
    const blocks = [
      lb('a', '2026-11-26T12:00', 60, 'prep'),
      lb('b', '2026-11-26T12:00', 60, 'prep'),
      lb('c', '2026-11-26T12:00', 60, 'prep'),
      lb('d', '2026-11-26T12:00', 60, 'prep'),
    ];
    expect(layoutDay(blocks).lanes.map((l) => l.key)).toEqual(['prep']);
  });
});

describe('time helpers', () => {
  it('builds stamps and measures minutes', () => {
    expect(stampAt('2026-11-26', 810)).toBe('2026-11-26T13:30');
    expect(stampAt('2026-11-26', 0)).toBe('2026-11-26T00:00');
    expect(diffMinutes('2026-11-26T11:30', '2026-11-26T14:00')).toBe(150);
    expect(diffMinutes('2026-11-26T14:00', '2026-11-26T11:30')).toBe(-150);
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
