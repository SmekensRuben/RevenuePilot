import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { marketSegments, subSegments } from "../../constants/segmentationData";

export default function SegmentationMappingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("market");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
          <h1 className="text-3xl font-semibold">Segmentation Mapping</h1>
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
          onAdd={() => {}}
          onSelect={(id) => navigate(`/settings/segmentation-mapping/market-segments/${id}`)}
        />
      ) : (
        <SegmentList
          title="Sub Segments"
          items={subSegments}
          onAdd={() => {}}
          onSelect={(id) => navigate(`/settings/segmentation-mapping/sub-segments/${id}`)}
        />
      )}
    </div>
  );
}

function SegmentList({ title, items, onAdd, onSelect }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 rounded-md bg-[#b41f1f] text-white font-semibold hover:bg-[#9c1a1a]"
        >
          +
        </button>
      </div>
      <ul>
        {items.map((segment) => (
          <li key={segment.id}>
            <button
              onClick={() => onSelect(segment.id)}
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
    </div>
  );
}
