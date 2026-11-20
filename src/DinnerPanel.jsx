import React from 'react';
import { sortDishes } from './palette.js';

// Who can be assigned a dish. Later this can come from the event instead of code.
export const COOK_CHOICES = ['AJ', 'Lauren', 'Baker', 'Spencer', 'Other family'];

/** Far-right column: per meal, every dish with its cook. Cooks and owner can change cooks. */
export default function DinnerPanel({ meals, dishes, colorOf, canEdit, onCookChange }) {
  const orderedMeals = [...meals].sort((a, b) => (a.serveAt < b.serveAt ? -1 : 1));

  return (
    <aside className="dinner">
      <div className="cal-head">
        <strong>DINNER</strong>
        <span className="muted">{canEdit ? 'pick a cook for each dish' : 'cook / dish'}</span>
      </div>

      {orderedMeals.map((m) => (
        <div key={m.id}>
          <div className="dinner-meal">{m.name}</div>
          {sortDishes(dishes.filter((d) => d.mealId === m.id)).map((d) => {
            const c = colorOf(d.id);
            const current = d.cookName || '';
            // Keep any name already saved on the dish selectable, even if not in the list.
            const options = current && !COOK_CHOICES.includes(current) ? [...COOK_CHOICES, current] : COOK_CHOICES;
            return (
              <div className="dinner-row" key={d.id}>
                {canEdit ? (
                  <select
                    className="cook-input"
                    value={current}
                    onChange={(e) => onCookChange(d.id, e.target.value)}
                  >
                    <option value="">(unassigned)</option>
                    {options.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="cook">{current}</span>
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
