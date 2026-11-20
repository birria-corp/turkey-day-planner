/** Copy text to the clipboard. Uses the modern API, with an older fallback for stricter browsers. Returns true on success. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the older method */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** True when the phone's share sheet is available (HTTPS, mobile browsers). */
export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** Open the share sheet with some text. Returns false if the person closed it or it is unavailable. */
export async function shareText(title, text) {
  if (!canShare()) return false;
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}
