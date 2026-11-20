import React, { useMemo } from 'react';
import { daysInRange } from './scheduler/dates.js';
import { addMinutes, dayKey, fmtTime, parseStamp } from './scheduler/time.js';
import { SLOT_MIN, gridRange, layoutLanes, slotLabel, withMinutes } from './scheduler/layout.js';

const ROW_H = 30; // keep in sync with --row-h in theme.css
const MIN_DAY_W = 128; // a quiet day
const LANE_W = 84; // width given to each side-by-side block on a busy day
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
 * Busy days are wider so side-by-side blocks stay readable. Long steps run across the
 * days as bars above the grid. `shortOf` is the text on a block; `labelOf` is the full
 * description (hover text and bars). `side` is rendered right of the last day.
 */
export default function BlockCalendar({ event, meals, steps, colorOf, labelOf, shortOf, side }) {
  const { days, range, byDay, widths, bars, laneCount } = useMemo(() => {
    const dayBlocks = steps.filter((s) => !isLongStep(s));
    const longSteps = steps.filter(isLongStep);

    const blocks = [
      ...dayBlocks.map((s) =>
        withMinutes({
          id: `s-${s.id}`,
          kind: 'step',
          label: shortOf(s),
          full: labelOf(s),
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
          full: m.name,
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

    const byDay = Object.fromEntries(dayList.map((k) => [k, layoutLanes(grouped[k] || [])]));
    const widths = dayList.map((k) => {
      const lanes = Math.max(1, ...byDay[k].map((b) => b.lanes));
      return Math.max(MIN_DAY_W, lanes * LANE_W);
    });
    const offsets = widths.reduce((acc, w, i) => [...acc, (acc[i] || 0) + w], [0]);

    const range = gridRange(blocks);
    const span = range.endMin - range.startMin;
    const frac = (min) => Math.min(1, Math.max(0, (min - range.startMin) / span));
    const px = (stamp) => {
      const i = dayList.indexOf(dayKey(stamp));
      return offsets[i] + frac(minuteOfDay(stamp)) * widths[i];
    };

    const bars = longSteps
      .map((s) => {
        const endStamp = addMinutes(s.startAt, s.durationMin);
        return {
          id: `l-${s.id}`,
          label: labelOf(s),
          dishId: s.dishId,
          title: `${labelOf(s)}: ${fmtTime(s.startAt)} to ${fmtTime(endStamp)}`,
          from: px(s.startAt),
          to: px(endStamp),
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

    return { days: dayList, range, byDay, widths, bars, laneCount: laneEnds.length };
  }, [event, meals, steps, labelOf, shortOf]);

  const slots = Math.round((range.endMin - range.startMin) / SLOT_MIN);
  const height = slots * ROW_H;
  const slotMins = Array.from({ length: slots }, (_, i) => range.startMin + i * SLOT_MIN);
  const totalWidth = widths.reduce((a, b) => a + b, 0);

  return (
    <div className="cal-outer">
      {bars.length > 0 && (
        <div className="cal-banner-row">
          <div className="cal-gutter banner-label">Long tasks</div>
          <div className="cal-banner" style={{ width: totalWidth, height: laneCount * BAR_H }}>
            {bars.map((b) => {
              const c = colorOf(b.dishId);
              return (
                <div
                  key={b.id}
                  className="bar"
                  title={b.title}
                  style={{
                    left: b.from,
                    width: Math.max(40, b.to - b.from),
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

        {days.map((key, di) => {
          const d = parseKey(key);
          return (
            <div className="cal-day" key={key} style={{ width: widths[di] }}>
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
                      title={`${b.full}: ${fmtTime(b.startAt)} to ${fmtTime(addMinutes(b.startAt, b.durationMin))}`}
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
