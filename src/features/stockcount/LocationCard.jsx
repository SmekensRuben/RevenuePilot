// src/features/stockcount/LocationCard.jsx
import React from "react";

export default function LocationCard({ location, status, onOpen, onReopen, assignedTo, canManage = true }) {
  return (
    <div className="p-4 rounded-xl border shadow flex flex-col gap-1 bg-white">
      <div className="text-lg font-semibold">{location}</div>
      <div className={`text-xs ${
        status === "Finished" ? "text-green-600" :
        status === "Started" ? "text-yellow-600" : "text-gray-400"
      }`}>
        {status}
      </div>
      {assignedTo && (
        <div className="text-xs text-gray-500">By: {assignedTo}</div>
      )}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onOpen}
          className="bg-marriott text-white px-4 py-2 rounded"
          title={!canManage ? "Alleen lezen" : undefined}
        >
          {status === "Not Started" ? "Start" : status === "Started" ? "Continue" : "Review"}
        </button>
        {status === "Finished" && (
          <button
            onClick={onReopen}
            className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={!canManage}
            title={!canManage ? "Geen rechten om te heropenen" : undefined}
          >
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}
