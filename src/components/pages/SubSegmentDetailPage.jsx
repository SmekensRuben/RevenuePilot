import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  getSubSegment,
  saveSubSegment,
  subscribeMarketSegments,
} from "../../services/segmentationService";

export default function SubSegmentDetailPage() {
  const { subSegmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { hotelUid } = useHotelContext();
  const initialSubSegment = location.state?.subSegment;
  const isNew = subSegmentId === "new" || !subSegmentId;

  const [formData, setFormData] = useState({
    name: initialSubSegment?.name || "",
    prefix: initialSubSegment?.prefix || "",
    rateType: initialSubSegment?.rateType || "",
    description: initialSubSegment?.description || "",
    marketSegmentId: initialSubSegment?.marketSegmentId || "",
    marketSegmentName:
      initialSubSegment?.marketSegmentName || initialSubSegment?.marketSegment || "",
  });
  const [marketSegments, setMarketSegments] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (!hotelUid || isNew || initialSubSegment) return;

    const loadSubSegment = async () => {
      setStatusMessage("Sub segment laden...");
      const subSegment = await getSubSegment(hotelUid, subSegmentId);
      if (subSegment) {
        setFormData({
          name: subSegment.name || "",
          prefix: subSegment.prefix || "",
          rateType: subSegment.rateType || "",
          description: subSegment.description || "",
          marketSegmentId: subSegment.marketSegmentId || "",
          marketSegmentName: subSegment.marketSegmentName || "",
        });
        setStatusMessage("");
      } else {
        setStatusMessage("Sub segment niet gevonden.");
      }
    };

    loadSubSegment();
  }, [hotelUid, initialSubSegment, isNew, subSegmentId]);

  useEffect(() => {
    if (!hotelUid) return undefined;
    const unsubscribe = subscribeMarketSegments(hotelUid, setMarketSegments);
    return () => unsubscribe();
  }, [hotelUid]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      setStatusMessage("Naam is verplicht.");
      return;
    }

    const linkedMarketSegment = marketSegments.find(
      (segment) => segment.id === formData.marketSegmentId
    );

    try {
      setSaving(true);
      const payload = {
        ...formData,
        name: formData.name.trim(),
        marketSegmentName:
          linkedMarketSegment?.name || formData.marketSegmentName || "",
      };
      const savedId = await saveSubSegment(
        hotelUid,
        isNew ? null : subSegmentId,
        payload
      );
      setStatusMessage("Sub segment opgeslagen.");
      if (savedId) {
        navigate("/settings/segmentation-mapping", {
          replace: true,
          state: { activeTab: "sub" },
        });
      }
    } catch (error) {
      console.error("Opslaan mislukt", error);
      setStatusMessage("Opslaan mislukt. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
            <h1 className="text-3xl font-semibold">
              {formData.name || (isNew ? "Nieuw Sub Segment" : "Sub Segment")}
            </h1>
            <p className="text-gray-600 mt-1">
              Vul de details van het sub segment in.
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
                placeholder="bv. Corporate Standard"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Prefix
              <input
                type="text"
                value={formData.prefix}
                onChange={handleChange("prefix")}
                className="border border-gray-300 rounded px-3 py-2 text-gray-900"
                placeholder="bv. CORP"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Rate Type
              <input
                type="text"
                value={formData.rateType}
                onChange={handleChange("rateType")}
                className="border border-gray-300 rounded px-3 py-2 text-gray-900"
                placeholder="BAR, Package, ..."
              />
            </label>

          </div>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            Beschrijving
            <textarea
              value={formData.description}
              onChange={handleChange("description")}
              className="border border-gray-300 rounded px-3 py-2 text-gray-900 h-24"
              placeholder="Omschrijf het sub segment"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Market Segment
              <select
                value={formData.marketSegmentId}
                onChange={handleChange("marketSegmentId")}
                className="border border-gray-300 rounded px-3 py-2 text-gray-900"
              >
                <option value="">Kies een market segment</option>
                {marketSegments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                    {segment.type ? ` (${segment.type})` : ""}
                  </option>
                ))}
              </select>
            </label>

          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-600">
              {isNew
                ? "Dit sub segment wordt aangemaakt en opgeslagen in Firebase."
                : "Werk de gegevens bij en sla op om Firebase te updaten."}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#b41f1f] text-white rounded-md font-semibold hover:bg-[#9c1a1a] disabled:opacity-60"
            >
              {saving ? "Opslaan..." : "Opslaan"}
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
