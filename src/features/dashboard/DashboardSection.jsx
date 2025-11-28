// src/features/dashboard/DashboardSection.jsx
import React from "react";

export default function DashboardSection({ title, children }) {
  return (
    <div className="w-full max-w-4xl mb-10">
      <h2 className="text-lg font-bold text-marriott mb-2 tracking-wider">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {children}
      </div>
    </div>
  );
}
