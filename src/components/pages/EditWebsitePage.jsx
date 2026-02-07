import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { getSettings, setSettings } from "../../services/firebaseSettings";

export default function EditWebsitePage() {
  const { hotelUid } = useHotelContext();
  const [introTitle, setIntroTitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!hotelUid) return;
    const loadSettings = async () => {
      setLoading(true);
      const settings = await getSettings(hotelUid);
      setIntroTitle(settings?.websiteIntroTitle ?? "");
      setIntroText(settings?.websiteIntroText ?? "");
      setLoading(false);
    };
    loadSettings();
  }, [hotelUid]);

  const handleSave = async () => {
    if (!hotelUid) return;
    setSaving(true);
    setMessage("");
    await setSettings(hotelUid, {
      websiteIntroTitle: introTitle.trim(),
      websiteIntroText: introText.trim(),
    });
    setSaving(false);
    setMessage("Website intro opgeslagen.");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
          <h1 className="text-3xl font-semibold">Edit Website</h1>
          <p className="text-gray-600 mt-1">
            Beheer de inhoud van de website secties.
          </p>
        </div>

        <Card className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Intro</h2>
            <p className="text-sm text-gray-600">
              Pas de titel en tekst van de hoofdpagina aan.
            </p>
          </div>
          {loading ? (
            <p className="text-gray-600">Website-instellingen laden...</p>
          ) : (
            <div className="grid gap-4">
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Titel
                <input
                  type="text"
                  value={introTitle}
                  onChange={(event) => setIntroTitle(event.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Tekst
                <textarea
                  rows={4}
                  value={introText}
                  onChange={(event) => setIntroText(event.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#b41f1f] text-white px-4 py-2 rounded font-semibold shadow hover:bg-[#961919] transition-colors disabled:opacity-60"
                >
                  {saving ? "Opslaan..." : "Intro opslaan"}
                </button>
                {message && <span className="text-sm text-green-600">{message}</span>}
              </div>
            </div>
          )}
        </Card>

        <Card className="space-y-2">
          <h2 className="text-xl font-semibold">Nieuwe Artikels</h2>
          <p className="text-sm text-gray-600">
            Deze sectie wordt later aangepast.
          </p>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-xl font-semibold">Top Sellers</h2>
          <p className="text-sm text-gray-600">
            Deze sectie wordt later aangepast.
          </p>
        </Card>
      </PageContainer>
    </div>
  );
}
