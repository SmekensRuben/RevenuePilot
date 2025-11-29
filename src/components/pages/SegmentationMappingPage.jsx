import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";
import { marketSegments, subSegments } from "../../constants/segmentationData";

export default function SegmentationMappingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("market");
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

        {activeTab === "market" ? (
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
          />
        ) : (
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
          />
        )}
      </PageContainer>
    </div>
  );
}

function SegmentList({ title, items, onAdd, onSelect, emptyMessage }) {
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
              <button
                onClick={() => onSelect(segment)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="text-base font-medium text-gray-900">{segment.name}</div>
                {segment.description && (
                  <p className="text-sm text-gray-600 mt-1">{segment.description}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-4 text-sm text-gray-600">{emptyMessage}</div>
      )}
    </div>
  );
}
