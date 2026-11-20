// Pure layout math for the block calendar. No React, no Firestore.

import { parseStamp } from './time.js';

export const SLOT_MIN = 30;
const DAY_END = 24 * 60;

/** Add startMin/endMin (minutes since midnight, end clipped to the day) to a block. */
export function withMinutes(block) {
  const d = parseStamp(block.startAt);
  const startMin = d.getHours() * 60 + d.getMinutes();
  return { ...block, startMin, endMin: Math.min(startMin + Math.max(block.durationMin, 1), DAY_END) };
}

/** Shared time range for every day: 10 AM to 9 PM, widened to the hour around any block. */
export function gridRange(blocks, { defaultStartHour = 10, defaultEndHour = 21 } = {}) {
  let startMin = defaultStartHour * 60;
  let endMin = defaultEndHour * 60;
  for (const b of blocks) {
    startMin = Math.min(startMin, Math.floor(b.startMin / 60) * 60);
    endMin = Math.max(endMin, Math.ceil(b.endMin / 60) * 60);
  }
  return { startMin, endMin };
}

/**
 * Put one day's blocks side by side when they overlap. Blocks that overlap
 * (directly or through a chain) share a cluster; each gets a `lane` and the
 * cluster's `lanes` count, so width = 100% / lanes and left = lane / lanes.
 */
export function layoutLanes(blocks) {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  let laneEnds = [];

  const flush = () => {
    const lanes = laneEnds.length;
    cluster.forEach((b) => out.push({ ...b, lanes }));
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const b of sorted) {
    if (cluster.length && b.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endMin);
    } else {
      laneEnds[lane] = b.endMin;
    }
    cluster.push({ ...b, lane });
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  if (cluster.length) flush();
  return out;
}

/** Minutes since midnight -> "1:30 PM". */
export function slotLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
