import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.js';
import seed from './seed/seed-2025.json';
import { shiftSeed } from './scheduler/seed.js';
import { toEventDocs, validateImport } from './importer.js';
import { buildShoppingList } from './shopping.js';
import { track } from './saveStatus.js';

const SUBS = ['meals', 'dishes', 'steps', 'shopping'];
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
    ['meals', 'dishes', 'steps'].map(async (sub) => withId(await getDocs(collection(db, 'events', id, sub)))),
  );
  return { meals, dishes, steps };
}

/**
 * Live meals, dishes and steps for one event: calls onData again whenever anyone changes anything
 * (including the person's own edits, instantly). Returns the unsubscribe function.
 */
export function subscribeEventDetail(id, onData, onError) {
  const state = { meals: null, dishes: null, steps: null };
  const emit = () => {
    if (state.meals && state.dishes && state.steps) onData({ ...state });
  };
  const stops = SUBS.slice(0, 3).map((sub) =>
    onSnapshot(
      collection(db, 'events', id, sub),
      (snap) => {
        state[sub] = withId(snap);
        emit();
      },
      onError,
    ),
  );
  return () => stops.forEach((stop) => stop());
}

/** The people who can be given a dish (the dropdown list). Owner only, by the rules. */
export function updateEventCooks(id, cooks) {
  return track(updateDoc(doc(db, 'events', id), { cooks }));
}

/** The shopping docs once (for backups). */
export async function fetchShopping(id) {
  return withId(await getDocs(collection(db, 'events', id, 'shopping')));
}

/** Delete an event and everything under it. Caller must confirm first. */
export async function deleteEvent(id) {
  const batch = writeBatch(db);
  for (const sub of SUBS) {
    const snap = await getDocs(collection(db, 'events', id, sub));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, 'events', id));
  await track(batch.commit());
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
  await track(batch.commit());
  return id;
}

/**
 * Owner-only: replace an event with the contents of a menu file or a backup file (meals, dishes
 * with recipes, steps, and a shopping list). A backup also restores the shopping ticks.
 * Caller must confirm first.
 */
export async function importEvent(data, ownerUid) {
  const errors = validateImport(data);
  if (errors.length) throw new Error(`Menu file problems: ${errors.slice(0, 5).join('; ')}`);
  const docs = toEventDocs(data);
  const id = eventId(docs.event.year);
  const ref = doc(db, 'events', id);
  if ((await getDoc(ref)).exists()) await deleteEvent(id);

  const state = data.shoppingState || {};
  const batch = writeBatch(db);
  batch.set(ref, { ...docs.event, ownerUid, createdAt: serverTimestamp() });
  const put = (sub, { id: docId, ...rest }) => batch.set(doc(db, 'events', id, sub, docId), rest);
  docs.meals.forEach((m) => put('meals', m));
  docs.dishes.forEach((d) => put('dishes', d));
  docs.steps.forEach((s) => put('steps', s));
  docs.shopping.forEach((s) =>
    put('shopping', { ...s, have: !!(state[s.id] && state[s.id].have), checked: !!(state[s.id] && state[s.id].checked) }),
  );
  await track(batch.commit());
  return id;
}

/** Assign a cook to a dish. Allowed for cooks and owner by the rules. */
export function updateDishCook(id, dishId, cookName) {
  return track(updateDoc(doc(db, 'events', id, 'dishes', dishId), { cookName }));
}

/** Change one step (start time, length, description, resource). Cooks and owner only, by the rules. */
export function updateStep(id, stepId, patch) {
  return track(updateDoc(doc(db, 'events', id, 'steps', stepId), patch));
}

/** Add a step. Returns its new id. */
export async function addStep(id, step) {
  const ref = await track(addDoc(collection(db, 'events', id, 'steps'), step));
  return ref.id;
}

export function deleteStep(id, stepId) {
  return track(deleteDoc(doc(db, 'events', id, 'steps', stepId)));
}

/** Move a dinner: set its serve time and the new start times of its dishes' steps, all or nothing. */
export async function moveMeal(id, mealId, serveAt, patches) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'events', id, 'meals', mealId), { serveAt });
  patches.forEach((p) => batch.update(doc(db, 'events', id, 'steps', p.id), { startAt: p.startAt }));
  await track(batch.commit());
}

/** Change how many times a recipe is multiplied. Rebuild the shopping list afterwards. */
export function updateDishScale(id, dishId, scale) {
  return track(updateDoc(doc(db, 'events', id, 'dishes', dishId), { scale }));
}

/** Spencer's own notes on a recipe (kept apart from the recipe's source notes). Cooks and owner only. */
export function updateDishNotes(id, dishId, myNotes) {
  return track(updateDoc(doc(db, 'events', id, 'dishes', dishId), { myNotes }));
}

/** Live shopping list. Returns the unsubscribe function. */
export function subscribeShopping(id, onData, onError) {
  return onSnapshot(collection(db, 'events', id, 'shopping'), (snap) => onData(withId(snap)), onError);
}

/** Tick "have it" (cooks, owner) or "in cart" (any member). */
export function updateShoppingItem(id, itemId, patch) {
  return track(updateDoc(doc(db, 'events', id, 'shopping', itemId), patch));
}

/** Recompute the list from the dishes, keeping each line's have/in-cart ticks. */
export async function rebuildShopping(id, dishes) {
  // Never rebuild from an empty dish list (page still loading): it would wipe every tick.
  if (!dishes || dishes.length === 0) throw new Error('Dishes have not loaded yet. Wait a moment and try again.');
  const existing = withId(await getDocs(collection(db, 'events', id, 'shopping')));
  const old = Object.fromEntries(existing.map((i) => [i.id, i]));
  const items = buildShoppingList(dishes);
  const keep = new Set(items.map((i) => i.id));
  const batch = writeBatch(db);
  items.forEach(({ id: itemId, family, ...item }) => {
    // Existing lines: merge and leave have/checked alone, so a tick made by someone else
    // while this runs is not reverted. New lines start unticked.
    const fresh = old[itemId] ? {} : { have: false, checked: false };
    batch.set(doc(db, 'events', id, 'shopping', itemId), { ...item, ...fresh }, { merge: true });
  });
  existing.filter((i) => !keep.has(i.id)).forEach((i) => batch.delete(doc(db, 'events', id, 'shopping', i.id)));
  await track(batch.commit());
}
