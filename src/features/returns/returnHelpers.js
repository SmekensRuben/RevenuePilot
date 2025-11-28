// src/features/returns/returnHelpers.js

// Vind het laatst bestelde product (order) per ingredient
export function getLastDeliveryForIngredient(ingredient, orders) {
  const matches = orders.filter(
    o =>
      (o.ingredientId && ingredient.id && o.ingredientId === ingredient.id) ||
      (o.name === ingredient.name && (!ingredient.brand || o.brand === ingredient.brand))
  );
  if (!matches.length) return {};
  matches.sort((a, b) => (b.deliveryDate || "").localeCompare(a.deliveryDate || ""));
  return matches[0];
}
