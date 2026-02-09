import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  deleteMarketSegment,
  deleteGroupMarketSegment,
  deleteSubSegment,
  subscribeGroupMarketSegments,
  subscribeMarketSegments,
  subscribeSubSegments,
} from "../../services/segmentationService";

export default function SegmentationMappingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hotelUid } = useHotelContext();
  const [activeTab, setActiveTab] = useState("market");
  const [marketSegments, setMarketSegments] = useState([]);
  const [groupMarketSegments, setGroupMarketSegments] = useState([]);
  const [subSegments, setSubSegments] = useState([]);
  const [loadingMessage, setLoadingMessage] = useState("Gegevens laden...");
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
    if (!hotelUid) return undefined;
    setLoadingMessage("Gegevens laden...");

    const unsubscribeMarkets = subscribeMarketSegments(
      hotelUid,
      setMarketSegments
    );
    const unsubscribeGroups = subscribeGroupMarketSegments(
      hotelUid,
      setGroupMarketSegments
    );
    const unsubscribeSubs = subscribeSubSegments(hotelUid, setSubSegments);

    setLoadingMessage("");

    return () => {
      unsubscribeMarkets();
      unsubscribeGroups();
      unsubscribeSubs();
    };
  }, [hotelUid]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  const handleDeleteMarketSegment = async (segment) => {
    if (!hotelUid || !segment?.id) return;
    const confirmed = window.confirm(
      `Weet je zeker dat je het market segment "${segment.name}" wil verwijderen?`
    );
    if (!confirmed) return;
    await deleteMarketSegment(hotelUid, segment.id);
  };

  const handleDeleteSubSegment = async (segment) => {
    if (!hotelUid || !segment?.id) return;
    const confirmed = window.confirm(
      `Weet je zeker dat je het sub segment "${segment.name}" wil verwijderen?`
    );
    if (!confirmed) return;
    await deleteSubSegment(hotelUid, segment.id);
  };

  const handleDeleteGroupMarketSegment = async (segment) => {
    if (!hotelUid || !segment?.id) return;
    const confirmed = window.confirm(
      `Weet je zeker dat je het group market segment "${segment.name}" wil verwijderen?`
    );
    if (!confirmed) return;
    await deleteGroupMarketSegment(hotelUid, segment.id);
  };

  const groupMarketSegmentItems = useMemo(
    () =>
      groupMarketSegments.map((segment) => ({
        ...segment,
        description: segment.marketSegmentNames?.length
          ? `${segment.marketSegmentNames.length} market segments`
          : "Nog geen market segments gekoppeld.",
      })),
    [groupMarketSegments]
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
            <h1 className="text-3xl font-semibold">Segmentation Mapping</h1>
            <p className="text-gray-600 mt-1">
              Manage market and sub segment mapping for your property.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("market")}
              className={`px-4 py-2 rounded-md font-medium border ${
                activeTab === "market"
                  ? "bg-[#b41f1f] text-white border-[#b41f1f]"
                  : "bg-white text-gray-800 border-gray-200"
              }`}
            >
              Market Segment
            </button>
            <button
              onClick={() => setActiveTab("group")}
              className={`px-4 py-2 rounded-md font-medium border ${
                activeTab === "group"
                  ? "bg-[#b41f1f] text-white border-[#b41f1f]"
                  : "bg-white text-gray-800 border-gray-200"
              }`}
            >
              Group Market Segment
            </button>
            <button
              onClick={() => setActiveTab("sub")}
              className={`px-4 py-2 rounded-md font-medium border ${
                activeTab === "sub"
                  ? "bg-[#b41f1f] text-white border-[#b41f1f]"
                  : "bg-white text-gray-800 border-gray-200"
              }`}
            >
              Sub Segment
            </button>
          </div>
        </div>

        {activeTab === "market" && (
          <SegmentList
            title="Market Segments"
            items={marketSegments}
            emptyMessage="Er zijn nog geen market segments beschikbaar. Voeg de eerste toe om de mapping te starten."
            onAdd={() => navigate("/settings/segmentation-mapping/market-segments/new")}
            onSelect={(segment) =>
              navigate(`/settings/segmentation-mapping/market-segments/${segment.id}`, {
                state: { segment },
              })
            }
            onDelete={handleDeleteMarketSegment}
          />
        )}
        {activeTab === "group" && (
          <SegmentList
            title="Group Market Segments"
            items={groupMarketSegmentItems}
            emptyMessage="Er zijn nog geen group market segments beschikbaar. Voeg er een toe om een groep te maken."
            onAdd={() =>
              navigate("/settings/segmentation-mapping/group-market-segments/new")
            }
            onSelect={(segment) =>
              navigate(
                `/settings/segmentation-mapping/group-market-segments/${segment.id}`,
                {
                  state: { segment },
                }
              )
            }
            onDelete={handleDeleteGroupMarketSegment}
          />
        )}
        {activeTab === "sub" && (
          <SegmentList
            title="Sub Segments"
            items={subSegments}
            emptyMessage="Er zijn nog geen sub segments beschikbaar. Voeg er een toe om de mapping te vervolledigen."
            onAdd={() => navigate("/settings/segmentation-mapping/sub-segments/new")}
            onSelect={(segment) =>
              navigate(`/settings/segmentation-mapping/sub-segments/${segment.id}`, {
                state: { subSegment: segment },
              })
            }
            onDelete={handleDeleteSubSegment}
          />
        )}
        {loadingMessage && (
          <div className="text-sm text-gray-600">{loadingMessage}</div>
        )}
      </PageContainer>
    </div>
  );
}

function SegmentList({ title, items, onAdd, onSelect, onDelete, emptyMessage }) {
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 rounded-md bg-[#b41f1f] text-white font-semibold hover:bg-[#9c1a1a]"
          aria-label={`Add ${title}`}
        >
          +
        </button>
      </div>
      {hasItems ? (
        <ul>
          {items.map((segment) => (
            <li key={segment.id}>
              <div className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => onSelect(segment)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-base font-medium text-gray-900">
                        {segment.name}
                      </div>
                      {segment.type && (
                        <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded px-2 py-0.5">
                          {segment.type}
                        </span>
                      )}
                    </div>
                    {segment.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {segment.description}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelect(segment)}
                      className="px-3 py-1.5 rounded-md border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white"
                    >
                      Bewerk
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(segment)}
                      className="px-3 py-1.5 rounded-md border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Verwijder
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-4 text-sm text-gray-600">{emptyMessage}</div>
      )}
    </div>
  );
}
