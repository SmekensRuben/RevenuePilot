import React, { useState, useEffect } from "react";

export default function GeneralSettings({ settings, onUpdateSettings }) {
  const [language, setLanguage] = useState(settings?.language || "nl");

  // Dynamisch talenarray uit settings
  const languageOptions =
    Array.isArray(settings?.languages) && settings.languages.length > 0
      ? settings.languages
      : [
          { value: "nl", label: "Nederlands" },
          { value: "en", label: "English" },
          { value: "fr", label: "Français" },
        ];

  useEffect(() => {
    setLanguage(settings?.language || "nl");
  }, [settings]);

  function handleSubmit(e) {
    e.preventDefault();
    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        language,
      });
    }
  }

  return (
    <form
      className="bg-white rounded-xl shadow p-6 mb-4"
      onSubmit={handleSubmit}
    >
      <h2 className="text-lg font-bold mb-4">Algemene instellingen</h2>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-gray-600 mb-1">Bedrijfsnaam</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={settings?.hotelName || settings?.companyName || ""}
            readOnly
          />
        </div>
        <div>
          <label className="block text-gray-600 mb-1">Taal</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            {languageOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Subtiele Marriott-knop, gecentreerd */}
      <div className="flex justify-center mt-6">
        <button
          type="submit"
          className="px-5 py-2 rounded-lg text-base font-semibold shadow bg-[#b41f1f] hover:bg-[#a41a1a] text-white transition-colors duration-200"
          style={{
            letterSpacing: "0.02em",
            boxShadow: "0 2px 8px 0 #ececec",
          }}
        >
          Opslaan
        </button>
      </div>
    </form>
  );
}
