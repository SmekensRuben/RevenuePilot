// src/features/products/productHelpers.js

import { calculateRecipeCost } from "../recipes/recipeHelpers";

export function calculateCostAndFoodcost(
  product,
  ingredients,
  recipes = [],
  articles = []
) {
  let cost = 0;
  let hoogsteVat = 0;

  const addIngredientCost = (ingredientId, quantity, yieldPercentage = 100) => {
    const ing = ingredients.find(i => i.id === ingredientId);
    if (!ing) return;
    const vat = ing.vat || 6;
    hoogsteVat = Math.max(hoogsteVat, vat);

    const ingArticleIds = Array.isArray(ing.articles) ? ing.articles : [];
    let lowestUnitPrice = null;
    ingArticleIds.forEach(aid => {
      const art = articles.find(a => a.id === aid);
      if (!art) return;
      const pricePerStock = parseFloat(art.pricePerStockUnit);
      const contentPerStock = parseFloat(art.contentPerStockUnit);
      if (!isNaN(pricePerStock) && !isNaN(contentPerStock) && contentPerStock > 0) {
        const unitPrice = pricePerStock / contentPerStock;
        if (lowestUnitPrice === null || unitPrice < lowestUnitPrice) {
          lowestUnitPrice = unitPrice;
        }
      }
    });
    if (lowestUnitPrice === null) {
      const pricePerStock = parseFloat(ing.pricePerStockUnit);
      const contentPerStock = parseFloat(ing.contentPerStockUnit);
      if (!isNaN(pricePerStock) && !isNaN(contentPerStock) && contentPerStock > 0) {
        lowestUnitPrice = pricePerStock / contentPerStock;
      } else {
        lowestUnitPrice = 0;
      }
    }

    const qty = parseFloat(quantity) || 0;
    const yieldValue = parseFloat(yieldPercentage);
    const normalizedYield =
      !Number.isNaN(yieldValue) && yieldValue > 0 ? yieldValue : 100;
    const grossQuantity = qty * (100 / normalizedYield);
    cost += grossQuantity * lowestUnitPrice;
  };

  const composition = Array.isArray(product.composition) ? product.composition : [];
  composition.forEach(row => {
    addIngredientCost(row.ingredientId, row.quantity, row.yield);
  });

  const recipeRows = Array.isArray(product.recipes) ? product.recipes : [];
  recipeRows.forEach(row => {
    const recipe = recipes.find(r => r.id === row.recipeId);
    if (!recipe) return;
    if (Array.isArray(recipe.composition)) {
      recipe.composition.forEach(rRow => {
        const ing = ingredients.find(i => i.id === rRow.ingredientId);
        if (ing) hoogsteVat = Math.max(hoogsteVat, ing.vat || 6);
      });
    }
    const recipeCost = calculateRecipeCost(recipe, ingredients, articles);
    const content = parseFloat(recipe.content) || 1;
    const qty = parseFloat(row.quantity) || 0;
    const units = qty / content;
    cost += units * recipeCost;
  });

  const vatProduct = product.vat ?? hoogsteVat ?? 6;
  const verkoopprijsExclBtw = product.price / (1 + vatProduct / 100);
  const foodcostPct = verkoopprijsExclBtw > 0 ? (cost / verkoopprijsExclBtw) * 100 : 0;

  return {
    kostprijs: cost,
    foodcostPct,
    verkoopprijsExclBtw,
  };
}
