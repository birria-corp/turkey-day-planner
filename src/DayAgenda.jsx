import React, { useMemo } from 'react';
import { KIND_MARKER, fmtDuration, stepKind } from './labels.js';
import { addMinutes, dayKey, fmtTime } from './scheduler/time.js';

/**
 * Day view side panel: who does what today. One block per cook, then their steps in time order,
 * plus the dishes that have action items today and the serve times.
 */
export default function DayAgenda({ day, steps, dishes, meals, colorOf, onOpenDish, canEdit, onToggleDone }) {
  const { byCook, dishIds, serves } = useMemo(() => {
    const dishById = Object.fromEntries(dishes.map((d) => [d.id, d]));
    const today = steps
      .filter((s) => dayKey(s.startAt) === day)
      .sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0));

    const cooks = new Map();
    today.forEach((s) => {
      const dish = dishById[s.dishId];
      const cook = dish ? dish.cookName || 'Unassigned' : 'Errands';
      if (!cooks.has(cook)) cooks.set(cook, []);
      cooks.get(cook).push({ step: s, dish });
    });

    return {
      byCook: [...cooks.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      dishIds: [...new Set(today.filter((s) => s.dishId).map((s) => s.dishId))].map((id) => dishById[id]).filter(Boolean),
      serves: meals.filter((m) => dayKey(m.serveAt) === day),
    };
  }, [day, steps, dishes, meals]);

  return (
    <aside className="agenda">
      <h3>Today</h3>
      {serves.map((m) => (
        <p key={m.id} className="agenda-serve">
          <strong>{m.name}</strong> served {fmtTime(m.serveAt)}
        </p>
      ))}

      <h4>Menu items with action items ({dishIds.length})</h4>
      {dishIds.length === 0 && <p className="muted">Nothing to cook or prep today.</p>}
      <p>
        {dishIds.map((d) => {
          const c = colorOf(d.id);
          return (
            <button
              key={d.id}
              className="chip small chip-btn"
              style={{ background: c.bg, color: c.fg }}
              onClick={() => onOpenDish(d.id)}
            >
              {d.emoji} {d.title}
            </button>
          );
        })}
      </p>

      <h4>Who does what</h4>
      {byCook.length === 0 && <p className="muted">No steps today.</p>}
      {byCook.map(([cook, items]) => (
        <div key={cook} className="ag-cook">
          <div className="ag-name">{cook}</div>
          {items.map(({ step, dish }) => {
            const c = dish ? colorOf(dish.id) : colorOf('');
            return (
              <div key={step.id} className={`ag-row${step.done ? ' done' : ''}`} style={{ borderLeftColor: c.bg }}>
                <input
                  type="checkbox"
                  className="ag-check"
                  checked={!!step.done}
                  disabled={!canEdit}
                  onChange={() => onToggleDone(step)}
                  aria-label={`Mark "${step.text}" done`}
                />
                <button className="ag-item" onClick={() => dish && onOpenDish(dish.id)}>
                  <span className="ag-time">
                    {fmtTime(step.startAt)} – {fmtTime(addMinutes(step.startAt, step.durationMin))}
                  </span>
                  <span>
                    {dish ? dish.emoji : ''} {KIND_MARKER[stepKind(step)]} {step.text}
                    {dish && <span className="muted"> · {dish.title}</span>}
                  </span>
                  <span className="muted ag-total">{fmtDuration(step.durationMin)}</span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
