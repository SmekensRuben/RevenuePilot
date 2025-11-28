import React from "react";
import ReturnCard from "./ReturnCard";

export default function ReturnList({ returns, onStatusUpdate }) {
  if (!returns.length) {
    return <div className="text-center text-gray-500 mt-8">Geen retouren gevonden.</div>;
  }
  // Sorteer op nieuwste eerst
  const sorted = [...returns].sort((a, b) => (b.dateCreated || 0) - (a.dateCreated || 0));
  return (
    <div className="flex flex-col gap-4">
      {sorted.map(retour => (
        <ReturnCard key={retour.id} retour={retour} onStatusUpdate={onStatusUpdate} />
      ))}
    </div>
  );
}
