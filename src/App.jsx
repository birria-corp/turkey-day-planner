import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, signIn, signOutUser, watchAuth, finishRedirect } from './firebase.js';
import EventView from './EventView.jsx';
import SaveStatus from './SaveStatus.jsx';
import { pendingCount } from './saveStatus.js';

// Same uid pinned in firestore.rules. A uid is not a secret; rules enforce access.
const OWNER_UID = 'enVCX2fxmbMOHfPSOHcWBdvtgZi1';
const VERSION = 'v0.10.0';

/**
 * Green header: "Turkey Day Planner - 2026" (the year of the dinner) with the version under it.
 * Right side, stacked: signed in as, sign out, access, settings gear (owner).
 */
function Header({ user, role, year, settingsOpen, onToggleSettings }) {
  return (
    <header className="banner">
      <div className="banner-left">
        <h1>Turkey Day Planner{year ? ` - ${year}` : ''}</h1>
        <div className="version">{VERSION}</div>
        {user && <SaveStatus />}
      </div>
      {user && (
        <div className="banner-right">
          <div>
            Signed in as <strong>{user.displayName}</strong>
          </div>
          <button className="linklike" onClick={() => signOutUser()}>
            Sign out
          </button>
          {role && (
            <div>
              Access: <strong>{role}</strong>
            </div>
          )}
          {role === 'owner' && (
            <button
              className={`icon-btn${settingsOpen ? ' active' : ''}`}
              onClick={onToggleSettings}
              aria-label="Settings"
              title="Settings"
            >
              ⚙️
            </button>
          )}
        </div>
      )}
    </header>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [member, setMember] = useState(undefined); // undefined = unknown, null = not approved, object = approved
  const [requested, setRequested] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [eventYear, setEventYear] = useState(null); // year of the dinner, reported by the planner
  const [error, setError] = useState('');
  const [memberFailed, setMemberFailed] = useState(false); // membership lookup failed (offline), not "not approved"
  const [memberTry, setMemberTry] = useState(0); // bump to retry the lookup

  useEffect(() => {
    finishRedirect().catch((e) => setError(e.message));
    return watchAuth(setUser);
  }, []);

  // Ask before closing the tab while a change has not reached Firebase yet.
  useEffect(() => {
    const warn = (e) => {
      if (pendingCount() > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Look up this user's membership once signed in.
  useEffect(() => {
    if (!user) {
      setMember(undefined);
      setRequested(false);
      setSettingsOpen(false);
      return;
    }
    if (user.uid === OWNER_UID) {
      setMember({ role: 'owner' });
      return;
    }
    setMemberFailed(false);
    getDoc(doc(db, 'members', user.uid))
      .then((snap) => setMember(snap.exists() ? snap.data() : null))
      .catch(() => {
        setMember(null);
        setMemberFailed(true);
      });
  }, [user, memberTry]);

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
    return <main className="page"><p>Loading…</p></main>;
  }

  if (user === null) {
    return (
      <main className="page">
        <Header />
        <button onClick={() => signIn().catch((e) => setError(e.message))}>Sign in with Google</button>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  return (
    <main className={member ? 'page wide' : 'page'}>
      <Header
        user={user}
        role={member ? member.role : ''}
        year={eventYear}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
      />
      {member ? (
        <EventView
          isOwner={member.role === 'owner'}
          canEdit={member.role === 'owner' || member.role === 'cook'}
          ownerUid={OWNER_UID}
          settingsOpen={settingsOpen}
          onCloseSettings={() => setSettingsOpen(false)}
          onEventYear={setEventYear}
        />
      ) : memberFailed ? (
        <>
          <p className="error">Could not check your access. This is usually a weak connection, not a problem with your account.</p>
          <p>
            <button onClick={() => setMemberTry((n) => n + 1)}>Try again</button>
          </p>
        </>
      ) : (
        <>
          <p>You are not approved yet. Send this ID to Spencer, or request access:</p>
          <code style={{ wordBreak: 'break-all' }}>{user.uid}</code>
          <p>
            <button onClick={requestAccess} disabled={requested}>
              {requested ? 'Request sent' : 'Request access'}
            </button>
          </p>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
