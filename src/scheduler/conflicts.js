// Equipment conflicts: moments when more steps use a resource than it can hold.
// Pure function, no React. The oven holds 2 (Spencer's one oven with two racks in use),
// a stovetop 4 burners, the smoker 1. Hands, fridge and rest are not checked.

import { parseStamp, toStamp } from './time.js';

export const CAPACITY = { oven: 2, stovetop: 4, smoker: 1 };

const toMin = (stamp) => parseStamp(stamp).getTime() / 60000;
const toStampFromMin = (min) => toStamp(new Date(min * 60000));

/**
 * @param {{id,startAt,durationMin,resource}[]} steps
 * @returns {{resource, from, to, count, capacity, stepIds}[]} sorted by start time
 */
export function findConflicts(steps, capacity = CAPACITY) {
  const found = [];
  for (const [resource, cap] of Object.entries(capacity)) {
    const items = steps
      .filter((s) => s.resource === resource)
      .map((s) => ({ id: s.id, start: toMin(s.startAt), end: toMin(s.startAt) + s.durationMin }));
    const points = [...new Set(items.flatMap((i) => [i.start, i.end]))].sort((a, b) => a - b);

    let current = null;
    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i];
      const to = points[i + 1];
      const active = items.filter((it) => it.start < to && it.end > from);
      if (active.length > cap) {
        if (current && current.to === from) {
          current.to = to;
          current.count = Math.max(current.count, active.length);
          active.forEach((a) => current.ids.add(a.id));
        } else {
          current = { resource, from, to, count: active.length, capacity: cap, ids: new Set(active.map((a) => a.id)) };
          found.push(current);
        }
      }
    }
  }
  return found
    .sort((a, b) => a.from - b.from)
    .map((c) => ({
      resource: c.resource,
      from: toStampFromMin(c.from),
      to: toStampFromMin(c.to),
      count: c.count,
      capacity: c.capacity,
      stepIds: [...c.ids],
    }));
}
