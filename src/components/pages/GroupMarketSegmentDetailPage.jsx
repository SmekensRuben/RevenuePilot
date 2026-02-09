import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  getGroupMarketSegment,
  saveGroupMarketSegment,
  subscribeMarketSegments,
} from "../../services/segmentationService";

export default function GroupMarketSegmentDetailPage() {
  const { groupSegmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { hotelUid } = useHotelContext();
  const initialSegment = location.state?.segment;
  const isNew = groupSegmentId === "new" || !groupSegmentId;

  const [formData, setFormData] = useState({
    name: initialSegment?.name || "",
    marketSegmentIds: initialSegment?.marketSegmentIds || [],
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

  const selectedSegments = useMemo(
    () =>
      marketSegments.filter((segment) =>
        formData.marketSegmentIds.includes(segment.id)
      ),
    [formData.marketSegmentIds, marketSegments]
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!hotelUid) return undefined;
    const unsubscribe = subscribeMarketSegments(hotelUid, setMarketSegments);
    return () => unsubscribe();
  }, [hotelUid]);

  useEffect(() => {
    if (!hotelUid || isNew || initialSegment) return;

    const loadSegment = async () => {
      setStatusMessage("Group market segment laden...");
      const segment = await getGroupMarketSegment(hotelUid, groupSegmentId);
      if (segment) {
        setFormData({
          name: segment.name || "",
          marketSegmentIds: segment.marketSegmentIds || [],
        });
        setStatusMessage("");
      } else {
        setStatusMessage("Group market segment niet gevonden.");
      }
    };

    loadSegment();
  }, [groupSegmentId, hotelUid, initialSegment, isNew]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToggleSegment = (segmentId) => {
    setFormData((prev) => {
      const hasSegment = prev.marketSegmentIds.includes(segmentId);
      return {
        ...prev,
        marketSegmentIds: hasSegment
          ? prev.marketSegmentIds.filter((id) => id !== segmentId)
          : [...prev.marketSegmentIds, segmentId],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      setStatusMessage("Naam is verplicht.");
      return;
    }

    try {
      setSaving(true);
      const selectedNames = selectedSegments.map((segment) => segment.name || "");
      const savedId = await saveGroupMarketSegment(
        hotelUid,
        isNew ? null : groupSegmentId,
        {
          name: formData.name.trim(),
          marketSegmentIds: formData.marketSegmentIds,
          marketSegmentNames: selectedNames,
        }
      );
      setStatusMessage("Group market segment opgeslagen.");
      if (isNew && savedId) {
        navigate(`/settings/segmentation-mapping/group-market-segments/${savedId}`,
          {
            replace: true,
            state: {
              segment: {
                id: savedId,
                name: formData.name.trim(),
                marketSegmentIds: formData.marketSegmentIds,
                marketSegmentNames: selectedNames,
              },
            },
          }
        );
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
              {formData.name ||
                (isNew ? "Nieuw Group Market Segment" : "Group Market Segment")}
            </h1>
            <p className="text-gray-600 mt-1">
              Maak een groep van meerdere market segments voor rapportage en mapping.
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
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="border border-gray-300 rounded px-3 py-2 text-gray-900"
                placeholder="bv. Corporate Groups"
                required
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Gekoppelde Market Segments
              </h2>
              <span className="text-xs text-gray-500">
                {selectedSegments.length} geselecteerd
              </span>
            </div>
            <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
              {marketSegments.length ? (
                <ul className="divide-y divide-gray-100">
                  {marketSegments.map((segment) => (
                    <li key={segment.id} className="px-3 py-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.marketSegmentIds.includes(segment.id)}
                          onChange={() => handleToggleSegment(segment.id)}
                          className="h-4 w-4 rounded border-gray-300 text-[#b41f1f] focus:ring-[#b41f1f]"
                        />
                        <span className="font-medium text-gray-900">
                          {segment.name}
                        </span>
                        {segment.type && (
                          <span className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-0.5">
                            {segment.type}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-3 py-4 text-sm text-gray-500">
                  Er zijn nog geen market segments beschikbaar.
                </div>
              )}
            </div>
          </div>

          {selectedSegments.length ? (
            <div className="flex flex-wrap gap-2">
              {selectedSegments.map((segment) => (
                <span
                  key={segment.id}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700"
                >
                  {segment.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Nog geen market segments geselecteerd.
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-600">
              {isNew
                ? "Dit group market segment wordt aangemaakt en opgeslagen in Firebase."
                : "Werk de groep bij en sla op om Firebase bij te werken."}
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
