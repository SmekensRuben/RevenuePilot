import React from "react";

/**
 * Sidebar menu for settings (only shown on md+ screens).
 * @param {Object[]} tabs
 * @param {string} activeTab
 * @param {function} onSelectTab
 */
export default function SettingsSidebar({ tabs, activeTab, onSelectTab }) {
  return (
    <aside className="h-full w-64 border-r border-gray-200 bg-white pt-6 pb-4 hidden md:flex flex-col">
      <nav>
        <ul className="flex flex-col gap-1">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <button
                type="button"
                className={`
                  w-full text-left px-4 py-2 rounded-lg
                  font-medium text-base
                  transition
                  ${activeTab === tab.key
                    ? "bg-primary-100 text-primary-700"
                    : "text-gray-700 hover:bg-gray-100"
                  }
                `}
                aria-current={activeTab === tab.key ? "page" : undefined}
                onClick={() => onSelectTab?.(tab)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
