// Tracks writes that Firebase has not confirmed yet, so the header can say "Saving…" or
// "Offline: N changes will sync". A write's promise only finishes once the server has it;
// while the phone is offline the edit waits on the device and uploads when it reconnects.

import { useEffect, useState } from 'react';

let pending = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

/** Wrap a Firestore write: counts it as unsaved until it finishes (or fails). Returns the same result. */
export function track(promise) {
  pending += 1;
  emit();
  return Promise.resolve(promise).finally(() => {
    pending -= 1;
    emit();
  });
}

export const pendingCount = () => pending;

/** { pending, online } for the header. */
export function useSaveStatus() {
  const [, tick] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const onChange = () => tick((n) => n + 1);
    listeners.add(onChange);
    const goOn = () => setOnline(true);
    const goOff = () => setOnline(false);
    window.addEventListener('online', goOn);
    window.addEventListener('offline', goOff);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener('online', goOn);
      window.removeEventListener('offline', goOff);
    };
  }, []);
  return { pending, online };
}
