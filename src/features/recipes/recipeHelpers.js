export function calculateRecipeCost(recipe, ingredients, articles = []) {
  let cost = 0;
  const composition = Array.isArray(recipe.composition) ? recipe.composition : [];

  composition.forEach(row => {
    const ing = ingredients.find(i => i.id === row.ingredientId);
    if (!ing) return;

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

    const qty = parseFloat(row.quantity) || 0;
    cost += qty * lowestUnitPrice;
  });

  return cost;
}
