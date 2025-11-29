import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";

export default function MarketSegmentDetailPage() {
  const { segmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialSegment = location.state?.segment;
  const isNew = segmentId === "new" || !initialSegment;

  const [formData, setFormData] = useState({
    name: initialSegment?.name || "",
    description: initialSegment?.description || "",
    code: initialSegment?.code || "",
    notes: initialSegment?.notes || "",
  });
  const [statusMessage, setStatusMessage] = useState("");

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

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatusMessage(
      "Details klaar om op te slaan. Koppel de backend om deze informatie permanent te bewaren."
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
            <h1 className="text-3xl font-semibold">
              {formData.name || (isNew ? "Nieuw Market Segment" : "Market Segment")}
            </h1>
            <p className="text-gray-600 mt-1">
              Vul de details van het market segment in.
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-md border border-gray-200 text-gray-800 font-medium hover:bg-gray-50"
          >
            Terug
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Naam
              <input
                type="text"
                value={formData.name}
                onChange={handleChange("name")}
                className="border border-gray-300 rounded px-3 py-2 text-gray-900"
                placeholder="bv. Corporate"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Code
              <input
                type="text"
                value={formData.code}
                onChange={handleChange("code")}
                className="border border-gray-300 rounded px-3 py-2 text-gray-900"
                placeholder="Interne referentie"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            Beschrijving
            <textarea
              value={formData.description}
              onChange={handleChange("description")}
              className="border border-gray-300 rounded px-3 py-2 text-gray-900 h-24"
              placeholder="Omschrijf het market segment"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            Notities
            <textarea
              value={formData.notes}
              onChange={handleChange("notes")}
              className="border border-gray-300 rounded px-3 py-2 text-gray-900 h-24"
              placeholder="Interne opmerkingen of mapping regels"
            />
          </label>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-600">
              {isNew
                ? "Dit market segment wordt aangemaakt zodra de opslag is gekoppeld."
                : "Werk de bestaande gegevens bij en bewaar ze zodra opslag beschikbaar is."}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#b41f1f] text-white rounded-md font-semibold hover:bg-[#9c1a1a]"
            >
              Opslaan
            </button>
          </div>

          {statusMessage && (
            <div className="text-sm text-[#b41f1f] font-semibold">{statusMessage}</div>
          )}
        </form>
      </PageContainer>
    </div>
  );
}
