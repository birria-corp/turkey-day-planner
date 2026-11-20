import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addStep,
  deleteEvent,
  deleteStep,
  eventId,
  fetchEventDetail,
  fetchEvents,
  importEvent,
  loadSampleEvent,
  updateDishCook,
  updateDishScale,
  updateStep,
} from './events.js';
import BlockCalendar from './BlockCalendar.jsx';
import DayAgenda from './DayAgenda.jsx';
import DinnerPanel from './DinnerPanel.jsx';
import MenuView from './MenuView.jsx';
import ShoppingView from './ShoppingView.jsx';
import { EVENT_COLOR, dishColor, sortDishes } from './palette.js';
import { KIND_MARKER, KIND_NAME, blockText, stepLabel } from './labels.js';
import { daysInRange } from './scheduler/dates.js';
import { findConflicts } from './scheduler/conflicts.js';
import { addMinutes, dayKey, fmtDayHeading, fmtTime } from './scheduler/time.js';

const SAMPLE_YEAR = 2026;
const VIEW_KEY = 'tdp-view';
const TAB_KEY = 'tdp-tab';
const ROWS_KEY = 'tdp-rows';
const ROW_HEIGHTS = { compact: 30, normal: 48, large: 64 };
const RESOURCE_WORD = { oven: 'Oven', stovetop: 'Stovetop', smoker: 'Smoker' };

function readStored(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice still works for this visit */
  }
}

const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const shortDay = (key) =>
  parseKey(key).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

/** Day-by-day list of an event's steps and serve times, with dish colors. */
function Timeline({ meals, dishes, steps, colorOf }) {
  const dishById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  const rows = [
    ...steps.map((s) => ({
      key: `step-${s.id}`,
      at: s.startAt,
      kind: 'step',
      label: stepLabel(s, dishById[s.dishId]),
      when: `${fmtTime(s.startAt)} – ${fmtTime(addMinutes(s.startAt, s.durationMin))}`,
      dish: dishById[s.dishId],
      dishId: s.dishId,
      resource: s.resource !== 'none' ? s.resource : '',
    })),
    ...meals.map((m) => ({
      key: `meal-${m.id}`,
      at: m.serveAt,
      kind: 'serve',
      label: `SERVE: ${m.name}`,
      when: fmtTime(m.serveAt),
    })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind === 'serve' ? 1 : -1));

  const days = [...new Set(rows.map((r) => dayKey(r.at)))];

  return days.map((day) => (
    <div key={day} className="day">
      <h3>{fmtDayHeading(day)}</h3>
      {rows
        .filter((r) => dayKey(r.at) === day)
        .map((r) => {
          const c = r.kind === 'step' ? colorOf(r.dishId) : null;
          return (
            <div
              key={r.key}
              className={`trow ${r.kind}`}
              style={c ? { borderLeftColor: c.bg } : undefined}
            >
              <span className="when">{r.when}</span>
              <span>
                {r.label}
                {r.dish && (
                  <span className="chip small" style={{ background: c.bg, color: c.fg }}>
                    {r.dish.title}
                    {r.dish.cookName ? ` · ${r.dish.cookName}` : ''}
                  </span>
                )}
                {r.resource && <span className="muted"> ({r.resource})</span>}
              </span>
            </div>
          );
        })}
    </div>
  ));
}

