// src/features/settings/AccordionSection.jsx
import React, { useState } from "react";

export default function AccordionSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl bg-white shadow mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 font-semibold text-lg text-marriott hover:bg-marriott/5 rounded-t-xl focus:outline-none transition"
        type="button"
      >
        <span>{title}</span>
        <span className="text-2xl">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 animate-fade-in">{children}</div>
      )}
    </div>
  );
}
