import React from "react";
import { useTranslation } from "react-i18next";

const ORDERING_MODES = [
  { key: "ingredient", labelKey: "ordering.options.ingredient" },
  { key: "article", labelKey: "ordering.options.article" },
];

export default function OrderingSettings({ settings = {}, onUpdateSettings }) {
  const { t } = useTranslation("settings");
  const currentMode = settings.orderMode || "ingredient";

  const handleChange = (mode) => {
    if (!onUpdateSettings) return;
    onUpdateSettings({ orderMode: mode });
  };

  return (
    <section className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">{t("ordering.title")}</h2>
          <p className="text-gray-600">{t("ordering.description")}</p>
        </div>
        <div className="bg-gray-100 rounded-full p-1 flex items-center text-sm">
          {ORDERING_MODES.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleChange(option.key)}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                currentMode === option.key
                  ? "bg-white shadow text-marriott"
                  : "text-gray-700 hover:text-marriott"
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
