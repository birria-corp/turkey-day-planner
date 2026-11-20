import React, { useMemo, useRef, useState } from 'react';
import { daysInRange } from './scheduler/dates.js';
import { addMinutes, dayKey, fmtTime, parseStamp, stampAt } from './scheduler/time.js';
import { SLOT_MIN, gridRange, layoutDay, slotLabel, withMinutes } from './scheduler/layout.js';
import { laneOf } from './labels.js';

const MIN_DAY_W = 120; // a quiet day
const BAR_H = 28;
const LONG_MIN = 8 * 60;
const SNAP_MIN = 15; // dragging snaps to quarter hours
const DRAG_PX = 5; // pointer must move this far before a click becomes a drag

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

const fmtDayLabel = (key) =>
  parseKey(key).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

/**
 * Sheet-style grid: days across, time down, steps as blocks colored by dish.
 * - Rows are `rowH` pixels per 30 minutes (taller beats wider).
 * - Busy days split into fixed lanes (Prep & Assemble | Stovetop | Oven), each only as wide as its overlap needs.
 * - Long steps (brine, air-dry) run across the days as bars; in a single-day view they are listed instead.
 * - Click a block to open its recipe; cooks and owner can drag it to another time or day (15-minute snap,
 *   Escape cancels) or focus it and use the arrow keys (15 min per press, Shift = 1 hour, Left/Right = 1 day).
 * `side` is rendered right of the last day.
 */
