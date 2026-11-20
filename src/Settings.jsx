import React from 'react';
import Admin from './Admin.jsx';
import { eventId } from './events.js';

const SAMPLE_YEAR = 2026;

/** Owner-only settings: who may use the app, and the menu file tools. Opened from the gear in the header. */
export default function Settings({
  ownerUid,
  current,
  detail,
  busy,
  onClose,
  onImportFile,
  onReplaceSample,
  onLoadSample,
}) {
  const isSample = current && current.id === eventId(SAMPLE_YEAR) && !(detail && detail.dishes.some((d) => d.ingredients));

  return (
    <section>
      <p>
        <button className="secondary" onClick={onClose}>
          ← Back to planner
        </button>
      </p>
      <h2>Settings</h2>

      <Admin ownerUid={ownerUid} />

      <div className="owner-tools">
        <h3>Menu file</h3>
        <p>
          <label className="file-btn">
            Import menu file…
            <input type="file" accept=".json,application/json" onChange={onImportFile} disabled={busy} />
          </label>
          {!current && (
            <button disabled={busy} onClick={onLoadSample}>
              Load sample event ({SAMPLE_YEAR})
            </button>
          )}
          {isSample && (
            <button className="danger" disabled={busy} onClick={onReplaceSample}>
              Replace sample event
            </button>
          )}
        </p>
        <p className="muted">
          Import replaces the whole {SAMPLE_YEAR} event with the file you pick (meals, recipes, blocks, shopping list).
          Cook picks, ticks and edits on that event are replaced too.
        </p>
      </div>
    </section>
  );
}
