import React from 'react';
import { thanksgivingDate, eventRange } from './scheduler/dates.js';

const fmt = (d) =>
  d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default function App() {
  const year = new Date().getFullYear();
  const t = thanksgivingDate(year);
  const { start, end } = eventRange(year);
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <h1>Turkey Day Planner</h1>
      <p>Thanksgiving {year}: {fmt(t)}</p>
      <p>Default planning week: {fmt(start)} to {fmt(end)}</p>
      <p style={{ color: '#666' }}>v0.1.0 scaffold. Sign-in and planner coming next.</p>
    </main>
  );
}
