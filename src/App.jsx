import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, signIn, signOutUser, watchAuth, finishRedirect } from './firebase.js';
import { thanksgivingDate, eventRange } from './scheduler/dates.js';
import Admin from './Admin.jsx';

// Same uid pinned in firestore.rules. A uid is not a secret; rules enforce access.
const OWNER_UID = 'enVCX2fxmbMOHfPSOHcWBdvtgZi1';
const VERSION = 'v0.3.0';

const fmt = (d) =>
  d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const page = { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 640, margin: '0 auto' };
const btn = { padding: '10px 16px', fontSize: 16, borderRadius: 6, border: '1px solid #888', cursor: 'pointer' };

function Header() {
  const year = new Date().getFullYear();
  const t = thanksgivingDate(year);
  const { start, end } = eventRange(year);
  return (
    <>
      <h1>Turkey Day Planner</h1>
      <p>Thanksgiving {year}: {fmt(t)}</p>
      <p>Default planning week: {fmt(start)} to {fmt(end)}</p>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [member, setMember] = useState(undefined); // undefined = unknown, null = not approved, object = approved
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    finishRedirect().catch((e) => setError(e.message));
    return watchAuth(setUser);
  }, []);

  // Look up this user's membership once signed in.
  useEffect(() => {
    if (!user) {
      setMember(undefined);
      setRequested(false);
      return;
    }
    if (user.uid === OWNER_UID) {
      setMember({ role: 'owner' });
      return;
    }
    getDoc(doc(db, 'members', user.uid))
      .then((snap) => setMember(snap.exists() ? snap.data() : null))
      .catch(() => setMember(null));
  }, [user]);

  async function requestAccess() {
    try {
      await setDoc(doc(db, 'requests', user.uid), {
        name: user.displayName || '',
        email: user.email || '',
        requestedAt: serverTimestamp(),
      });
      setRequested(true);
    } catch (e) {
      setError(e.message);
    }
  }

  if (user === undefined) {
    return <main style={page}><p>Loading…</p></main>;
  }

  if (user === null) {
    return (
      <main style={page}>
        <Header />
        <button style={btn} onClick={() => signIn().catch((e) => setError(e.message))}>
          Sign in with Google
        </button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <p style={{ color: '#666' }}>{VERSION}</p>
      </main>
    );
  }

  return (
    <main style={page}>
      <Header />
      <p>Signed in as <strong>{user.displayName}</strong></p>
      {member ? (
        <>
          <p>Access: <strong>{member.role}</strong>. The planner is coming next.</p>
          {member.role === 'owner' && <Admin ownerUid={OWNER_UID} />}
        </>
      ) : (
        <>
          <p>You are not approved yet. Send this ID to Spencer, or request access:</p>
          <code style={{ wordBreak: 'break-all' }}>{user.uid}</code>
          <p>
            <button style={btn} onClick={requestAccess} disabled={requested}>
              {requested ? 'Request sent' : 'Request access'}
            </button>
          </p>
        </>
      )}
      <p><button style={btn} onClick={() => signOutUser()}>Sign out</button></p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <p style={{ color: '#666' }}>{VERSION}</p>
    </main>
  );
}
