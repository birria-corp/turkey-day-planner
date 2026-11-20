import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.js';
import seed from './seed/seed-2025.json';
import { shiftSeed } from './scheduler/seed.js';

const SUBS = ['meals', 'dishes', 'steps'];
export const eventId = (year) => `thanksgiving-${year}`;

const withId = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** All events, newest year first. */
export async function fetchEvents() {
  const snap = await getDocs(collection(db, 'events'));
  return withId(snap).sort((a, b) => (b.year || 0) - (a.year || 0));
}

/** One event's meals, dishes and steps. */
export async function fetchEventDetail(id) {
  const [meals, dishes, steps] = await Promise.all(
    SUBS.map(async (sub) => withId(await getDocs(collection(db, 'events', id, sub)))),
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
    throw new Error(`Event ${id} already exists. Use Replace sample event to reload it.`);
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

/** Delete an event and its meals, dishes and steps. Caller must confirm first. */
export async function deleteEvent(id) {
  const batch = writeBatch(db);
  for (const sub of SUBS) {
    const snap = await getDocs(collection(db, 'events', id, sub));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, 'events', id));
  await batch.commit();
}

/** Assign a cook to a dish. Allowed for cooks and owner by the rules. */
export function updateDishCook(id, dishId, cookName) {
  return updateDoc(doc(db, 'events', id, 'dishes', dishId), { cookName });
}
