import React, { useEffect, useState } from "react";

export default function ReportingSettings({ settings, onUpdateSettings }) {
  const [useOverride, setUseOverride] = useState(
    Boolean(settings?.useCostPercentageOverride)
  );
  const [foodPercentage, setFoodPercentage] = useState(
    settings?.foodCostPercentage ?? ""
  );
  const [beveragePercentage, setBeveragePercentage] = useState(
    settings?.beverageCostPercentage ?? ""
  );

  useEffect(() => {
    setUseOverride(Boolean(settings?.useCostPercentageOverride));
    setFoodPercentage(
      settings?.foodCostPercentage !== undefined && settings?.foodCostPercentage !== null
        ? settings.foodCostPercentage
        : ""
    );
    setBeveragePercentage(
      settings?.beverageCostPercentage !== undefined && settings?.beverageCostPercentage !== null
        ? settings.beverageCostPercentage
        : ""
    );
  }, [settings]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!onUpdateSettings) return;

    const parsedFood = Number.parseFloat(foodPercentage);
    const parsedBeverage = Number.parseFloat(beveragePercentage);

    onUpdateSettings({
      useCostPercentageOverride: useOverride,
      foodCostPercentage: Number.isFinite(parsedFood) ? parsedFood : 0,
      beverageCostPercentage: Number.isFinite(parsedBeverage) ? parsedBeverage : 0,
    });
  };

  return (
    <form
      className="bg-white rounded-xl shadow p-6 mb-4 flex flex-col gap-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-3">
        <input
          id="use-cost-percentage-override"
          type="checkbox"
          checked={useOverride}
          onChange={(event) => setUseOverride(event.target.checked)}
          className="h-4 w-4"
        />
        <label
          htmlFor="use-cost-percentage-override"
          className="text-sm font-semibold text-gray-700"
        >
          Use cost percentage override
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            className="block text-gray-600 text-sm mb-1"
            htmlFor="reporting-food-percentage"
          >
            Food cost percentage
          </label>
          <div className="relative">
            <input
              id="reporting-food-percentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={foodPercentage}
              onChange={(event) => setFoodPercentage(event.target.value)}
              className="w-full border rounded px-3 py-2 pr-10"
              placeholder="0"
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">%</span>
          </div>
        </div>

        <div>
          <label
            className="block text-gray-600 text-sm mb-1"
            htmlFor="reporting-beverage-percentage"
          >
            Beverage cost percentage
          </label>
          <div className="relative">
            <input
              id="reporting-beverage-percentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={beveragePercentage}
              onChange={(event) => setBeveragePercentage(event.target.value)}
              className="w-full border rounded px-3 py-2 pr-10"
              placeholder="0"
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">%</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="submit"
          className="px-5 py-2 rounded-lg text-base font-semibold shadow bg-[#b41f1f] hover:bg-[#a41a1a] text-white transition-colors duration-200"
        >
          Opslaan
        </button>
      </div>
    </form>
  );
}
