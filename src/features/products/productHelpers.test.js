import { describe, expect, it } from "vitest";

import { calculateCostAndFoodcost } from "./productHelpers";

const baseIngredients = [
  {
    id: "tuna",
    pricePerStockUnit: 20,
    contentPerStockUnit: 1000,
    vat: 6,
  },
];

const baseProduct = {
  price: 10,
  vat: 21,
  composition: [],
};

describe("calculateCostAndFoodcost", () => {
  it("applies the yield percentage when calculating ingredient cost", () => {
    const product = {
      ...baseProduct,
      composition: [
        {
          ingredientId: "tuna",
          quantity: 100,
          yield: 50,
        },
      ],
    };

    const { kostprijs } = calculateCostAndFoodcost(
      product,
      baseIngredients,
      [],
      []
    );

    expect(kostprijs).toBeCloseTo(4);
  });

  it("defaults to 100% yield when none is provided", () => {
    const product = {
      ...baseProduct,
      composition: [
        {
          ingredientId: "tuna",
          quantity: 100,
        },
      ],
    };

    const { kostprijs } = calculateCostAndFoodcost(
      product,
      baseIngredients,
      [],
      []
    );

    expect(kostprijs).toBeCloseTo(2);
  });
});