export default function EventView({ isOwner, canEdit, ownerUid }) {
  const [events, setEvents] = useState(undefined); // undefined = loading
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState(() => readStored(TAB_KEY, ['plan', 'menu', 'shopping'], 'plan'));
  const [view, setView] = useState(() => readStored(VIEW_KEY, ['week', 'day', 'timeline'], 'week'));
  const [rows, setRows] = useState(() => readStored(ROWS_KEY, Object.keys(ROW_HEIGHTS), 'normal'));
  const [day, setDay] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchEvents();
      setEvents(list);
      setDetail(list.length ? await fetchEventDetail(list[0].id) : null);
      setError('');
    } catch (e) {
      setError(e.message);
      setEvents((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = events ? events[0] : undefined;

  // dishId -> swatch. A dish's saved `color` is a palette key. Errands fall back to the event color.
  const colorOf = useMemo(() => {
    const ordered = sortDishes(detail ? detail.dishes : []);
    const map = Object.fromEntries(ordered.map((d, i) => [d.id, dishColor(d, i)]));
    return (dishId) => map[dishId] || EVENT_COLOR;
  }, [detail]);

  const dishById = useMemo(
    () => Object.fromEntries((detail ? detail.dishes : []).map((d) => [d.id, d])),
    [detail],
  );
  const labelOf = useCallback((step) => stepLabel(step, dishById[step.dishId]), [dishById]);
  const textOf = useCallback((step) => blockText(step, dishById[step.dishId]), [dishById]);

  // Every day with something on it, for the Day view picker.
  const allDays = useMemo(() => {
    if (!current || !detail) return [];
    const keys = new Set(daysInRange(parseKey(current.startDate), parseKey(current.endDate)).map((d) => d.iso));
    detail.steps.forEach((s) => keys.add(dayKey(s.startAt)));
    detail.meals.forEach((m) => keys.add(dayKey(m.serveAt)));
    return [...keys].sort();
  }, [current, detail]);

  const activeDay = useMemo(() => {
    if (day && allDays.includes(day)) return day;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (allDays.includes(todayKey)) return todayKey;
    const serve = detail && detail.meals.length ? detail.meals.map((m) => m.serveAt).sort()[0] : null;
    return serve ? dayKey(serve) : allDays[0];
  }, [day, allDays, detail]);

  const conflicts = useMemo(() => (detail ? findConflicts(detail.steps) : []), [detail]);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap((c) => c.stepIds)), [conflicts]);

  function pick(setter, key, value) {
    setter(value);
    store(key, value);
  }

  function openDish(id) {
    setMenuOpenId(id);
    pick(setTab, TAB_KEY, 'menu');
    window.scrollTo({ top: 0 });
  }

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeCook(dishId, name) {
    try {
      await updateDishCook(current.id, dishId, name);
      setDetail((d) => ({
        ...d,
        dishes: d.dishes.map((x) => (x.id === dishId ? { ...x, cookName: name } : x)),
      }));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function changeScale(dishId, scale) {
    try {
      await updateDishScale(current.id, dishId, scale);
      setDetail((d) => ({
        ...d,
        dishes: d.dishes.map((x) => (x.id === dishId ? { ...x, scale } : x)),
      }));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  // Step edits show at once, then save; if the save fails the page reloads the saved plan.
  async function patchStep(stepId, patch) {
    setDetail((d) => ({ ...d, steps: d.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }));
    try {
      await updateStep(current.id, stepId, patch);
      setError('');
    } catch (e) {
      setError(e.message);
      load();
    }
  }

  async function createStep(dish, kind) {
    const mine = detail.steps.filter((s) => s.dishId === dish.id);
    const meal = detail.meals.find((m) => m.id === dish.mealId);
    const lastEnd = mine.map((s) => addMinutes(s.startAt, s.durationMin)).sort().pop();
    const step = {
      dishId: dish.id,
      kind,
      text: KIND_NAME[kind],
      startAt: lastEnd || (meal ? addMinutes(meal.serveAt, -60) : `${activeDay}T12:00`),
      durationMin: 30,
      resource: kind === 'cook' ? 'oven' : 'hands',
      anchor: 'fixed',
    };
    try {
      const id = await addStep(current.id, step);
      setDetail((d) => ({ ...d, steps: [...d.steps, { id, ...step }] }));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeStep(step) {
    if (!window.confirm(`Remove "${step.text}"?`)) return;
    try {
      await deleteStep(current.id, step.id);
      setDetail((d) => ({ ...d, steps: d.steps.filter((s) => s.id !== step.id) }));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  function replaceSample() {
    if (
      !window.confirm(
        `Delete ${current.name} and reload the sample event? Cook assignments and any other edits will be lost.`,
      )
    ) {
      return;
    }
    run(async () => {
      await deleteEvent(current.id);
      await loadSampleEvent(SAMPLE_YEAR, ownerUid);
    });
  }

  function importFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    run(async () => {
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      const year = data && data.event && data.event.year;
      if (!window.confirm(`Replace the ${year} event with the contents of ${file.name}? Everything on that event, including cook picks, ticks and edits, is replaced.`)) {
        return;
      }
      await importEvent(data, ownerUid);
    });
  }

  if (events === undefined) return <p>Loading events…</p>;

  const tabBtn = (id, label) => (
    <button className={`tab ${tab === id ? 'active' : 'secondary'}`} onClick={() => pick(setTab, TAB_KEY, id)}>
      {label}
    </button>
  );
  const viewBtn = (id, label) => (
    <button className={`tab ${view === id ? 'active' : 'secondary'}`} onClick={() => pick(setView, VIEW_KEY, id)}>
      {label}
    </button>
  );
  const rowBtn = (id, label) => (
    <button className={`tab ${rows === id ? 'active' : 'secondary'}`} onClick={() => pick(setRows, ROWS_KEY, id)}>
      {label}
    </button>
  );

  const calendarProps = detail && {
    event: current,
    meals: detail.meals,
    steps: detail.steps,
    colorOf,
    labelOf,
    textOf,
    dishById,
    rowH: ROW_HEIGHTS[rows],
    canEdit,
    conflictIds,
    onOpenDish: openDish,
    onMoveStep: (stepId, startAt) => patchStep(stepId, { startAt }),
  };

  const dayIndex = allDays.indexOf(activeDay);

  return (
    <section>
      {error && <p className="error">{error}</p>}
      {current ? (
        <>
          <h2>{current.name}</h2>
          <p className="muted">
            {fmtDayHeading(current.startDate)} to {fmtDayHeading(current.endDate)}
          </p>
          <p>
            {tabBtn('plan', 'Plan')}
            {tabBtn('menu', 'Menu')}
            {tabBtn('shopping', 'Shopping')}
            <button className="secondary" disabled={busy} onClick={() => run(async () => {})}>
              Refresh
            </button>
          </p>

          {tab === 'plan' && (
            <>
              <p className="toolbar">
                <span>
                  {viewBtn('week', 'Week')}
                  {viewBtn('day', 'Day')}
                  {viewBtn('timeline', 'Timeline')}
                </span>
                {view !== 'timeline' && (
                  <span className="rowpick">
                    <span className="muted">Row height</span> {rowBtn('compact', 'S')}
                    {rowBtn('normal', 'M')}
                    {rowBtn('large', 'L')}
                  </span>
                )}
                <span className="muted legend">
                  {KIND_MARKER.prep} prep &nbsp; {KIND_MARKER.assemble} assemble &nbsp; {KIND_MARKER.cook} cook &nbsp;{' '}
                  {KIND_MARKER.rest} rest &nbsp; {KIND_MARKER.event} errand
                </span>
              </p>

              {conflicts.length > 0 && view !== 'timeline' && (
                <div className="conflicts" role="status">
                  <strong>⚠ Equipment over capacity</strong>
                  {conflicts.map((c) => (
                    <div key={`${c.resource}-${c.from}`}>
                      {RESOURCE_WORD[c.resource]} has {c.count} things at once (holds {c.capacity}),{' '}
                      {shortDay(dayKey(c.from))} {fmtTime(c.from)} – {fmtTime(c.to)}:{' '}
                      {c.stepIds
                        .map((id) => detail.steps.find((s) => s.id === id))
                        .filter(Boolean)
                        .map((s) => labelOf(s))
                        .join(', ')}
                    </div>
                  ))}
                </div>
              )}

              {detail && view === 'week' && (
                <div className="cal-wrap">
                  <BlockCalendar
                    {...calendarProps}
                    side={
                      <DinnerPanel
                        meals={detail.meals}
                        dishes={detail.dishes}
                        colorOf={colorOf}
                        canEdit={canEdit}
                        onCookChange={changeCook}
                      />
                    }
                  />
                </div>
              )}

              {detail && view === 'day' && activeDay && (
                <>
                  <p className="daypick">
                    <button
                      className="secondary"
                      disabled={dayIndex <= 0}
                      onClick={() => setDay(allDays[dayIndex - 1])}
                      aria-label="Previous day"
                    >
                      ←
                    </button>
                    {allDays.map((k) => (
                      <button
                        key={k}
                        className={`tab ${k === activeDay ? 'active' : 'secondary'}`}
                        onClick={() => setDay(k)}
                      >
                        {shortDay(k)}
                      </button>
                    ))}
                    <button
                      className="secondary"
                      disabled={dayIndex >= allDays.length - 1}
                      onClick={() => setDay(allDays[dayIndex + 1])}
                      aria-label="Next day"
                    >
                      →
                    </button>
                  </p>
                  <div className="cal-wrap">
                    <BlockCalendar
                      {...calendarProps}
                      onlyDay={activeDay}
                      unitW={150}
                      side={
                        <DayAgenda
                          day={activeDay}
                          steps={detail.steps}
                          dishes={detail.dishes}
                          meals={detail.meals}
                          colorOf={colorOf}
                          onOpenDish={openDish}
                        />
                      }
                    />
                  </div>
                </>
              )}

              {detail && view === 'timeline' && (
                <Timeline meals={detail.meals} dishes={detail.dishes} steps={detail.steps} colorOf={colorOf} />
              )}
            </>
          )}

          {tab === 'menu' && detail && (
            <MenuView
              dishes={detail.dishes}
              meals={detail.meals}
              steps={detail.steps}
              colorOf={colorOf}
              canEdit={canEdit}
              openId={menuOpenId}
              onOpenChange={setMenuOpenId}
              onScaleChange={changeScale}
              onUpdateStep={patchStep}
              onAddStep={createStep}
              onDeleteStep={removeStep}
            />
          )}

          {tab === 'shopping' && detail && (
            <ShoppingView eventId={current.id} dishes={detail.dishes} canEdit={canEdit} />
          )}
        </>
      ) : (
        <>
          <h2>Events</h2>
          <p className="muted">No event yet.</p>
        </>
      )}

      {isOwner && (
        <div className="owner-tools">
          <h3>Owner tools</h3>
          <p>
            <label className="file-btn">
              Import menu file…
              <input type="file" accept=".json,application/json" onChange={importFile} disabled={busy} />
            </label>
            {!current && (
              <button disabled={busy} onClick={() => run(() => loadSampleEvent(SAMPLE_YEAR, ownerUid))}>
                Load sample event ({SAMPLE_YEAR})
              </button>
            )}
            {current && current.id === eventId(SAMPLE_YEAR) && !(detail && detail.dishes.some((d) => d.ingredients)) && (
              <button className="danger" disabled={busy} onClick={replaceSample}>
                Replace sample event
              </button>
            )}
          </p>
          <p className="muted">Import replaces the whole {SAMPLE_YEAR} event with the file you pick (meals, recipes, blocks, shopping list).</p>
        </div>
      )}
    </section>
  );
}
