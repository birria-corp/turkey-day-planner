import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteEvent,
  eventId,
  fetchEventDetail,
  fetchEvents,
  loadSampleEvent,
  updateDishCook,
} from './events.js';
import BlockCalendar from './BlockCalendar.jsx';
import DinnerPanel from './DinnerPanel.jsx';
import { EVENT_COLOR, dishColor, sortDishes } from './palette.js';
import { addMinutes, dayKey, fmtDayHeading, fmtTime } from './scheduler/time.js';

const SAMPLE_YEAR = 2026;
const VIEW_KEY = 'tdp-view';

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'timeline' ? 'timeline' : 'grid';
  } catch {
    return 'grid';
  }
}

/** Day-by-day list of an event's steps and serve times, with dish colors. */
function Timeline({ meals, dishes, steps, colorOf }) {
  const dishById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  const rows = [
    ...steps.map((s) => {
      const dish = dishById[s.dishId];
      return {
        key: `step-${s.id}`,
        at: s.startAt,
        kind: 'step',
        label: s.text,
        when: `${fmtTime(s.startAt)} – ${fmtTime(addMinutes(s.startAt, s.durationMin))}`,
        dish,
        dishId: s.dishId,
        resource: s.resource !== 'none' ? s.resource : '',
      };
    }),
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
  const [view, setView] = useState(readView);
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

  // dishId -> swatch. Non-dish items (shopping) fall back to the event color.
  const colorOf = useMemo(() => {
    const ordered = sortDishes(detail ? detail.dishes : []);
    const map = Object.fromEntries(ordered.map((d, i) => [d.id, dishColor(d, i)]));
    return (dishId) => map[dishId] || EVENT_COLOR;
  }, [detail]);

  function pickView(v) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked: the toggle still works for this visit */
    }
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

  if (events === undefined) return <p>Loading events…</p>;

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
            <button className={`tab ${view === 'grid' ? 'active' : 'secondary'}`} onClick={() => pickView('grid')}>
              Grid
            </button>
            <button
              className={`tab ${view === 'timeline' ? 'active' : 'secondary'}`}
              onClick={() => pickView('timeline')}
            >
              Timeline
            </button>
            <button className="secondary" disabled={busy} onClick={() => run(async () => {})}>
              Refresh
            </button>
          </p>
          {detail &&
            (view === 'grid' ? (
              <div className="cal-wrap">
                <BlockCalendar event={current} meals={detail.meals} steps={detail.steps} colorOf={colorOf} />
                <DinnerPanel
                  meals={detail.meals}
                  dishes={detail.dishes}
                  colorOf={colorOf}
                  canEdit={canEdit}
                  onCookChange={changeCook}
                />
              </div>
            ) : (
              <Timeline meals={detail.meals} dishes={detail.dishes} steps={detail.steps} colorOf={colorOf} />
            ))}
          {isOwner && current.id === eventId(SAMPLE_YEAR) && (
            <p>
              <button className="danger" disabled={busy} onClick={replaceSample}>
                Replace sample event
              </button>
            </p>
          )}
        </>
      ) : (
        <>
          <h2>Events</h2>
          <p className="muted">No event yet.</p>
          {isOwner && (
            <p>
              <button disabled={busy} onClick={() => run(() => loadSampleEvent(SAMPLE_YEAR, ownerUid))}>
                Load sample event ({SAMPLE_YEAR})
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
