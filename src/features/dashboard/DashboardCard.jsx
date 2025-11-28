// src/features/dashboard/DashboardCard.jsx
import React from "react";

export default function DashboardCard({ icon: Icon, title, subtitle, onClick, disabled = false }) {
  return (
    <div
      className={`flex flex-col items-center p-6 h-full cursor-pointer rounded-2xl shadow bg-white border hover:shadow-md transition
        ${disabled ? "opacity-60 cursor-not-allowed select-none" : ""}
      `}
      onClick={disabled ? undefined : onClick}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      {Icon && <Icon className={`w-6 h-6 ${disabled ? "text-gray-400" : "text-marriott"}`} />}
      <h3 className="text-lg font-semibold mt-4">{title}</h3>
      <p className="text-sm text-gray-500 mt-1 text-center">{subtitle}</p>
      {disabled && (
        <span className="absolute top-3 left-[-22px] -rotate-12 bg-[#b41f1f] text-white font-bold text-xs px-8 py-1 shadow-lg"
          style={{ transform: "rotate(-18deg)" }}>
          Coming soon
        </span>
      )}
    </div>
  );
}
