import { describe, it, expect } from 'vitest';
import { buildShoppingList, fmtQty, fmtVolume, fmtWeight, groupByAisle, inferGroup, scaleQty } from './shopping.js';

describe('quantity formatting', () => {
  it('formats fractions to the nearest eighth', () => {
    expect(fmtQty(1.5)).toBe('1 1/2');
    expect(fmtQty(0.25)).toBe('1/4');
    expect(fmtQty(2)).toBe('2');
    expect(fmtQty(0.02)).toBe('1/8');
  });
  it('formats volumes', () => {
    expect(fmtVolume(72)).toBe('1 1/2 cups');
    expect(fmtVolume(54)).toBe('1 cup + 2 tbsp');
    expect(fmtVolume(2.25)).toBe('2 1/4 tsp');
    expect(fmtVolume(24)).toBe('1/2 cup');
    expect(fmtVolume(4.5)).toBe('1 1/2 tbsp');
    expect(fmtVolume(3.5)).toBe('1 tbsp + 1/2 tsp');
  });
  it('formats weights', () => {
    expect(fmtWeight(21)).toBe('1 lb 5 oz');
    expect(fmtWeight(12)).toBe('12 oz');
    expect(fmtWeight(80)).toBe('5 lb');
  });
});

describe('scaleQty', () => {
  it('multiplies, leaves unscaled and as-needed items alone', () => {
    expect(scaleQty({ qty: 2 }, 1.5)).toBe(3);
    expect(scaleQty({ qty: 1, scale: false }, 3)).toBe(1);
    expect(scaleQty({ qty: null }, 3)).toBeNull();
  });
});

const dishes = [
  {
    title: 'Mashed',
    scale: 2,
    ingredients: [
      { name: 'Unsalted butter', qty: 6, unit: 'tbsp', aisle: 'Dairy' },
      { name: 'Russet potatoes', qty: 2, unit: 'lb', aisle: 'Produce' },
      { name: 'Salt', qty: null, aisle: 'Spices' },
    ],
  },
  {
    title: 'Turkey',
    ingredients: [
      { name: 'Unsalted butter', qty: 4, unit: 'tbsp', aisle: 'Dairy' },
      { name: 'Garlic', qty: 1.5, unit: 'clove', aisle: 'Produce' },
      { name: 'Cooler', qty: 1, aisle: 'Equipment', scale: false },
      { name: 'Salt', qty: null, aisle: 'Spices' },
    ],
  },
  {
    title: 'Gratin',
    scale: 2,
    ingredients: [
      { name: 'Unsalted butter', qty: 2, unit: 'tbsp', aisle: 'Dairy' },
      { name: 'Unsalted butter', qty: 1, unit: 'cup', aisle: 'Dairy' },
      { name: 'Russet potatoes', qty: 1.5, unit: 'lb', aisle: 'Produce' },
      { name: 'Cooler', qty: 1, aisle: 'Equipment', scale: false },
    ],
  },
];

describe('buildShoppingList', () => {
  const list = buildShoppingList(dishes);
  const byName = Object.fromEntries(list.map((i) => [i.name, i]));

  it('adds the same ingredient across dishes and units', () => {
    // 6*2 + 4 + 2*2 tbsp = 20 tbsp (60 tsp), plus 1*2 cups (96 tsp) = 156 tsp = 52 tbsp = 6 1/2 sticks
    expect(byName['Unsalted butter'].qtyText).toBe('6 1/2 sticks (52 tbsp)');
    expect(byName['Unsalted butter'].dishes).toEqual(['Mashed', 'Turkey', 'Gratin']);
  });

  it('shows butter in sticks but not buttermilk', () => {
    const l = buildShoppingList([
      { title: 'A', ingredients: [{ name: 'Plain yogurt or buttermilk', qty: 2, unit: 'cup', aisle: 'Dairy' }] },
    ]);
    expect(l[0].qtyText).toBe('2 cups');
  });

  it('adds weights and rounds', () => {
    expect(byName['Russet potatoes'].qtyText).toBe('7 lb');
  });

  it('rounds countable things up and never scales equipment', () => {
    expect(byName.Garlic.qtyText).toBe('2 cloves');
    expect(byName.Cooler.qtyText).toBe('2'); // two dishes list one cooler each, unscaled
  });

  it('shows as needed when no dish gives an amount', () => {
    expect(byName.Salt.qtyText).toBe('as needed');
  });

  it('sorts into store order: Produce, Dairy, Spices, Equipment', () => {
    expect(groupByAisle(list).map(([a]) => a)).toEqual(['Produce', 'Dairy', 'Spices', 'Equipment']);
  });

  it('puts like items next to each other inside an aisle', () => {
    const l = buildShoppingList([
      {
        title: 'X',
        ingredients: [
          { name: 'Yellow onion', qty: 1, unit: '', aisle: 'Produce' },
          { name: 'Fresh mint', qty: 1, unit: 'handful', aisle: 'Produce' },
          { name: 'Brussels sprouts', qty: 1, unit: 'lb', aisle: 'Produce' },
          { name: 'Granny Smith apple', qty: 1, unit: '', aisle: 'Produce' },
          { name: 'Apples', qty: 2, unit: '', aisle: 'Produce' },
          { name: 'Baby spinach', qty: 5, unit: 'oz', aisle: 'Produce' },
          { name: 'Lemon', qty: 1, unit: '', aisle: 'Produce' },
          { name: 'Pecorino', qty: 3, unit: 'oz', aisle: 'Dairy' },
          { name: 'Heavy cream', qty: 1, unit: 'cup', aisle: 'Dairy' },
          { name: 'Eggs', qty: 4, unit: '', aisle: 'Dairy' },
          { name: 'Greek yogurt', qty: 2, unit: 'tbsp', aisle: 'Dairy' },
        ],
      },
    ]);
    const produce = groupByAisle(l).find(([a]) => a === 'Produce')[1];
    expect(produce.map(([g]) => g)).toEqual(['Fruit & citrus', 'Herbs', 'Leafy greens', 'Roots & alliums', 'Other vegetables']);
    expect(produce[0][1].map((i) => i.name)).toEqual(['Apples', 'Granny Smith apple', 'Lemon']);
    const dairy = groupByAisle(l).find(([a]) => a === 'Dairy')[1];
    expect(dairy.map(([g]) => g)).toEqual(['Milk & cream', 'Yogurt', 'Cheese', 'Eggs & butter']);
  });

  it('guesses sub-groups for pantry, baking and spices', () => {
    expect(inferGroup('Pantry', 'Extra virgin olive oil')).toBe('Oils & vinegars');
    expect(inferGroup('Pantry', 'Chicken broth')).toBe('Stocks & broths');
    expect(inferGroup('Pantry', 'Whole-grain mustard')).toBe('Condiments & sauces');
    expect(inferGroup('Baking', 'All-purpose flour')).toBe('Flour & meal');
    expect(inferGroup('Baking', 'Baking soda')).toBe('Leaveners');
    expect(inferGroup('Spices', 'Black pepper')).toBe('Salt & pepper');
    expect(inferGroup('Spices', 'Garam masala')).toBe('Spices & dried herbs');
    expect(inferGroup('Meat', 'Frozen turkey')).toBe('');
  });

  it('gives each line a stable id', () => {
    expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
    expect(buildShoppingList(dishes).map((i) => i.id)).toEqual(list.map((i) => i.id));
  });
});
