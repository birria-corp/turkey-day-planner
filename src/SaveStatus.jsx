import React from 'react';
import { useSaveStatus } from './saveStatus.js';

/** Small status line in the header: everything saved, saving, or offline with changes waiting. */
export default function SaveStatus() {
  const { pending, online } = useSaveStatus();
  let text = '✓ All changes saved';
  let cls = 'ok';
  if (!online) {
    cls = 'warn';
    text = pending > 0 ? `Offline: ${pending} change${pending === 1 ? '' : 's'} will sync when you reconnect` : 'Offline';
  } else if (pending > 0) {
    cls = 'busy';
    text = 'Saving…';
  }
  return (
    <div className={`save-status ${cls}`} role="status">
      {text}
    </div>
  );
}
