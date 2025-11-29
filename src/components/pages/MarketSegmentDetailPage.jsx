import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  getMarketSegment,
  saveMarketSegment,
  subscribeSubSegments,
} from "../../services/segmentationService";

export default function MarketSegmentDetailPage() {
  const { segmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { hotelUid } = useHotelContext();
  const initialSegment = location.state?.segment;
  const isNew = segmentId === "new" || !segmentId;

  const [formData, setFormData] = useState({
    name: initialSegment?.name || "",
  });
  const [subSegments, setSubSegments] = useState([]);
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
    if (!hotelUid || isNew || initialSegment) return;

    const loadSegment = async () => {
      setStatusMessage("Market segment laden...");
      const segment = await getMarketSegment(hotelUid, segmentId);
      if (segment) {
        setFormData({ name: segment.name || "" });
        setStatusMessage("");
      } else {
        setStatusMessage("Market segment niet gevonden.");
      }
    };

    loadSegment();
  }, [hotelUid, initialSegment, isNew, segmentId]);

  useEffect(() => {
    if (!hotelUid || !segmentId || isNew) {
      setSubSegments([]);
      return undefined;
    }

    const unsubscribe = subscribeSubSegments(hotelUid, setSubSegments, {
      marketSegmentId: segmentId,
    });
    return () => unsubscribe();
  }, [hotelUid, isNew, segmentId]);

  const handleChange = (event) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, name: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      setStatusMessage("Naam is verplicht.");
      return;
    }

    try {
      setSaving(true);
      const savedId = await saveMarketSegment(
        hotelUid,
        isNew ? null : segmentId,
        { name: formData.name.trim() }
      );
      setStatusMessage("Market segment opgeslagen.");
      if (isNew && savedId) {
        navigate(`/settings/segmentation-mapping/market-segments/${savedId}`, {
          replace: true,
          state: { segment: { id: savedId, name: formData.name.trim() } },
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
              {formData.name || (isNew ? "Nieuw Market Segment" : "Market Segment")}
            </h1>
            <p className="text-gray-600 mt-1">
              Vul de naam van het market segment in en beheer de gekoppelde sub segments.
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
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            Naam
            <input
              type="text"
              value={formData.name}
              onChange={handleChange}
              className="border border-gray-300 rounded px-3 py-2 text-gray-900"
              placeholder="bv. Corporate"
              required
            />
          </label>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-600">
              {isNew
                ? "Dit market segment wordt aangemaakt en opgeslagen in Firebase."
                : "Werk de naam bij en sla op om Firebase bij te werken."}
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

        {!isNew && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold">Gekoppelde Sub Segments</h2>
            {subSegments.length ? (
              <ul className="space-y-2">
                {subSegments.map((subSegment) => (
                  <li
                    key={subSegment.id}
                    className="flex items-center justify-between border border-gray-100 rounded px-3 py-2"
                  >
                    <div className="text-base font-medium text-gray-900">
                      {subSegment.name}
                    </div>
                    {subSegment.prefix && (
                      <span className="text-sm text-gray-600">{subSegment.prefix}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">
                Er zijn nog geen sub segments gekoppeld aan dit market segment.
              </p>
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
