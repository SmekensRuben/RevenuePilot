import React from "react";
import { X } from "lucide-react";
import { SidebarMenuItem } from "./DashboardDropdown";

export default function MobileSidebar({ open, onClose, sections }) {
  return (
    <div
      className={`fixed inset-0 z-40 transition-transform transform ${open ? 'translate-x-0' : '-translate-x-full'} md:hidden`}
    >
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative bg-white w-64 h-full p-4 overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600"
          aria-label="Close menu"
        >
          <X className="w-6 h-6" />
        </button>
        {sections.map((section) => (
          <div key={section.title} className="mt-8 first:mt-0">
            <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase">
              {section.title}
            </h3>
            <div className="mt-2 flex flex-col">
              {section.items.map((item) => {
                if (item.type === "label") {
                  if (item.canView === false) return null;
                  return (
                    <div
                      key={`${section.title}-${item.title}`}
                      className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {item.title}
                    </div>
                  );
                }

                return (
                  <SidebarMenuItem
                    key={item.title}
                    icon={item.icon}
                    title={item.title}
                    onClick={() => {
                      onClose();
                      if (item.canView) item.onClick();
                    }}
                    disabled={!item.canView}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

