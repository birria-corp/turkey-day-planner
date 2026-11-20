import React, { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/** Owner-only panel: approve access requests, set cook/viewer, remove members. */
export default function Admin({ ownerUid }) {
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rSnap, mSnap] = await Promise.all([
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'members')),
      ]);
      setRequests(rSnap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((r) => r.uid !== ownerUid));
      setMembers(mSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [ownerUid]);

  useEffect(() => {
    load();
  }, [load]);

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

  const approve = (r, role) =>
    run(async () => {
      await setDoc(doc(db, 'members', r.uid), { role, name: r.name || '', approvedAt: serverTimestamp() });
      await deleteDoc(doc(db, 'requests', r.uid));
    });

  const deny = (r) => run(() => deleteDoc(doc(db, 'requests', r.uid)));

  const setRole = (m, role) =>
    run(() => setDoc(doc(db, 'members', m.uid), { role, name: m.name || '', approvedAt: m.approvedAt || serverTimestamp() }));

  const remove = (m) => {
    if (!window.confirm(`Remove ${m.name || m.uid}?`)) return;
    run(() => deleteDoc(doc(db, 'members', m.uid)));
  };

  return (
    <section>
      <h2>Admin</h2>
      {error && <p className="error">{error}</p>}

      <h3>Access requests ({requests.length})</h3>
      {requests.length === 0 && <p className="muted">No pending requests.</p>}
      {requests.map((r) => (
        <div key={r.uid} className="card">
          <strong>{r.name || '(no name)'}</strong>
          <div className="sub">{r.email}</div>
          <div className="actions">
            <button disabled={busy} onClick={() => approve(r, 'cook')}>Approve as cook</button>
            <button disabled={busy} onClick={() => approve(r, 'viewer')}>Approve as viewer</button>
            <button className="secondary" disabled={busy} onClick={() => deny(r)}>Deny</button>
          </div>
        </div>
      ))}

      <h3>Family members ({members.length})</h3>
      {members.length === 0 && <p className="muted">No members yet.</p>}
      {members.map((m) => (
        <div key={m.uid} className="card">
          <strong>{m.name || m.uid}</strong> <span className="muted">({m.role})</span>
          <div className="actions">
            {m.role !== 'cook' && <button disabled={busy} onClick={() => setRole(m, 'cook')}>Make cook</button>}
            {m.role !== 'viewer' && <button disabled={busy} onClick={() => setRole(m, 'viewer')}>Make viewer</button>}
            <button className="secondary" disabled={busy} onClick={() => remove(m)}>Remove</button>
          </div>
        </div>
      ))}
      <p><button className="secondary" disabled={busy} onClick={load}>Refresh</button></p>
    </section>
  );
}
