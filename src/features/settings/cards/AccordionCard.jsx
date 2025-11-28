import React, { useState } from "react";

export default function AccordionCard({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl shadow mb-4 border border-gray-200">
      <button
        type="button"
        className="w-full text-left px-4 py-3 font-semibold flex items-center gap-2"
        onClick={() => setOpen(o => !o)}
      >
        <span>{open ? "▼" : "▶"} {title}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2">{children}</div>
      )}
    </div>
  );
}
