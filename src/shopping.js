// Shopping list math. Pure functions: no Firestore, no React.
// Recipes store the ORIGINAL amounts plus a scale factor; the list multiplies them,
// then adds the same ingredient across dishes (teaspoons, tablespoons and cups
// are added together, ounces and pounds are added together).

const VOL = { tsp: 1, tbsp: 3, cup: 48, qt: 192 }; // in teaspoons
const WT = { oz: 1, lb: 16 }; // in ounces

export const AISLE_ORDER = [
  'Produce', 'Meat', 'Dairy', 'Frozen', 'Canned', 'Pantry', 'Baking', 'Spices', 'Wine', 'Specialty', 'Equipment', 'Other',
];

// Like items sit next to each other inside an aisle: Produce is split into fruit, herbs,
// greens and so on. A recipe can set `group` on an ingredient; otherwise it is guessed from the name.
export const GROUP_ORDER = {
  Produce: ['Fruit & citrus', 'Herbs', 'Leafy greens', 'Roots & alliums', 'Other vegetables'],
  Dairy: ['Milk & cream', 'Yogurt', 'Cheese', 'Eggs & butter'],
  Pantry: ['Oils & vinegars', 'Stocks & broths', 'Sweeteners & syrups', 'Condiments & sauces', 'Nuts & crunchy', 'Other pantry'],
  Baking: ['Flour & meal', 'Sugar', 'Leaveners'],
  Spices: ['Salt & pepper', 'Spices & dried herbs'],
};

const GROUP_RULES = [
  ['Produce', 'Herbs', /\b(thyme|rosemary|mint|cilantro|parsley|basil|chives|dill|sage)\b/i],
  ['Produce', 'Fruit & citrus', /\b(apples?|lemons?|oranges?|limes?|cranberr\w*|pears?)\b/i],
  ['Produce', 'Leafy greens', /\b(spinach|lettuce|kale|arugula|chard|greens)\b/i],
  ['Produce', 'Roots & alliums', /\b(potato|potatoes|carrots?|onions?|shallots?|garlic|ginger|leeks?|beets?|turnips?|parsnips?)\b/i],
  ['Dairy', 'Yogurt', /yogurt|buttermilk/i],
  ['Dairy', 'Cheese', /cheese|paneer|pecorino|parmigiano|gruyere|comte|cheddar/i],
  ['Dairy', 'Eggs & butter', /\b(eggs?|butter)\b/i],
  ['Dairy', 'Milk & cream', /\b(milk|cream)\b/i],
  ['Pantry', 'Oils & vinegars', /\b(oil|vinegar|soy sauce)\b/i],
  ['Pantry', 'Stocks & broths', /\b(stock|broth)\b/i],
  ['Pantry', 'Sweeteners & syrups', /\b(honey|maple|syrup)\b/i],
  ['Pantry', 'Condiments & sauces', /\b(mustard|paste|ketchup|sauce)\b/i],
  ['Pantry', 'Nuts & crunchy', /\b(almonds?|nuts?|crispy)\b/i],
  ['Baking', 'Flour & meal', /\b(flour|cornmeal|meal)\b/i],
  ['Baking', 'Sugar', /\bsugar\b/i],
  ['Baking', 'Leaveners', /baking (powder|soda)/i],
  ['Spices', 'Salt & pepper', /\b(salt|pepper)\b/i],
];

const GROUP_DEFAULT = {
  Produce: 'Other vegetables',
  Pantry: 'Other pantry',
  Spices: 'Spices & dried herbs',
};

/** Sub-group for an item within its aisle ('' when the aisle has none). */
export function inferGroup(aisle, name) {
  const hit = GROUP_RULES.find(([a, , re]) => a === aisle && re.test(name));
  return hit ? hit[1] : GROUP_DEFAULT[aisle] || '';
}

export const groupOf = (item) => item.group || inferGroup(item.aisle, item.name);

const groupRank = (aisle, group) => {
  const i = (GROUP_ORDER[aisle] || []).indexOf(group);
  return i === -1 ? 99 : i;
};

const PLURAL = {
  clove: 'cloves', stalk: 'stalks', sprig: 'sprigs', can: 'cans', box: 'boxes', head: 'heads',
  bunch: 'bunches', handful: 'handfuls', sheet: 'sheets', bag: 'bags', jar: 'jars', bottle: 'bottles', inch: 'inches',
};

const familyOf = (unit) => (unit in VOL ? 'vol' : unit in WT ? 'wt' : unit || '');

/** Quantity after applying a dish's scale. Items with scale:false (equipment, egg wash) never scale. */
export function scaleQty(ing, scale = 1) {
  if (ing.qty == null) return null;
  return ing.scale === false ? ing.qty : ing.qty * scale;
}

const FRACTIONS = { 0.125: '1/8', 0.25: '1/4', 0.375: '3/8', 0.5: '1/2', 0.625: '5/8', 0.75: '3/4', 0.875: '7/8' };

/** 1.5 -> "1 1/2", 0.25 -> "1/4". Rounds to the nearest eighth. */
export function fmtQty(q) {
  if (q == null || Number.isNaN(q)) return '';
  let rounded = Math.round(q * 8) / 8;
  if (q > 0 && rounded === 0) rounded = 0.125;
  const whole = Math.floor(rounded);
  const frac = FRACTIONS[rounded - whole] || '';
  if (whole === 0 && frac) return frac;
  return frac ? `${whole} ${frac}` : String(whole);
}

