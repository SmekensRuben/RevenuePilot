import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const POS_OPTIONS = [
  { value: "lightspeed", labelKey: "dataUpload.posOptions.lightspeed" },
  { value: "micros", labelKey: "dataUpload.posOptions.micros" },
];

export default function DataUploadSettings({ settings, onUpdateSettings }) {
  const { t } = useTranslation("settings");
  const [posProvider, setPosProvider] = useState(settings?.posProvider || "lightspeed");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPosProvider(settings?.posProvider || "lightspeed");
  }, [settings?.posProvider]);

  const handleSubmit = async event => {
    event.preventDefault();
    if (!onUpdateSettings) {
      return;
    }

    try {
      setIsSaving(true);
      await onUpdateSettings({
        ...settings,
        posProvider,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow p-6 flex flex-col gap-6"
    >
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          {t("dataUpload.title")}
        </h2>
        <p className="text-gray-600 mt-1">
          {t("dataUpload.description")}
        </p>
      </div>

      <div className="flex flex-col gap-2 max-w-sm">
        <label className="text-gray-700 font-medium" htmlFor="pos-provider">
          {t("dataUpload.posLabel")}
        </label>
        <select
          id="pos-provider"
          value={posProvider}
          onChange={event => setPosProvider(event.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {POS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-start">
        <button
          type="submit"
          className="px-5 py-2 rounded-lg text-base font-semibold shadow bg-[#b41f1f] hover:bg-[#a41a1a] text-white transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={isSaving}
        >
          {isSaving ? t("dataUpload.saving") : t("dataUpload.saveButton")}
        </button>
      </div>
    </form>
  );
}
