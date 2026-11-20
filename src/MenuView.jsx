import React, { useMemo, useState } from 'react';
import { KIND_MARKER, KIND_NAME, RESOURCE_NAME, fmtDuration, fmtRange, stepKind } from './labels.js';
import { ingredientLine } from './shopping.js';
import { PrintShell, RecipesPrint } from './PrintViews.jsx';
import { sortDishes } from './palette.js';
import { addMinutes, diffMinutes, fmtWhen } from './scheduler/time.js';
import { describeDelta, planMealMove } from './scheduler/meal.js';

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const RESOURCES = ['oven', 'stovetop', 'smoker', 'fridge', 'hands', 'none'];

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
export function StepRow({ step, canEdit, onUpdate, onDelete }) {
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

function Detail({ dish, meal, steps, color, canEdit, onScaleChange, onNotesChange, onUpdateStep, onAddStep, onDeleteStep, onPrint, onBack }) {
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
        <button className="secondary" onClick={onPrint}>
          🖨 Print this recipe
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
          <h3>Recipe notes</h3>
          <p>{dish.notes}</p>
        </>
      )}

      <h3>My notes</h3>
      {canEdit ? (
        <textarea
          className="my-notes"
          rows={5}
          defaultValue={dish.myNotes || ''}
          key={`n-${dish.myNotes || ''}`}
          placeholder="Add your own notes for this recipe: swaps, timing tweaks, what to change next year…"
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (dish.myNotes || '')) onNotesChange(dish.id, v);
          }}
        />
      ) : dish.myNotes ? (
        <p className="notes-text">{dish.myNotes}</p>
      ) : (
        <p className="muted">No notes yet.</p>
      )}
    </div>
  );
}

/** One dinner: its current date and time, and a field to move it (with all its dishes' blocks). */
function DinnerRow({ meal, dishes, steps, canEdit, onMoveMeal }) {
  const [value, setValue] = useState(meal.serveAt);
  const plan = planMealMove(meal, STAMP.test(value) ? value : meal.serveAt, dishes, steps);

  function move() {
    if (!STAMP.test(value) || plan.delta === 0) return;
    const names = plan.dishes.map((d) => d.title).join(', ');
    const ok = window.confirm(
      `Move ${meal.name} from ${fmtWhen(meal.serveAt)} to ${fmtWhen(value)} (${describeDelta(plan.delta)})?\n\n` +
        `This shifts ${plan.patches.length} Prep, Assemble and Cook blocks for: ${names}.\n` +
        'Errands such as the shopping trip stay where they are.',
    );
    if (ok) onMoveMeal(meal, value);
  }

  return (
    <div className="dinner-row-edit">
      <div>
        <strong>{meal.name}</strong>
        <div className="muted">{fmtWhen(meal.serveAt)}</div>
        <div className="muted small-note">{plan.dishes.length} dishes · {steps.filter((s) => plan.dishes.some((d) => d.id === s.dishId)).length} blocks move with it</div>
      </div>
      {canEdit && (
        <div className="dinner-move">
          <input
            type="datetime-local"
            step="900"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`New date and time for ${meal.name}`}
          />
          <button disabled={!STAMP.test(value) || plan.delta === 0} onClick={move}>
            Move dinner
          </button>
          {plan.delta !== 0 && STAMP.test(value) && <span className="muted">{describeDelta(plan.delta)}</span>}
        </div>
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
  onNotesChange,
  onUpdateStep,
  onAddStep,
  onDeleteStep,
  onMoveMeal,
}) {
  const [preview, setPreview] = useState(null); // { ids: null (all) | [dish ids] }: show the print preview
  const [picking, setPicking] = useState(false); // the "select recipes to print" checklist
  const [picked, setPicked] = useState({});
  const mealById = useMemo(() => Object.fromEntries(meals.map((m) => [m.id, m])), [meals]);

  const ordered = useMemo(() => {
    const meal = (d) => (mealById[d.mealId] ? mealById[d.mealId].serveAt : '');
    return [...sortDishes(dishes)].sort((a, b) => (meal(a) < meal(b) ? -1 : meal(a) > meal(b) ? 1 : 0));
  }, [dishes, mealById]);

  if (preview) {
    const ids = preview.ids;
    const one = ids && ids.length === 1 ? dishes.find((d) => d.id === ids[0]) : null;
    return (
      <PrintShell title={one ? one.title : 'Recipes'} onClose={() => setPreview(null)}>
        <RecipesPrint dishes={dishes} meals={meals} steps={steps} onlyDishIds={ids} />
      </PrintShell>
    );
  }

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
        onNotesChange={onNotesChange}
        onUpdateStep={onUpdateStep}
        onAddStep={onAddStep}
        onDeleteStep={onDeleteStep}
        onPrint={() => setPreview({ ids: [open.id] })}
        onBack={() => onOpenChange(null)}
      />
    );
  }

  return (
    <div>
      <h3>Dinner date and time</h3>
      <p className="muted">
        Move a dinner and every Prep, Assemble and Cook block of its dishes moves with it. Errands such as the
        shopping trip stay put.
      </p>
      {[...meals]
        .sort((a, b) => (a.serveAt < b.serveAt ? -1 : 1))
        .map((m) => (
          <DinnerRow
            key={`${m.id}-${m.serveAt}`}
            meal={m}
            dishes={dishes}
            steps={steps}
            canEdit={canEdit}
            onMoveMeal={onMoveMeal}
          />
        ))}

      <h3>Dishes</h3>
      <p>
        <button className="secondary" onClick={() => setPicking((v) => !v)}>
          ☑ Select recipes to print
        </button>
        <button className="secondary" onClick={() => setPreview({ ids: null })}>
          🖨 Print all recipes
        </button>
      </p>
      {picking && (
        <div className="pick-box">
          {ordered.map((d) => (
            <label key={d.id} className="pick-row">
              <input
                type="checkbox"
                checked={!!picked[d.id]}
                onChange={() => setPicked((p) => ({ ...p, [d.id]: !p[d.id] }))}
              />{' '}
              {d.emoji} {d.title}
            </label>
          ))}
          <p>
            <button
              className="secondary"
              onClick={() => setPicked(Object.fromEntries(ordered.map((d) => [d.id, true])))}
            >
              Select all
            </button>
            <button className="secondary" onClick={() => setPicked({})}>
              Clear
            </button>
            <button
              disabled={!ordered.some((d) => picked[d.id])}
              onClick={() => setPreview({ ids: ordered.filter((d) => picked[d.id]).map((d) => d.id) })}
            >
              🖨 Preview selected ({ordered.filter((d) => picked[d.id]).length})
            </button>
          </p>
        </div>
      )}
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
    </div>
  );
}
