// Block labels: dish emoji + a marker for the kind of work, then the description.
import { addMinutes, dayKey, fmtTime, parseStamp } from './scheduler/time.js';

export const KIND_MARKER = { prep: '🔪', cook: '🔥', rest: '⏲️', event: '🛒' };
export const KIND_NAME = { prep: 'Prep', cook: 'Cook', rest: 'Rest', event: 'Errand' };

/** prep | cook | rest | event. Older steps without a kind are guessed from their resource. */
export function stepKind(step) {
  if (step.kind) return step.kind;
  if (!step.dishId) return 'event';
  if (step.resource === 'none') return 'rest';
  if (step.resource === 'hands') return 'prep';
  return 'cook';
}

/** "🦃 🔥 Roast": dish emoji, kind marker, description. */
export function stepLabel(step, dish) {
  return [dish && dish.emoji, KIND_MARKER[stepKind(step)], step.text].filter(Boolean).join(' ');
}

const RESOURCE_NAME = { oven: 'Oven', stovetop: 'Stovetop', smoker: 'Smoker', fridge: 'Fridge' };

/**
 * Short label for the grid: "🦃 🔪 Prep", "🥔 🔥 Cook · Stovetop", "⏲️ Rest". Errands keep their
 * text ("Shopping"). The full description shows on hover, in the Timeline and in the Menu tab.
 */
export function shortLabel(step, dish) {
  const kind = stepKind(step);
  if (kind === 'event') return [KIND_MARKER.event, step.text].join(' ');
  const resource = kind === 'cook' ? RESOURCE_NAME[step.resource] : '';
  const word = resource ? `${KIND_NAME[kind]} · ${resource}` : KIND_NAME[kind];
  return [dish && dish.emoji, KIND_MARKER[kind], word].filter(Boolean).join(' ');
}

/** 40 -> "40 min", 150 -> "2 hr 30 min", 1365 -> "22 hr 45 min". */
export function fmtDuration(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

const fmtDay = (stamp) =>
  parseStamp(stamp).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

/** "Wed, 11/25 5:00 PM – 5:40 PM", or "Mon, 11/23 9:00 AM → Wed, 11/25 11:30 AM" across days. */
export function fmtRange(startAt, durationMin) {
  const end = addMinutes(startAt, durationMin);
  if (dayKey(startAt) === dayKey(end)) return `${fmtDay(startAt)} ${fmtTime(startAt)} – ${fmtTime(end)}`;
  return `${fmtDay(startAt)} ${fmtTime(startAt)} → ${fmtDay(end)} ${fmtTime(end)}`;
}
