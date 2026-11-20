import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  addStep,
  deleteEvent,
  deleteStep,
  fetchEventDetail,
  fetchEvents,
  fetchShopping,
  importEvent,
  loadSampleEvent,
  moveMeal,
  updateDishCook,
  updateDishNotes,
  updateDishScale,
  updateStep,
} from './events.js';
import { backupFilename, buildBackup, downloadJson } from './backup.js';
import BlockCalendar from './BlockCalendar.jsx';
import DayAgenda from './DayAgenda.jsx';
import DinnerPanel from './DinnerPanel.jsx';
import MenuView from './MenuView.jsx';
import Settings from './Settings.jsx';
import ShoppingView from './ShoppingView.jsx';
import { EVENT_COLOR, dishColor, sortDishes } from './palette.js';
import { KIND_MARKER, KIND_NAME, blockText, stepLabel } from './labels.js';
import { daysInRange } from './scheduler/dates.js';
import { findConflicts } from './scheduler/conflicts.js';
import { planMealMove } from './scheduler/meal.js';
import { addMinutes, dayKey, fmtDayHeading, fmtTime } from './scheduler/time.js';

const SAMPLE_YEAR = 2026;
const VIEW_KEY = 'tdp-view';
const TAB_KEY = 'tdp-tab';
const ROWS_KEY = 'tdp-rows';
const BACKUP_KEY = 'tdp-last-backup';
const ROW_HEIGHTS = { compact: 30, normal: 48, large: 64 };
const RESOURCE_WORD = { oven: 'Oven', stovetop: 'Stovetop', smoker: 'Smoker' };
const NARROW_PX = 820; // below this width the page is laid out for a phone
const PHONE_GUTTER = 56; // time labels column on a phone (keep in sync with theme.css)
const PRINT_W = 970; // usable width of a landscape letter page, in CSS pixels (10.1 in)
const PRINT_H = 650; // usable height left under the title (about 6.8 in)

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

/** True on a phone-sized screen. */
function useNarrow() {
  const query = `(max-width: ${NARROW_PX}px)`;
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}

/** Width in pixels of an element, kept current as the window changes. */
function useElementWidth(el) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}

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

