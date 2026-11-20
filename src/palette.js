// Dish colors: a background and a readable text color per swatch. Spencer picks a
// swatch per dish in the recipe editor (step 3); until then a placeholder is used.

export const PALETTE = {
  cream: { bg: '#f6e7bf', fg: '#4a3b22' },
  brown: { bg: '#7a4a22', fg: '#fff6e8' },
  mustard: { bg: '#c29a2b', fg: '#2f2410' },
  lightSage: { bg: '#a9c497', fg: '#26331f' },
  forest: { bg: '#4f6b3a', fg: '#f4f8ee' },
  coral: { bg: '#d9776b', fg: '#2e1410' },
  gold: { bg: '#ebbe45', fg: '#34280a' },
  paleSage: { bg: '#c9dabb', fg: '#26331f' },
  orange: { bg: '#e88f3a', fg: '#2e1a06' },
  maroon: { bg: '#7a2e2a', fg: '#ffedea' },
  olive: { bg: '#8a8f4f', fg: '#1f2210' },
  terracotta: { bg: '#b8603d', fg: '#fff1e8' },
};

// Non-dish items (shopping trip).
export const EVENT_COLOR = { bg: '#8fb07a', fg: '#1e2b17' };

const KEYS = Object.keys(PALETTE);

// Placeholder colors for the sample event, modeled on the 2025 sheet.
// Remove once dishes carry their own `color`.
const SAMPLE_COLORS = {
  mashed: 'cream',
  'turkey-thu': 'brown',
  stuffing: 'mustard',
  sprouts: 'lightSage',
  salad: 'forest',
  cranberry: 'coral',
  lasagna: 'gold',
  'turkey-sat': 'brown',
  greenbeans: 'paleSage',
  stock: 'brown',
  gratin: 'orange',
  wellington: 'maroon',
};

/** Color for a dish: its saved swatch, else the sample placeholder, else a cycled one. */
export function dishColor(dish, index = 0) {
  const key = dish.color || SAMPLE_COLORS[dish.id] || KEYS[index % KEYS.length];
  return PALETTE[key] || PALETTE[KEYS[0]];
}

/** Dishes in display order: saved `order`, then title. */
export function sortDishes(dishes) {
  return [...dishes].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.title || '').localeCompare(b.title || ''),
  );
}
