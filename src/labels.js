// Block labels: dish emoji + a marker for the kind of work, then the description.
import { addMinutes, dayKey, fmtTime, parseStamp } from './scheduler/time.js';

export const KIND_MARKER = { prep: '🔪', assemble: '🧩', cook: '🔥', rest: '⏲️', event: '🛒' };
export const KIND_NAME = { prep: 'Prep', assemble: 'Assemble', cook: 'Cook', rest: 'Rest', event: 'Errand' };
export const RESOURCE_NAME = {
  oven: 'Oven', stovetop: 'Stovetop', smoker: 'Smoker', fridge: 'Fridge', hands: 'By hand', none: 'None',
};

/** prep | assemble | cook | rest | event. Older steps without a kind are guessed from their resource. */
export function stepKind(step) {
  if (step.kind) return step.kind;
  if (!step.dishId) return 'event';
  if (step.resource === 'none') return 'rest';
  if (step.resource === 'hands') return 'prep';
  return 'cook';
}

/** Which column a step sits in on a busy day: prep (also assemble, rest, errands), stove, or oven. */
export function laneOf(step) {
  const kind = stepKind(step);
  if (kind !== 'cook') return 'prep';
  if (step.resource === 'oven') return 'oven';
  if (step.resource === 'stovetop' || step.resource === 'smoker') return 'stove';
  return 'prep';
}

/** "🦃 🔥 Roast": dish emoji, kind marker, description. */
export function stepLabel(step, dish) {
  return [dish && dish.emoji, KIND_MARKER[stepKind(step)], step.text].filter(Boolean).join(' ');
}

const APPLIANCE = { oven: 'Oven', stovetop: 'Stovetop', smoker: 'Smoker', fridge: 'Fridge' };

/**
 * Text for a grid block. line1: "🦃 🔥 Cook · Oven". line2: the dish name ("Turkey with Gravy").
 * Errands keep their own text. `icons` is just the emoji and marker (for very narrow blocks).
 * `full` is the whole description for hover text.
 */
export function blockText(step, dish) {
  const kind = stepKind(step);
  const full = stepLabel(step, dish);
  if (kind === 'event') return { line1: `${KIND_MARKER.event} ${step.text}`, icons: KIND_MARKER.event, line2: '', full };
  const appliance = kind === 'cook' ? APPLIANCE[step.resource] : '';
  const word = appliance ? `${KIND_NAME[kind]} · ${appliance}` : KIND_NAME[kind];
  const icons = [dish && dish.emoji, KIND_MARKER[kind]].filter(Boolean).join(' ');
  return {
    line1: [icons, word].filter(Boolean).join(' '),
    icons, // emoji + marker only, for blocks too narrow for words
    line2: dish ? dish.title : '',
    full,
  };
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