export default function EventView({ isOwner, canEdit, ownerUid, settingsOpen, onCloseSettings, onEventYear }) {
  const narrow = useNarrow();
  const [events, setEvents] = useState(undefined); // undefined = loading
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState(() => readStored(TAB_KEY, ['plan', 'menu', 'shopping'], 'plan'));
  // Phones open on the Day view; the wide Week grid is for bigger screens.
  const [view, setView] = useState(() =>
    readStored(VIEW_KEY, ['week', 'day', 'timeline'], typeof window !== 'undefined' && window.innerWidth <= NARROW_PX ? 'day' : 'week'),
  );
  const [rows, setRows] = useState(() => readStored(ROWS_KEY, Object.keys(ROW_HEIGHTS), 'normal'));
  const [day, setDay] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [lastBackup, setLastBackup] = useState(() => {
    try {
      return localStorage.getItem(BACKUP_KEY) || '';
    } catch {
      return '';
    }
  });
  const [dayWrap, setDayWrap] = useState(null);
  const dayWrapWidth = useElementWidth(dayWrap);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [printRow, setPrintRow] = useState(null); // row height used only while the Plan tab is being printed

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

  // The header shows the year of the (earliest) dinner, so moving a dinner to another year updates it.
  const dinnerYear = useMemo(() => {
    if (detail && detail.meals.length) return Number(detail.meals.map((m) => m.serveAt).sort()[0].slice(0, 4));
    return current ? current.year : null;
  }, [detail, current]);
  useEffect(() => {
    if (onEventYear) onEventYear(dinnerYear || null);
  }, [dinnerYear, onEventYear]);

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

  // Move a dinner and every step of its dishes by the same amount (all saved together).
  async function changeMealTime(meal, serveAt) {
    const plan = planMealMove(meal, serveAt, detail.dishes, detail.steps);
    const byId = Object.fromEntries(plan.patches.map((p) => [p.id, p.startAt]));
    setDetail((d) => ({
      ...d,
      meals: d.meals.map((m) => (m.id === meal.id ? { ...m, serveAt } : m)),
      steps: d.steps.map((s) => (byId[s.id] ? { ...s, startAt: byId[s.id] } : s)),
    }));
    try {
      await moveMeal(current.id, meal.id, serveAt, plan.patches);
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

  // Download everything about the current event as a file on this device. Used by the Backup button
  // and automatically before anything that replaces the event.
  async function downloadBackup() {
    const [fresh, shopping] = await Promise.all([fetchEventDetail(current.id), fetchShopping(current.id)]);
    const now = new Date();
    downloadJson(backupFilename(now, current.year), buildBackup(current, fresh, shopping, now));
    store(BACKUP_KEY, now.toISOString());
    setLastBackup(now.toISOString());
  }

  function backupNow() {
    run(async () => {
      await downloadBackup();
    });
  }

  async function createErrand() {
    const step = {
      dishId: '',
      kind: 'event',
      text: 'Errand',
      startAt: `${activeDay || (current && current.startDate)}T10:00`,
      durationMin: 60,
      resource: 'none',
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

  // Print the Plan tab on one landscape page. The grid is tall (8 AM to 9 PM), so fitting it by shrinking
  // everything would waste the sheet's width. Instead the rows are made just short enough for the grid to
  // fill the page's width at full text size (scaling down only if the grid is wider than the page).
  function printPlan() {
    flushSync(() => setPrintRow(30));
    const el = document.querySelector('.print-fit');
    if (el) {
      const col = el.querySelector('.cal-col');
      const slots = col ? Math.max(1, Math.round(col.offsetHeight / 30)) : 26;
      const fixed = el.scrollHeight - slots * 30; // day headers, long-task bars, spacing
      const zw = Math.min(1, PRINT_W / el.scrollWidth);
      const rowH = Math.max(16, Math.min(30, Math.floor((PRINT_H / zw - fixed) / slots)));
      flushSync(() => setPrintRow(rowH));
      const z = Math.min(1, PRINT_W / el.scrollWidth, PRINT_H / el.scrollHeight);
      document.documentElement.style.setProperty('--print-zoom', String(z));
    }
    const done = () => {
      window.removeEventListener('afterprint', done);
      setPrintRow(null);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }

  async function changeNotes(dishId, myNotes) {
    try {
      await updateDishNotes(current.id, dishId, myNotes);
      setDetail((d) => ({
        ...d,
        dishes: d.dishes.map((x) => (x.id === dishId ? { ...x, myNotes } : x)),
      }));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  function replaceSample() {
    if (
      !window.confirm(
        `Delete ${current.name} and reload the sample event? Cook assignments and any other edits will be lost. A backup file downloads first.`,
      )
    ) {
      return;
    }
    run(async () => {
      await downloadBackup();
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
      if (!window.confirm(`Replace the ${year} event with the contents of ${file.name}? Everything on that event, including cook picks, ticks and edits, is replaced. A backup file of the current event downloads first.`)) {
        return;
      }
      if (current) await downloadBackup();
      await importEvent(data, ownerUid);
    });
  }

  if (events === undefined) return <p>Loading events…</p>;

  if (settingsOpen && isOwner) {
    return (
      <Settings
        ownerUid={ownerUid}
        current={current}
        detail={detail}
        busy={busy}
        lastBackup={lastBackup}
        errands={detail ? detail.steps.filter((s) => !s.dishId).sort((a, b) => (a.startAt < b.startAt ? -1 : 1)) : []}
        onClose={onCloseSettings}
        onBackup={backupNow}
        onImportFile={importFile}
        onReplaceSample={replaceSample}
        onLoadSample={() => run(() => loadSampleEvent(SAMPLE_YEAR, ownerUid))}
        onUpdateStep={patchStep}
        onAddErrand={createErrand}
        onDeleteStep={removeStep}
      />
    );
  }

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

  // On a phone the Day view is squeezed to the screen and uses taller rows so blocks stay readable.
  const dayRowH = printRow || (narrow ? Math.max(ROW_HEIGHTS[rows], ROW_HEIGHTS.large) : ROW_HEIGHTS[rows]);
  const fitWidth = narrow && dayWrapWidth ? Math.max(200, dayWrapWidth - PHONE_GUTTER) : null;

  const calendarProps = detail && {
    event: current,
    meals: detail.meals,
    steps: detail.steps,
    colorOf,
    labelOf,
    textOf,
    dishById,
    rowH: printRow || ROW_HEIGHTS[rows],
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
          <p className="muted dates-line">
            {fmtDayHeading(current.startDate)} to {fmtDayHeading(current.endDate)}
          </p>
          <p className="no-print">
            {tabBtn('plan', 'Plan')}
            {tabBtn('menu', 'Menu')}
            {tabBtn('shopping', 'Shopping')}
            <button className="secondary" disabled={busy} onClick={() => run(async () => {})}>
              Refresh
            </button>
          </p>

          {tab === 'plan' && (
            <div className={`print-sheet${view === 'timeline' ? ' portrait' : ''}`}>
              <h1 className="print-only print-title">
                Turkey Day Planner{dinnerYear ? ` - ${dinnerYear}` : ''} · {fmtDayHeading(current.startDate)} to{' '}
                {fmtDayHeading(current.endDate)}
              </h1>
              <p className="toolbar no-print">
                <span>
                  {viewBtn('week', 'Week')}
                  {viewBtn('day', 'Day')}
                  {viewBtn('timeline', 'Timeline')}
                </span>
                {view !== 'timeline' && !(narrow && view === 'day') && (
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
                <button className="secondary" onClick={printPlan}>
                  🖨 Print
                </button>
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
                <div className="cal-wrap print-fit">
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
                  <p className="daypick no-print">
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
                  <div className="day-wrap print-fit" ref={setDayWrap}>
                    <BlockCalendar
                      {...calendarProps}
                      rowH={dayRowH}
                      onlyDay={activeDay}
                      unitW={150}
                      fitWidth={fitWidth}
                    />
                    <DayAgenda
                      day={activeDay}
                      steps={detail.steps}
                      dishes={detail.dishes}
                      meals={detail.meals}
                      colorOf={colorOf}
                      onOpenDish={openDish}
                    />
                  </div>
                </>
              )}

              {detail && view === 'timeline' && (
                <Timeline meals={detail.meals} dishes={detail.dishes} steps={detail.steps} colorOf={colorOf} />
              )}
            </div>
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
              onNotesChange={changeNotes}
              onUpdateStep={patchStep}
              onAddStep={createStep}
              onDeleteStep={removeStep}
              onMoveMeal={changeMealTime}
            />
          )}

          {tab === 'shopping' && detail && (
            <ShoppingView eventId={current.id} dishes={detail.dishes} canEdit={canEdit} />
          )}
        </>
      ) : (
        <>
          <h2>Events</h2>
          <p className="muted">No event yet.{isOwner ? ' Open Settings (the gear, top right) to import the menu file.' : ''}</p>
        </>
      )}
    </section>
  );
}