export default function BlockCalendar({
  event,
  meals,
  steps,
  colorOf,
  labelOf,
  textOf,
  dishById,
  rowH = 48,
  onlyDay = null,
  unitW = 96,
  canEdit = false,
  conflictIds = null,
  onOpenDish,
  onMoveStep,
  side,
}) {
  const model = useMemo(() => {
    const dayBlocks = steps.filter((s) => !isLongStep(s));
    const longSteps = steps.filter(isLongStep);

    const stepBlocks = dayBlocks.map((s) => {
      const t = textOf(s);
      return withMinutes({
        id: `s-${s.id}`,
        stepId: s.id,
        kind: 'step',
        laneKey: laneOf(s),
        line1: t.line1,
        line2: t.line2,
        full: t.full,
        startAt: s.startAt,
        durationMin: s.durationMin,
        dishId: s.dishId,
      });
    });
    const serveBlocks = meals.map((m) =>
      withMinutes({
        id: `m-${m.id}`,
        kind: 'serve',
        line1: m.name.toUpperCase(),
        line2: '',
        full: m.name,
        startAt: m.serveAt,
        durationMin: SLOT_MIN,
      }),
    );

    const grouped = {};
    stepBlocks.forEach((b) => {
      const k = dayKey(b.startAt);
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(b);
    });
    const serveByDay = {};
    serveBlocks.forEach((b) => {
      const k = dayKey(b.startAt);
      if (!serveByDay[k]) serveByDay[k] = [];
      serveByDay[k].push(b);
    });

    const keys = new Set([...Object.keys(grouped), ...Object.keys(serveByDay)]);
    daysInRange(parseKey(event.startDate), parseKey(event.endDate)).forEach((d) => keys.add(d.iso));
    longSteps.forEach((s) => {
      keys.add(dayKey(s.startAt));
      keys.add(dayKey(addMinutes(s.startAt, s.durationMin)));
    });
    const allDays = [...keys].sort();
    const days = onlyDay ? allDays.filter((k) => k === onlyDay) : allDays;

    const layouts = Object.fromEntries(days.map((k) => [k, layoutDay(grouped[k] || [])]));
    const widths = days.map((k) => Math.max(MIN_DAY_W, layouts[k].units * unitW));
    const offsets = widths.reduce((acc, w, i) => [...acc, (acc[i] || 0) + w], [0]);

    const range = gridRange([...stepBlocks, ...serveBlocks]);
    const span = range.endMin - range.startMin;
    const frac = (min) => Math.min(1, Math.max(0, (min - range.startMin) / span));
    const px = (stamp) => {
      const i = days.indexOf(dayKey(stamp));
      return offsets[i] + frac(minuteOfDay(stamp)) * widths[i];
    };

    const bars = onlyDay
      ? []
      : longSteps
          .map((s) => {
            const endStamp = addMinutes(s.startAt, s.durationMin);
            return {
              id: `l-${s.id}`,
              dishId: s.dishId,
              label: labelOf(s),
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

    // In the single-day view, long steps that touch the day are listed above the grid.
    const longToday = onlyDay
      ? longSteps.filter((s) => dayKey(s.startAt) <= onlyDay && dayKey(addMinutes(s.startAt, s.durationMin)) >= onlyDay)
      : [];

    // Dishes with action items on each day (a small emoji strip under the day name).
    const dayDishes = {};
    steps.forEach((s) => {
      if (!s.dishId) return;
      const k = dayKey(s.startAt);
      if (!dayDishes[k]) dayDishes[k] = [];
      if (!dayDishes[k].includes(s.dishId)) dayDishes[k].push(s.dishId);
    });

    return { days, layouts, serveByDay, widths, range, bars, laneCount: laneEnds.length, longToday, dayDishes };
  }, [event, meals, steps, labelOf, textOf, onlyDay, unitW]);

  const { days, layouts, serveByDay, widths, range, bars, laneCount, longToday, dayDishes } = model;

  // ---- drag and drop -------------------------------------------------------
  const colRefs = useRef({});
  const latest = useRef({});
  latest.current = { range, rowH, days, onMoveStep, onOpenDish };
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState(null); // { stepId, key, min, durationMin, line1 }

  function startDrag(e, b) {
    if (!canEdit || !b.stepId || e.button !== 0 || e.pointerType === 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const st = { b, x: e.clientX, y: e.clientY, offY: e.clientY - rect.top, active: false, target: null };

    const move = (ev) => {
      if (!st.active) {
        if (Math.hypot(ev.clientX - st.x, ev.clientY - st.y) < DRAG_PX) return;
        st.active = true;
      }
      const { range: r, rowH: h, days: ds } = latest.current;
      let key = null;
      let colRect = null;
      let best = Infinity;
      for (const k of ds) {
        const el = colRefs.current[k];
        if (!el) continue;
        const cr = el.getBoundingClientRect();
        const dist = ev.clientX < cr.left ? cr.left - ev.clientX : ev.clientX > cr.right ? ev.clientX - cr.right : 0;
        if (dist < best) {
          best = dist;
          key = k;
          colRect = cr;
        }
      }
      if (!key) return;
      const raw = r.startMin + ((ev.clientY - st.offY - colRect.top) / h) * SLOT_MIN;
      const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
      const min = Math.max(r.startMin, Math.min(snapped, r.endMin - SNAP_MIN));
      st.target = { key, min };
      setDrag({ stepId: st.b.stepId, key, min, durationMin: st.b.durationMin, line1: st.b.line1 });
    };

    const finish = (commit) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', esc);
      setDrag(null);
      if (!st.active) return;
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (commit && st.target) {
        const stamp = stampAt(st.target.key, st.target.min);
        if (stamp !== st.b.startAt) latest.current.onMoveStep(st.b.stepId, stamp);
      }
    };
    const up = () => finish(true);
    const esc = (ev) => {
      if (ev.key === 'Escape') finish(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', esc);
  }

  function open(b) {
    if (suppressClick.current) return;
    if (b.dishId && onOpenDish) onOpenDish(b.dishId);
  }

  function onKey(e, b) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(b);
      return;
    }
    if (!canEdit || !b.stepId) return;
    const big = e.shiftKey ? 60 : SNAP_MIN;
    const delta = { ArrowUp: -big, ArrowDown: big, ArrowLeft: -1440, ArrowRight: 1440 }[e.key];
    if (delta) {
      e.preventDefault();
      onMoveStep(b.stepId, addMinutes(b.startAt, delta));
    }
  }

  // ---- render --------------------------------------------------------------
  const slots = Math.round((range.endMin - range.startMin) / SLOT_MIN);
  const height = slots * rowH;
  const slotMins = Array.from({ length: slots }, (_, i) => range.startMin + i * SLOT_MIN);
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const topOf = (min) => ((min - range.startMin) / SLOT_MIN) * rowH;

  return (
    <div className="cal-outer" style={{ '--row-h': `${rowH}px` }}>
      {longToday.length > 0 && (
        <div className="long-today">
          <strong>Long tasks touching today:</strong>{' '}
          {longToday.map((s) => (
            <span
              key={s.id}
              className="chip small"
              style={{ background: colorOf(s.dishId).bg, color: colorOf(s.dishId).fg }}
            >
              {labelOf(s)}
            </span>
          ))}
        </div>
      )}

      {bars.length > 0 && (
        <div className="cal-banner-row">
          <div className="cal-gutter banner-label">Long tasks</div>
          <div className="cal-banner" style={{ width: totalWidth, height: laneCount * BAR_H }}>
            {bars.map((b) => {
              const c = colorOf(b.dishId);
              return (
                <button
                  key={b.id}
                  className="bar"
                  title={b.title}
                  onClick={() => b.dishId && onOpenDish && onOpenDish(b.dishId)}
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
                </button>
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
              <div key={min} className="slot-label" style={{ top: i * rowH }}>
                {slotLabel(min)}
              </div>
            ))}
          </div>
        </div>

        {days.map((key, di) => {
          const d = parseKey(key);
          const lay = layouts[key];
          const units = lay.units;
          return (
            <div className="cal-day" key={key} style={{ width: widths[di] }}>
              <div className="cal-head">
                <span>{`${d.getMonth() + 1}/${d.getDate()}`}</span>
                <strong>{d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}</strong>
                <span className="day-dishes">
                  {(dayDishes[key] || []).map((id) => (
                    <span key={id} title={dishById[id] ? dishById[id].title : ''}>
                      {dishById[id] ? dishById[id].emoji : ''}
                    </span>
                  ))}
                </span>
                <span className="lane-labels">
                  {lay.lanes.map((l) => (
                    <span
                      key={l.key}
                      style={{ left: `${(l.start / units) * 100}%`, width: `${(l.units / units) * 100}%` }}
                    >
                      {l.label}
                    </span>
                  ))}
                </span>
              </div>

              <div
                className="cal-col"
                style={{ height }}
                ref={(el) => {
                  colRefs.current[key] = el;
                }}
              >
                {lay.blocks.map((b) => {
                  const color = colorOf(b.dishId);
                  const h = ((b.endMin - b.startMin) / SLOT_MIN) * rowH - 1;
                  const conflict = conflictIds && conflictIds.has(b.stepId);
                  return (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${b.full}, ${fmtTime(b.startAt)} to ${fmtTime(addMinutes(b.startAt, b.durationMin))}${conflict ? ', oven conflict' : ''}`}
                      className={`block step${conflict ? ' conflict' : ''}${drag && drag.stepId === b.stepId ? ' dragging' : ''}${canEdit ? ' movable' : ''}`}
                      title={`${b.full}\n${fmtTime(b.startAt)} to ${fmtTime(addMinutes(b.startAt, b.durationMin))}${conflict ? '\nOven is over capacity here' : ''}`}
                      onPointerDown={(e) => startDrag(e, b)}
                      onClick={() => open(b)}
                      onKeyDown={(e) => onKey(e, b)}
                      style={{
                        top: topOf(b.startMin),
                        height: h,
                        left: `${(b.col / units) * 100}%`,
                        width: `${(b.span / units) * 100}%`,
                        background: color.bg,
                        color: color.fg,
                      }}
                    >
                      <div className="b1">{b.line1}</div>
                      {b.line2 && h >= 36 && <div className="b2">{b.line2}</div>}
                    </div>
                  );
                })}

                {(serveByDay[key] || []).map((b) => (
                  <div
                    key={b.id}
                    className="block serve"
                    title={`${b.full}: ${fmtTime(b.startAt)}`}
                    style={{ top: topOf(b.startMin), height: (b.durationMin / SLOT_MIN) * rowH - 1, left: 0, width: '100%' }}
                  >
                    <div className="b1">{b.line1}</div>
                  </div>
                ))}

                {drag && drag.key === key && (
                  <div
                    className="ghost"
                    style={{ top: topOf(drag.min), height: (drag.durationMin / SLOT_MIN) * rowH - 1 }}
                  >
                    {fmtDayLabel(key)} {fmtTime(stampAt(key, drag.min))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {side && <div className="cal-side">{side}</div>}
      </div>
    </div>
  );
}
