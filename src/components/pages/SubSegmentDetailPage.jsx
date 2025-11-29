import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { subSegments } from "../../constants/segmentationData";

export default function SubSegmentDetailPage() {
  const { subSegmentId } = useParams();
  const navigate = useNavigate();
  const subSegment = subSegments.find((item) => item.id === subSegmentId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
          <h1 className="text-3xl font-semibold">
            {subSegment ? subSegment.name : "Sub Segment"}
          </h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-md border border-gray-200 text-gray-800 font-medium hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
        {subSegment ? (
          <>
            <DetailRow label="Name" value={subSegment.name} />
            <DetailRow label="Prefix" value={subSegment.prefix} />
            <DetailRow label="Rate Type" value={subSegment.rateType} />
            <DetailRow label="Description" value={subSegment.description} />
            <DetailRow label="Rate Category" value={subSegment.rateCategory} />
            <DetailRow label="Market Segment" value={subSegment.marketSegment} />
            <DetailRow label="Transaction Code" value={subSegment.transactionCode} />
          </>
        ) : (
          <div className="p-6 text-gray-600">Sub Segment not found.</div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-2">
      <div className="sm:w-48 text-sm font-semibold text-gray-700">{label}</div>
      <div className="text-gray-900">{value}</div>
    </div>
  );
}
