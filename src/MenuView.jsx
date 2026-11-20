import React, { useMemo } from 'react';
import { KIND_MARKER, KIND_NAME, RESOURCE_NAME, fmtDuration, fmtRange, stepKind } from './labels.js';
import { fmtQty, scaleQty } from './shopping.js';
import { sortDishes } from './palette.js';
import { addMinutes, diffMinutes } from './scheduler/time.js';

const PLURAL = { clove: 'cloves', stalk: 'stalks', sprig: 'sprigs', can: 'cans', box: 'boxes', head: 'heads', bunch: 'bunches', handful: 'handfuls', inch: 'inches' };
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const RESOURCES = ['oven', 'stovetop', 'smoker', 'fridge', 'hands', 'none'];

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
    prep: mine.filter((s) => ['prep', 'assemble'].includes(stepKind(s))),
    cook: mine.filter((s) => !['prep', 'assemble'].includes(stepKind(s))),
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
      <BlockLines title="Prep & Assemble" marker={KIND_MARKER.prep} list={b.prep} />
      <BlockLines title="Cook" marker={KIND_MARKER.cook} list={b.cook} />
    </button>
  );
}

/** One editable step: description, start, end and total time. Editing start moves it; editing end changes its length. */
function StepRow({ step, canEdit, onUpdate, onDelete }) {
  const kind = stepKind(step);
  const end = addMinutes(step.startAt, step.durationMin);

  if (!canEdit) {
    return (
      <div className="menu-line">
        <span>
          {KIND_MARKER[kind]} <strong>{KIND_NAME[kind]}</strong>: {step.text}
        </span>
        <span className="muted">
          {fmtRange(step.startAt, step.durationMin)} · {fmtDuration(step.durationMin)}
        </span>
      </div>
    );
  }

  return (
    <div className="step-edit" style={{ borderLeftColor: 'var(--border)' }}>
      <div className="step-edit-top">
        <span className="step-kind">
          {KIND_MARKER[kind]} {KIND_NAME[kind]}
        </span>
        <input
          className="step-text"
          defaultValue={step.text}
          key={`t-${step.text}`}
          aria-label="Description"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== step.text) onUpdate(step.id, { text: v });
          }}
        />
        <select
          value={step.resource || 'none'}
          aria-label="Equipment"
          onChange={(e) => onUpdate(step.id, { resource: e.target.value })}
        >
          {RESOURCES.map((r) => (
            <option key={r} value={r}>
              {RESOURCE_NAME[r]}
            </option>
          ))}
        </select>
        <button className="secondary small" onClick={() => onDelete(step)} aria-label="Remove this step">
          Remove
        </button>
      </div>
      <div className="step-edit-times">
        <label>
          Start
          <input
            type="datetime-local"
            step="900"
            defaultValue={step.startAt}
            key={`s-${step.startAt}`}
            onBlur={(e) => {
              const v = e.target.value;
              if (STAMP.test(v) && v !== step.startAt) onUpdate(step.id, { startAt: v });
            }}
          />
        </label>
        <label>
          End
          <input
            type="datetime-local"
            step="900"
            defaultValue={end}
            key={`e-${end}`}
            onBlur={(e) => {
              const v = e.target.value;
              if (!STAMP.test(v) || v === end) return;
              const minutes = diffMinutes(step.startAt, v);
              if (minutes > 0) onUpdate(step.id, { durationMin: minutes });
            }}
          />
        </label>
        <span className="step-total">
          Total <strong>{fmtDuration(step.durationMin)}</strong>
        </span>
      </div>
    </div>
  );
}

function Detail({ dish, meal, steps, color, canEdit, onScaleChange, onUpdateStep, onAddStep, onDeleteStep, onBack }) {
  const scale = dish.scale ?? 1;
  const b = blocksFor(dish.id, steps);
  const sums = ['prep', 'assemble', 'cook'].map((k) => [
    k,
    b.all.filter((s) => stepKind(s) === k).reduce((t, s) => t + s.durationMin, 0),
  ]);
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
      <p className="muted">
        {sums
          .filter(([, m]) => m > 0)
          .map(([k, m]) => `${KIND_NAME[k]} ${fmtDuration(m)}`)
          .join(' · ') || 'No blocks scheduled yet.'}
      </p>
      {b.all.map((s) => (
        <StepRow key={s.id} step={s} canEdit={canEdit} onUpdate={onUpdateStep} onDelete={onDeleteStep} />
      ))}
      {canEdit && (
        <p>
          <button className="secondary" onClick={() => onAddStep(dish, 'prep')}>
            + Prep
          </button>
          <button className="secondary" onClick={() => onAddStep(dish, 'assemble')}>
            + Assemble
          </button>
          <button className="secondary" onClick={() => onAddStep(dish, 'cook')}>
            + Cook
          </button>
        </p>
      )}

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

/** Menu tab: one card per dish; click a card (or a block on the grid) for the full recipe and its schedule. */
export default function MenuView({
  dishes,
  meals,
  steps,
  colorOf,
  canEdit,
  openId,
  onOpenChange,
  onScaleChange,
  onUpdateStep,
  onAddStep,
  onDeleteStep,
}) {
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
        onUpdateStep={onUpdateStep}
        onAddStep={onAddStep}
        onDeleteStep={onDeleteStep}
        onBack={() => onOpenChange(null)}
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
          onOpen={() => onOpenChange(d.id)}
        />
      ))}
    </div>
  );
}
