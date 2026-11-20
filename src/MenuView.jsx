import React, { useMemo, useState } from 'react';
import { KIND_MARKER, KIND_NAME, fmtDuration, fmtRange, stepKind } from './labels.js';
import { fmtQty, scaleQty } from './shopping.js';
import { sortDishes } from './palette.js';

const PLURAL = { clove: 'cloves', stalk: 'stalks', sprig: 'sprigs', can: 'cans', box: 'boxes', head: 'heads', bunch: 'bunches', handful: 'handfuls', inch: 'inches' };

/** "1 1/2 tsp ground cumin" with the dish's scale applied. */
function ingredientLine(ing, scale) {
  const q = scaleQty(ing, scale);
  if (q == null) return { amount: 'as needed', name: ing.name };
  const unit = ing.unit ? (q > 1 && PLURAL[ing.unit] ? PLURAL[ing.unit] : ing.unit) : '';
  return { amount: `${fmtQty(q)}${unit ? ` ${unit}` : ''}`, name: ing.name };
}

/** One dish's steps, grouped as prep blocks and cook blocks (rest counts with cook). */
function blocksFor(dishId, steps) {
  const mine = steps.filter((s) => s.dishId === dishId).sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  return {
    prep: mine.filter((s) => stepKind(s) === 'prep'),
    cook: mine.filter((s) => stepKind(s) !== 'prep'),
    all: mine,
  };
}

function BlockLines({ title, marker, list }) {
  if (!list.length) return null;
  return (
    <div className="menu-lines">
      <strong>
        {marker} {title}
      </strong>
      {list.map((s) => (
        <div key={s.id} className="menu-line">
          <span>{s.text}</span>
          <span className="muted">
            {fmtRange(s.startAt, s.durationMin)} · {fmtDuration(s.durationMin)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Card({ dish, meal, steps, color, onOpen }) {
  const b = blocksFor(dish.id, steps);
  return (
    <button className="menu-card" style={{ borderTopColor: color.bg }} onClick={onOpen}>
      <div className="menu-card-head">
        <span className="menu-title">
          {dish.emoji} {dish.title}
        </span>
        <span className="chip small" style={{ background: color.bg, color: color.fg }}>
          {dish.cookName || 'unassigned'}
        </span>
      </div>
      <div className="muted menu-meta">
        {meal ? meal.name : ''}
        {dish.scale && dish.scale !== 1 ? ` · x${dish.scale}` : ''}
      </div>
      {b.all.length === 0 && <div className="muted">No blocks scheduled</div>}
      <BlockLines title="Prep" marker={KIND_MARKER.prep} list={b.prep} />
      <BlockLines title="Cook" marker={KIND_MARKER.cook} list={b.cook} />
    </button>
  );
}

function Detail({ dish, meal, steps, color, canEdit, onScaleChange, onBack }) {
  const scale = dish.scale ?? 1;
  const b = blocksFor(dish.id, steps);
  return (
    <div>
      <p>
        <button className="secondary" onClick={onBack}>
          ← All dishes
        </button>
      </p>
      <h2 style={{ borderLeft: `8px solid ${color.bg}`, paddingLeft: 10 }}>
        {dish.emoji} {dish.title}
      </h2>
      <p className="muted">
        {meal ? meal.name : ''} · cook: <strong>{dish.cookName || 'unassigned'}</strong>
        {dish.servings ? ` · ${dish.servings}` : ''}
        {dish.source ? ` · ${dish.source}` : ''}
      </p>
      <p>
        Scale:{' '}
        {canEdit ? (
          <input
            type="number"
            className="scale-input"
            min="0.25"
            step="0.25"
            defaultValue={scale}
            key={scale}
            onBlur={(e) => {
              const v = parseFloat(e.target.value);
              if (v > 0 && v !== scale) onScaleChange(dish.id, v);
            }}
          />
        ) : (
          <strong>x{scale}</strong>
        )}{' '}
        <span className="muted">times the original recipe (amounts below already include it)</span>
      </p>

      <h3>Schedule</h3>
      {b.all.length === 0 && <p className="muted">No blocks scheduled.</p>}
      {b.all.map((s) => (
        <div key={s.id} className="menu-line">
          <span>
            {KIND_MARKER[stepKind(s)]} <strong>{KIND_NAME[stepKind(s)]}</strong>: {s.text}
          </span>
          <span className="muted">
            {fmtRange(s.startAt, s.durationMin)} · {fmtDuration(s.durationMin)}
          </span>
        </div>
      ))}

      <h3>Ingredients</h3>
      {(dish.ingredients || []).length === 0 && <p className="muted">No recipe for this dish.</p>}
      <table className="ing-table">
        <tbody>
          {(dish.ingredients || []).map((ing, i) => {
            const l = ingredientLine(ing, scale);
            return (
              <tr key={i}>
                <td className="ing-amount">{l.amount}</td>
                <td>
                  {l.name}
                  {ing.note && <span className="muted"> ({ing.note})</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(dish.method || []).length > 0 && (
        <>
          <h3>Method</h3>
          <ol className="method">
            {dish.method.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ol>
        </>
      )}

      {dish.notes && (
        <>
          <h3>Notes</h3>
          <p>{dish.notes}</p>
        </>
      )}
    </div>
  );
}

/** Menu tab: one card per dish; click a card for the full recipe. */
export default function MenuView({ dishes, meals, steps, colorOf, canEdit, onScaleChange }) {
  const [openId, setOpenId] = useState(null);
  const mealById = useMemo(() => Object.fromEntries(meals.map((m) => [m.id, m])), [meals]);

  const ordered = useMemo(() => {
    const meal = (d) => (mealById[d.mealId] ? mealById[d.mealId].serveAt : '');
    return [...sortDishes(dishes)].sort((a, b) => (meal(a) < meal(b) ? -1 : meal(a) > meal(b) ? 1 : 0));
  }, [dishes, mealById]);

  const open = dishes.find((d) => d.id === openId);
  if (open) {
    return (
      <Detail
        dish={open}
        meal={mealById[open.mealId]}
        steps={steps}
        color={colorOf(open.id)}
        canEdit={canEdit}
        onScaleChange={onScaleChange}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="menu-grid">
      {ordered.map((d) => (
        <Card
          key={d.id}
          dish={d}
          meal={mealById[d.mealId]}
          steps={steps}
          color={colorOf(d.id)}
          onOpen={() => setOpenId(d.id)}
        />
      ))}
    </div>
  );
}
