import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';
import seed from './seed/seed-2025.json';
import { shiftSeed } from './scheduler/seed.js';

const eventId = (year) => `thanksgiving-${year}`;

const withId = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** All events, newest year first. */
export async function fetchEvents() {
  const snap = await getDocs(collection(db, 'events'));
  return withId(snap).sort((a, b) => (b.year || 0) - (a.year || 0));
}

/** One event's meals, dishes and steps. */
export async function fetchEventDetail(id) {
  const [meals, dishes, steps] = await Promise.all(
    ['meals', 'dishes', 'steps'].map(async (sub) => withId(await getDocs(collection(db, 'events', id, sub)))),
  );
  return { meals, dishes, steps };
}

/**
 * Owner-only: write the shifted 2025 seed as a new event. Refuses to overwrite an
 * existing event so hand edits are never lost.
 */
export async function loadSampleEvent(year, ownerUid) {
  const id = eventId(year);
  const ref = doc(db, 'events', id);
  if ((await getDoc(ref)).exists()) {
    throw new Error(`Event ${id} already exists. Delete it in the Firebase console to reload.`);
  }
  const s = shiftSeed(seed, year);
  const batch = writeBatch(db);
  batch.set(ref, { ...s.event, ownerUid, createdAt: serverTimestamp() });
  const put = (sub, { id: docId, ...data }) => batch.set(doc(db, 'events', id, sub, docId), data);
  s.meals.forEach((m) => put('meals', m));
  s.dishes.forEach((d) => put('dishes', d));
  s.steps.forEach((st) => put('steps', st));
  await batch.commit();
  return id;
}