/** Total teaspoons -> "1 1/2 cups", "1 cup + 2 tbsp", "3/4 tsp". */
export function fmtVolume(totalTsp) {
  const t = Math.round(totalTsp * 4) / 4;
  if (t >= 12 && t % 12 === 0) {
    const cups = t / 48;
    return `${fmtQty(cups)} ${cups > 1 ? 'cups' : 'cup'}`;
  }
  // Whole and half tablespoons read better as "1 1/2 tbsp" than "1 tbsp + 1 1/2 tsp".
  if (t >= 3 && t < 48 && t % 1.5 === 0) return `${fmtQty(t / 3)} tbsp`;
  const cups = Math.floor(t / 48);
  let rem = t - cups * 48;
  const tbsp = Math.floor(rem / 3);
  rem -= tbsp * 3;
  const parts = [];
  if (cups) parts.push(`${cups} ${cups > 1 ? 'cups' : 'cup'}`);
  if (tbsp) parts.push(`${tbsp} tbsp`);
  if (rem) parts.push(`${fmtQty(rem)} tsp`);
  return parts.join(' + ') || '0';
}

/** Total ounces -> "1 lb 5 oz", "12 oz". */
export function fmtWeight(totalOz) {
  const t = Math.round(totalOz * 2) / 2;
  const lb = Math.floor(t / 16);
  const oz = t - lb * 16;
  const parts = [];
  if (lb) parts.push(`${lb} lb`);
  if (oz) parts.push(`${fmtQty(oz)} oz`);
  return parts.join(' ') || '0';
}

function fmtCount(qty, unit) {
  if (!unit) return fmtQty(qty);
  const word = qty > 1 && PLURAL[unit] ? PLURAL[unit] : unit;
  return `${fmtQty(qty)} ${word}`;
}

/** Stable Firestore-safe id for one list line. */
export function shoppingId(name, family) {
  return `${name}--${family}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Combine every dish's ingredients into one list.
 * @returns {{id,name,aisle,family,qty,qtyText,dishes,note}[]} sorted by aisle then name.
 */
export function buildShoppingList(dishes) {
  const map = new Map();
  for (const dish of dishes) {
    const scale = dish.scale ?? 1;
    for (const ing of dish.ingredients || []) {
      const unit = ing.unit || '';
      const family = familyOf(unit);
      const id = shoppingId(ing.name, family);
      let item = map.get(id);
      if (!item) {
        item = { id, name: ing.name, aisle: ing.aisle || 'Other', family, unit, qty: null, dishes: [], notes: [] };
        map.set(id, item);
      }
      const qty = scaleQty(ing, scale);
      if (qty != null) item.qty = (item.qty || 0) + toBase(qty, unit);
      if (!item.dishes.includes(dish.title)) item.dishes.push(dish.title);
      if (ing.note && !item.notes.includes(ing.note)) item.notes.push(ing.note);
    }
  }

  const items = [...map.values()].map((i) => {
    let qty = i.qty;
    // Whole things (cloves, cans, lemons) are bought whole: round up.
    if (qty != null && i.family !== 'vol' && i.family !== 'wt') qty = Math.ceil(qty - 1e-9);
    let qtyText = 'as needed';
    if (qty != null) {
      qtyText = i.family === 'vol' ? fmtVolume(qty) : i.family === 'wt' ? fmtWeight(qty) : fmtCount(qty, i.unit);
      // Butter is bought in sticks (1 stick = 8 tbsp = 24 tsp).
      if (i.family === 'vol' && /\bbutter\b/i.test(i.name)) {
        const sticks = qty / 24;
        qtyText = `${fmtQty(sticks)} ${sticks > 1 ? 'sticks' : 'stick'} (${fmtQty(qty / 3)} tbsp)`;
      }
    }
    return {
      id: i.id,
      name: i.name,
      aisle: i.aisle,
      group: inferGroup(i.aisle, i.name),
      family: i.family,
      qty,
      qtyText,
      dishes: i.dishes,
      note: i.notes.join('; '),
    };
  });

  const rank = (a) => {
    const r = AISLE_ORDER.indexOf(a);
    return r === -1 ? AISLE_ORDER.length : r;
  };
  return items.sort(
    (a, b) =>
      rank(a.aisle) - rank(b.aisle) ||
      groupRank(a.aisle, a.group) - groupRank(b.aisle, b.group) ||
      a.name.localeCompare(b.name),
  );
}

function toBase(qty, unit) {
  if (unit in VOL) return qty * VOL[unit];
  if (unit in WT) return qty * WT[unit];
  return qty;
}

/** [[aisle, [[group, items[]], ...]], ...] in store order, like items together. */
export function groupByAisle(items) {
  const aisles = new Map();
  for (const i of items) {
    if (!aisles.has(i.aisle)) aisles.set(i.aisle, new Map());
    const groups = aisles.get(i.aisle);
    const g = groupOf(i);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(i);
  }
  const rank = (a) => {
    const r = AISLE_ORDER.indexOf(a);
    return r === -1 ? AISLE_ORDER.length : r;
  };
  return [...aisles.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([aisle, groups]) => [
      aisle,
      [...groups.entries()]
        .sort((a, b) => groupRank(aisle, a[0]) - groupRank(aisle, b[0]))
        .map(([g, list]) => [g, [...list].sort((a, b) => a.name.localeCompare(b.name))]),
    ]);
}
