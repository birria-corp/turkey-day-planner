import React, { useCallback, useEffect, useState } from 'react';
import { fetchEvents, fetchEventDetail, loadSampleEvent } from './events.js';
import { addMinutes, dayKey, fmtDayHeading, fmtTime } from './scheduler/time.js';

const btn = { padding: '8px 12px', fontSize: 15, borderRadius: 6, border: '1px solid #888', cursor: 'pointer', marginRight: 6 };
const SAMPLE_YEAR = 2026;

/** Read-only day-by-day list of an event's steps and serve times. */
function DayList({ meals, dishes, steps }) {
  const dishById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  // One flat list of rows, steps and serve markers, sorted by start time.
  const rows = [
    ...steps.map((s) => {
      const dish = dishById[s.dishId];
      return {
        key: `step-${s.id}`,
        at: s.startAt,
        kind: 'step',
        label: s.text,
        when: `${fmtTime(s.startAt)} – ${fmtTime(addMinutes(s.startAt, s.durationMin))}`,
        meta: [dish ? dish.title : null, dish ? dish.cookName : null, s.resource !== 'none' ? s.resource : null]
          .filter(Boolean)
          .join(' · '),
      };
    }),
    ...meals.map((m) => ({
      key: `meal-${m.id}`,
      at: m.serveAt,
      kind: 'serve',
      label: `SERVE: ${m.name}`,
      when: fmtTime(m.serveAt),
      meta: '',
    })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind === 'serve' ? 1 : -1));

  const days = [...new Set(rows.map((r) => dayKey(r.at)))];

  return days.map((day) => (
    <div key={day} style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 6 }}>{fmtDayHeading(day)}</h3>
      {rows
        .filter((r) => dayKey(r.at) === day)
        .map((r) => (
          <div
            key={r.key}
            style={{
              display: 'flex',
              gap: 10,
              padding: '6px 0',
              borderBottom: '1px solid #eee',
              fontWeight: r.kind === 'serve' ? 700 : 400,
              background: r.kind === 'serve' ? '#fff6e0' : 'transparent',
            }}
          >
            <span style={{ minWidth: 150, color: '#444' }}>{r.when}</span>
            <span>
              {r.label}
              {r.meta && <span style={{ color: '#666', fontSize: 14 }}> ({r.meta})</span>}
            </span>
          </div>
        ))}
    </div>
  ));
}

export default function EventView({ isOwner, ownerUid }) {
  const [events, setEvents] = useState(undefined); // undefined = loading
  const [detail, setDetail] = useState(null);
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

  async function loadSample() {
    setBusy(true);
    try {
      await loadSampleEvent(SAMPLE_YEAR, ownerUid);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (events === undefined) return <p>Loading events…</p>;

  const current = events[0];

  return (
    <section>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {current ? (
        <>
          <h2>{current.name}</h2>
          <p style={{ color: '#666' }}>
            {fmtDayHeading(current.startDate)} to {fmtDayHeading(current.endDate)}
          </p>
          {detail && <DayList {...detail} />}
          <p><button style={btn} onClick={load}>Refresh</button></p>
        </>
      ) : (
        <>
          <h2>Events</h2>
          <p style={{ color: '#666' }}>No event yet.</p>
          {isOwner && (
            <p>
              <button style={btn} disabled={busy} onClick={loadSample}>
                Load sample event ({SAMPLE_YEAR})
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
