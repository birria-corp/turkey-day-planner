// Building a new dish for Add item: blank, or a copy of an existing dish. Pure functions.
import { addMinutes, diffMinutes } from './scheduler/time.js';
import { mealName } from './scheduler/meal.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

/** "Mashed Potatoes" + Friday dinner -> "Mashed Potatoes (Friday)". */
export function copyTitle(source, targetMeal) {
  return `${source.title} (${mealName(targetMeal).replace(' Dinner', '')})`;
}

/**
 * @param {object} o
 *   title, targetMeal, order, source (dish to copy, or null for blank),
 *   sourceMeal, sourceSteps (steps of the source dish), color (a palette key, or '' to keep the source's)
 * @returns {{ dish: object, steps: object[] }} dish has no id; steps have no dishId or id.
 *   Copied steps keep their time relative to the dinner, so they move to the new dinner's day.
 */
export function buildNewDish({ title, targetMeal, order, source, sourceMeal, sourceSteps = [], color = '' }) {
  if (!source) {
    return {
      dish: {
        order,
        mealId: targetMeal.id,
        recipeId: null,
        title,
        cookName: '',
        emoji: '🍽️',
        color,
        scale: 1,
        servings: '',
        source: '',
        ingredients: [],
        method: [],
        notes: '',
        myNotes: '',
      },
      steps: [],
    };
  }
  const { id: _id, ...rest } = clone(source);
  const delta = sourceMeal ? diffMinutes(sourceMeal.serveAt, targetMeal.serveAt) : 0;
  return {
    dish: { ...rest, order, mealId: targetMeal.id, title, myNotes: '', color: color || rest.color || '' },
    steps: sourceSteps.map((s) => {
      const { id: _sid, dishId: _d, ...step } = clone(s);
      return { ...step, startAt: addMinutes(s.startAt, delta), done: false };
    }),
  };
}
