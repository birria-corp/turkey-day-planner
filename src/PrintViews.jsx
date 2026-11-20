import React from 'react';
import { KIND_MARKER, KIND_NAME, fmtDuration, fmtRange, stepKind } from './labels.js';
import { sortDishes } from './palette.js';
import { groupByAisle, ingredientLine } from './shopping.js';

/**
 * Print preview page: the document as it will print, with Print and Close buttons that do not print.
 * (Pressing Print opens the browser's print window; choose "Save as PDF" there to keep a copy.)
 */
export function PrintShell({ title, onClose, children }) {
  return (
    <div className="print-preview">
      <p className="no-print preview-bar">
        <button onClick={() => window.print()}>🖨 Print</button>
        <button className="secondary" onClick={onClose}>
          Close preview
        </button>
        <span className="muted">In the print window you can also choose “Save as PDF”.</span>
      </p>
      <div className="print-doc">
        <h1 className="print-title">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function RecipePage({ dish, meal, steps }) {
  const scale = dish.scale ?? 1;
  const mine = steps.filter((s) => s.dishId === dish.id).sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  return (
    <section className="print-page">
      <h2>
        {dish.emoji} {dish.title}
      </h2>
      <p>
        {meal ? `${meal.name} · ` : ''}Cook: <strong>{dish.cookName || 'unassigned'}</strong>
        {dish.servings ? ` · ${dish.servings}` : ''}
        {scale !== 1 ? ` · made x${scale}` : ''}
        {dish.source ? ` · ${dish.source}` : ''}
      </p>

      {mine.length > 0 && (
        <>
          <h3>Schedule</h3>
          <table className="print-table">
            <tbody>
              {mine.map((s) => (
                <tr key={s.id}>
                  <td>
                    {KIND_MARKER[stepKind(s)]} {KIND_NAME[stepKind(s)]}
                  </td>
                  <td>{s.text}</td>
                  <td>{fmtRange(s.startAt, s.durationMin)}</td>
                  <td>{fmtDuration(s.durationMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(dish.ingredients || []).length > 0 && (
        <>
          <h3>Ingredients (amounts include x{scale})</h3>
          <table className="print-table">
            <tbody>
              {dish.ingredients.map((ing, i) => {
                const l = ingredientLine(ing, scale);
                return (
                  <tr key={i}>
                    <td className="ing-amount">{l.amount}</td>
                    <td>
                      {l.name}
                      {ing.note ? ` (${ing.note})` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

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

      {dish.notes && <p>{dish.notes}</p>}
    </section>
  );
}

/** One recipe per page, in dinner order. Pass `onlyDishId` for a single recipe. */
export function RecipesPrint({ dishes, meals, steps, onlyDishId }) {
  const mealById = Object.fromEntries(meals.map((m) => [m.id, m]));
  const ordered = [...sortDishes(dishes)].sort((a, b) => {
    const sa = mealById[a.mealId] ? mealById[a.mealId].serveAt : '';
    const sb = mealById[b.mealId] ? mealById[b.mealId].serveAt : '';
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
  return ordered
    .filter((d) => !onlyDishId || d.id === onlyDishId)
    .map((d) => <RecipePage key={d.id} dish={d} meal={mealById[d.mealId]} steps={steps} />);
}

/**
 * Paper shopping list, grouped by aisle with a box to tick.
 * mode "store": only what you still need. mode "full": everything, with the ones you have already ticked.
 */
export function ShoppingPrint({ items, mode }) {
  const shown = mode === 'store' ? items.filter((i) => !i.have) : items;
  return groupByAisle(shown).map(([aisle, groups]) => (
    <section key={aisle} className="pl-aisle">
      <h3>{aisle}</h3>
      {groups.map(([group, list]) => (
        <div key={group || 'all'}>
          {group && <h4>{group}</h4>}
          {list.map((i) => (
            <div key={i.id} className="pl-row">
              <span className="pl-box">{i.have ? '☑' : '☐'}</span>
              <span className="pl-qty">{i.qtyText}</span>
              <span>
                {i.name}
                {i.note ? ` (${i.note})` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  ));
}
