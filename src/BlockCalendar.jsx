import React, { useMemo } from 'react';
import { daysInRange } from './scheduler/dates.js';
import { addMinutes, dayKey, fmtTime, parseStamp } from './scheduler/time.js';
import { SLOT_MIN, gridRange, layoutLanes, slotLabel, withMinutes } from './scheduler/layout.js';

const ROW_H = 30; // keep in sync with --row-h in theme.css
const DAY_W = 128; // keep in sync with .cal-day width
const BAR_H = 28;
const LONG_MIN = 8 * 60;

const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const minuteOfDay = (stamp) => {
  const d = parseStamp(stamp);
  return d.getHours() * 60 + d.getMinutes();
};

/** A step is "long" when it runs 8+ hours or past midnight (brine, air-dry). It gets a banner bar. */
export function isLongStep(step) {
  return step.durationMin >= LONG_MIN || dayKey(addMinutes(step.startAt, step.durationMin - 1)) !== dayKey(step.startAt);
}

/**
 * Sheet-style grid: days across, time down, steps as blocks colored by dish.
 * Long steps run across the days as bars above the grid. `side` is rendered to the
 * right of the last day (the dinner column).
 */
export default function BlockCalendar({ event, meals, steps, colorOf, labelOf, side }) {
  const { days, range, byDay, bars, laneCount } = useMemo(() => {
    const dayBlocks = steps.filter((s) => !isLongStep(s));
    const longSteps = steps.filter(isLongStep);

    const blocks = [
      ...dayBlocks.map((s) =>
        withMinutes({
          id: `s-${s.id}`,
          kind: 'step',
          label: labelOf(s),
          startAt: s.startAt,
          durationMin: s.durationMin,
          dishId: s.dishId,
        }),
      ),
      ...meals.map((m) =>
        withMinutes({
          id: `m-${m.id}`,
          kind: 'serve',
          label: m.name.toUpperCase(),
          startAt: m.serveAt,
          durationMin: SLOT_MIN,
        }),
      ),
    ];
    const grouped = {};
    blocks.forEach((b) => {
      const k = dayKey(b.startAt);
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(b);
    });

    const keys = new Set(Object.keys(grouped));
    daysInRange(parseKey(event.startDate), parseKey(event.endDate)).forEach((d) => keys.add(d.iso));
    longSteps.forEach((s) => {
      keys.add(dayKey(s.startAt));
      keys.add(dayKey(addMinutes(s.startAt, s.durationMin)));
    });
    const dayList = [...keys].sort();

    const range = gridRange(blocks);
    const span = range.endMin - range.startMin;
    const frac = (min) => Math.min(1, Math.max(0, (min - range.startMin) / span));

    const bars = longSteps
      .map((s) => {
        const endStamp = addMinutes(s.startAt, s.durationMin);
        return {
          id: `l-${s.id}`,
          label: labelOf(s),
          dishId: s.dishId,
          title: `${labelOf(s)}: ${fmtTime(s.startAt)} to ${fmtTime(endStamp)}`,
          from: dayList.indexOf(dayKey(s.startAt)) + frac(minuteOfDay(s.startAt)),
          to: dayList.indexOf(dayKey(endStamp)) + frac(minuteOfDay(endStamp)),
        };
      })
      .sort((a, b) => a.from - b.from);
    const laneEnds = [];
    bars.forEach((b) => {
      let lane = laneEnds.findIndex((end) => end <= b.from);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(b.to);
      } else {
        laneEnds[lane] = b.to;
      }
      b.lane = lane;
    });

    return {
      days: dayList,
      range,
      byDay: Object.fromEntries(dayList.map((k) => [k, layoutLanes(grouped[k] || [])])),
      bars,
      laneCount: laneEnds.length,
    };
  }, [event, meals, steps, labelOf]);

  const slots = Math.round((range.endMin - range.startMin) / SLOT_MIN);
  const height = slots * ROW_H;
  const slotMins = Array.from({ length: slots }, (_, i) => range.startMin + i * SLOT_MIN);

  return (
    <div className="cal-outer">
      {bars.length > 0 && (
        <div className="cal-banner-row">
          <div className="cal-gutter banner-label">Long tasks</div>
          <div className="cal-banner" style={{ width: days.length * DAY_W, height: laneCount * BAR_H }}>
            {bars.map((b) => {
              const c = colorOf(b.dishId);
              return (
                <div
                  key={b.id}
                  className="bar"
                  title={b.title}
                  style={{
                    left: b.from * DAY_W,
                    width: Math.max(40, (b.to - b.from) * DAY_W),
                    top: b.lane * BAR_H,
                    height: BAR_H - 3,
                    background: c.bg,
                    color: c.fg,
                  }}
                >
                  {b.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="cal">
        <div className="cal-gutter">
          <div className="cal-head" />
          <div className="cal-col" style={{ height }}>
            {slotMins.map((min, i) => (
              <div key={min} className="slot-label" style={{ top: i * ROW_H }}>
                {slotLabel(min)}
              </div>
            ))}
          </div>
        </div>

        {days.map((key) => {
          const d = parseKey(key);
          return (
            <div className="cal-day" key={key}>
              <div className="cal-head">
                <span>{`${d.getMonth() + 1}/${d.getDate()}`}</span>
                <strong>{d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}</strong>
              </div>
              <div className="cal-col" style={{ height }}>
                {byDay[key].map((b) => {
                  const color = b.kind === 'serve' ? null : colorOf(b.dishId);
                  return (
                    <div
                      key={b.id}
                      className={`block ${b.kind}`}
                      title={`${b.label}: ${fmtTime(b.startAt)} to ${fmtTime(addMinutes(b.startAt, b.durationMin))}`}
                      style={{
                        top: ((b.startMin - range.startMin) / SLOT_MIN) * ROW_H,
                        height: ((b.endMin - b.startMin) / SLOT_MIN) * ROW_H - 1,
                        left: `${(b.lane / b.lanes) * 100}%`,
                        width: `${100 / b.lanes}%`,
                        ...(color ? { background: color.bg, color: color.fg } : {}),
                      }}
                    >
                      {b.label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {side && <div className="cal-side">{side}</div>}
      </div>
    </div>
  );
}
