import React, { useState } from 'react';
import Admin from './Admin.jsx';
import { StepRow } from './MenuView.jsx';
import { eventId } from './events.js';

const SAMPLE_YEAR = 2026;

const fmtBackup = (iso) => {
  if (!iso) return 'No backup downloaded from this device yet.';
  try {
    return `Last backup from this device: ${new Date(iso).toLocaleString()}`;
  } catch {
    return '';
  }
};

/** The names in the cook dropdown: add a name, or remove one (dishes already given that name keep it). */
function CooksEditor({ cooks, onSave, disabled }) {
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n || cooks.includes(n)) return;
    onSave([...cooks, n]);
    setName('');
  };
  return (
    <div>
      <p className="cook-chips">
        {cooks.map((c) => (
          <span key={c} className="cook-chip">
            {c}
            <button
              className="chip-x"
              disabled={disabled}
              onClick={() => onSave(cooks.filter((x) => x !== c))}
              aria-label={`Remove ${c}`}
              title={`Remove ${c}`}
            >
              ×
            </button>
          </span>
        ))}
      </p>
      <p>
        <input
          className="cook-add"
          value={name}
          placeholder="Add a name"
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />{' '}
        <button className="secondary" disabled={disabled || !name.trim()} onClick={add}>
          + Add
        </button>
      </p>
    </div>
  );
}

/** Owner-only settings: backup, who may use the app, errands, and the menu file tools. Opened from the gear in the header. */
export default function Settings({
  ownerUid,
  current,
  detail,
  busy,
  lastBackup,
  errands,
  cooks,
  onSaveCooks,
  onClose,
  onBackup,
  onImportFile,
  onReplaceSample,
  onLoadSample,
  onUpdateStep,
  onAddErrand,
  onDeleteStep,
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

      <h3>Backup</h3>
      <p className="muted">
        Every change you make saves to Firebase as you go (the header shows “All changes saved”). A backup file is
        your own extra copy: recipes, cooks, block times, errands and shopping ticks. To restore it, use Import menu
        file below. Keep backup files private because they contain the recipes.
      </p>
      <p>
        <button disabled={busy || !current} onClick={onBackup}>
          Download backup now
        </button>{' '}
        <span className="muted">{fmtBackup(lastBackup)}</span>
      </p>

      <h3>People who cook</h3>
      <p className="muted">These names appear in the dinner column dropdown on the Plan tab.</p>
      <CooksEditor cooks={cooks} onSave={onSaveCooks} disabled={!current} />

      <h3>Errands</h3>
      <p className="muted">Trips and tasks that aren’t tied to one dish (shopping, buying ice). Edit the time or remove them here.</p>
      {errands.length === 0 && <p className="muted">No errands.</p>}
      {errands.map((s) => (
        <StepRow key={s.id} step={s} canEdit onUpdate={onUpdateStep} onDelete={onDeleteStep} />
      ))}
      <p>
        <button className="secondary" disabled={!current} onClick={onAddErrand}>
          + Add errand
        </button>
      </p>

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
          Import replaces the whole event with the file you pick (a menu file or a backup file). A backup of the
          current event downloads automatically first. Cook picks, ticks and edits on the event are replaced.
        </p>
      </div>
    </section>
  );
}
