import React, { useMemo } from 'react';
import { daysInRange } from './scheduler/dates.js';
import { addMinutes, dayKey, fmtTime } from './scheduler/time.js';
import { SLOT_MIN, gridRange, layoutLanes, slotLabel, withMinutes } from './scheduler/layout.js';

const ROW_H = 30; // keep in sync with --row-h in theme.css

const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Sheet-style grid: days across, time down, steps as blocks colored by dish. */
export default function BlockCalendar({ event, meals, steps, colorOf }) {
  const { days, range, byDay } = useMemo(() => {
    const blocks = [
      ...steps.map((s) =>
        withMinutes({
          id: `s-${s.id}`,
          kind: 'step',
          label: s.text,
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
    const dayList = [...keys].sort();
    return {
      days: dayList,
      range: gridRange(blocks),
      byDay: Object.fromEntries(dayList.map((k) => [k, layoutLanes(grouped[k] || [])])),
    };
  }, [event, meals, steps]);

  const slots = Math.round((range.endMin - range.startMin) / SLOT_MIN);
  const height = slots * ROW_H;
  const slotMins = Array.from({ length: slots }, (_, i) => range.startMin + i * SLOT_MIN);

  return (
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
    </div>
  );
}
