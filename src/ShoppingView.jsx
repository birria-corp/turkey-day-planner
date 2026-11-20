import React, { useEffect, useState } from 'react';
import { rebuildShopping, subscribeShopping, updateShoppingItem } from './events.js';
import { buildKeepText, groupByAisle } from './shopping.js';
import { PrintShell, ShoppingPrint } from './PrintViews.jsx';
import { canShare, copyText, shareText } from './clipboard.js';

function Row({ item, checked, disabled, onToggle, label }) {
  return (
    <label className={`shop-row${checked ? ' done' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
      <span className="shop-qty">{item.qtyText}</span>
      <span className="shop-name">
        {item.name}
        {item.note && <span className="muted"> ({item.note})</span>}
        <span className="shop-dishes muted"> {label}</span>
      </span>
    </label>
  );
}

/** Aisle heading, then like items grouped under small sub-headings (fruit, herbs, cheese...). */
function Aisles({ items, renderRow }) {
  return groupByAisle(items).map(([aisle, groups]) => (
    <section key={aisle} className="aisle">
      <h3>{aisle}</h3>
      {groups.map(([group, list]) => (
        <div key={group || 'all'} className="shop-group">
          {group && <h4>{group}</h4>}
          {renderRow(list)}
        </div>
      ))}
    </section>
  ));
}

/** Shopping tab. Pass 1: tick what you already have. Pass 2: take the rest to the store and tick it into the cart. */
export default function ShoppingView({ eventId, dishes, canEdit }) {
  const [items, setItems] = useState(null);
  const [mode, setMode] = useState('pantry');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // 'store' | 'full': print preview
  const [note, setNote] = useState(''); // "Copied" feedback

  useEffect(() => subscribeShopping(eventId, setItems, (e) => setError(e.message)), [eventId]);

  const flash = (text) => {
    setNote(text);
    setTimeout(() => setNote(''), 4000);
  };

  // What is still to buy (not ticked "have"), one item per line under aisle headings, ready to paste into Google Keep.
  const copyForKeep = async () => {
    const ok = await copyText(buildKeepText(items));
    flash(ok ? 'Copied. Open Google Keep, start a new list or note and paste.' : 'Could not copy. Try the Share button or print instead.');
  };
  const shareToKeep = async () => {
    const ok = await shareText('Thanksgiving shopping list', buildKeepText(items));
    if (ok) flash('Shared. Choose Keep in the share sheet to save it as a note.');
  };

  const guard = (fn) => async () => {
    try {
      setError('');
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };

  const rebuild = async () => {
    if (!window.confirm('Rebuild the list from the recipes? Your ticks are kept for items that stay on the list.')) return;
    setBusy(true);
    await guard(() => rebuildShopping(eventId, dishes))();
    setBusy(false);
  };

  if (items === null) return <p>Loading shopping list…</p>;

  if (items.length === 0) {
    return (
      <div>
        {error && <p className="error">{error}</p>}
        <p className="muted">No shopping list yet. The owner builds it by importing the menu file on the Plan tab.</p>
      </div>
    );
  }

  const have = items.filter((i) => i.have);
  const need = items.filter((i) => !i.have);
  const inCart = need.filter((i) => i.checked);

  if (preview) {
    return (
      <PrintShell
        title={preview === 'store' ? 'Shopping list: still to buy' : 'Shopping list: everything'}
        onClose={() => setPreview(null)}
      >
        <ShoppingPrint items={items} mode={preview} />
      </PrintShell>
    );
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      <p>
        <button className={`tab ${mode === 'pantry' ? 'active' : 'secondary'}`} onClick={() => setMode('pantry')}>
          1. What I already have
        </button>
        <button className={`tab ${mode === 'store' ? 'active' : 'secondary'}`} onClick={() => setMode('store')}>
          2. Store list
        </button>
        {canEdit && (
          <button className="secondary" disabled={busy} onClick={rebuild}>
            Rebuild from recipes
          </button>
        )}
      </p>
      <p className="share-row">
        <button className="secondary" onClick={copyForKeep}>
          Copy for Google Keep
        </button>
        {canShare() && (
          <button className="secondary" onClick={shareToKeep}>
            Share…
          </button>
        )}
        <button className="secondary" onClick={() => setPreview('store')}>
          🖨 Print what's left
        </button>
        <button className="secondary" onClick={() => setPreview('full')}>
          🖨 Print everything
        </button>
        {note && <span className="muted">{note}</span>}
      </p>

      {mode === 'pantry' ? (
        <>
          <p className="muted">
            Tick everything you already have at home. {have.length} of {items.length} ticked.
            {!canEdit && ' Only cooks and the owner can change this.'}
          </p>
          <Aisles
            items={items}
            renderRow={(list) =>
              list.map((i) => (
                <Row
                  key={i.id}
                  item={i}
                  checked={!!i.have}
                  disabled={!canEdit}
                  label={i.dishes.join(', ')}
                  onToggle={guard(() => updateShoppingItem(eventId, i.id, { have: !i.have }))}
                />
              ))
            }
          />
        </>
      ) : (
        <>
          <p className="muted">
            {inCart.length} of {need.length} in the cart. {have.length} items skipped because you have them.
          </p>
          <Aisles
            items={need}
            renderRow={(list) =>
              [...list.filter((i) => !i.checked), ...list.filter((i) => i.checked)].map((i) => (
                <Row
                  key={i.id}
                  item={i}
                  checked={!!i.checked}
                  disabled={false}
                  label={i.dishes.join(', ')}
                  onToggle={guard(() => updateShoppingItem(eventId, i.id, { checked: !i.checked }))}
                />
              ))
            }
          />
        </>
      )}
    </div>
  );
}
