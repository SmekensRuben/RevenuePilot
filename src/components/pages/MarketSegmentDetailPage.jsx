import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { marketSegments } from "../../constants/segmentationData";

export default function MarketSegmentDetailPage() {
  const { segmentId } = useParams();
  const navigate = useNavigate();
  const segment = marketSegments.find((item) => item.id === segmentId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
          <h1 className="text-3xl font-semibold">
            {segment ? segment.name : "Market Segment"}
          </h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-md border border-gray-200 text-gray-800 font-medium hover:bg-gray-50"
        >
          Back
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm text-gray-600">
        <p>This page will display detailed information for the selected market segment.</p>
      </div>
    </div>
  );
}
