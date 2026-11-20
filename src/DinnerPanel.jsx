import React from 'react';
import { sortDishes } from './palette.js';

/** Far-right column: per meal, every dish with its cook. Cooks and owner can edit cooks. */
export default function DinnerPanel({ meals, dishes, colorOf, canEdit, onCookChange }) {
  const names = [...new Set(dishes.map((d) => d.cookName).filter(Boolean))].sort();
  const orderedMeals = [...meals].sort((a, b) => (a.serveAt < b.serveAt ? -1 : 1));

  return (
    <aside className="dinner">
      <div className="cal-head">
        <strong>DINNER</strong>
        <span className="muted">{canEdit ? 'tap a name to assign' : 'cook / dish'}</span>
      </div>
      <datalist id="cook-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {orderedMeals.map((m) => (
        <div key={m.id}>
          <div className="dinner-meal">{m.name}</div>
          {sortDishes(dishes.filter((d) => d.mealId === m.id)).map((d) => {
            const c = colorOf(d.id);
            return (
              <div className="dinner-row" key={d.id}>
                {canEdit ? (
                  <input
                    className="cook-input"
                    list="cook-names"
                    placeholder="cook"
                    defaultValue={d.cookName || ''}
                    key={`${d.id}:${d.cookName || ''}`}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (d.cookName || '')) onCookChange(d.id, v);
                    }}
                  />
                ) : (
                  <span className="cook">{d.cookName}</span>
                )}
                <span className="chip" style={{ background: c.bg, color: c.fg }}>
                  {d.title}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
