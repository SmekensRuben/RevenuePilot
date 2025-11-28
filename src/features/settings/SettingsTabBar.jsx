import React from "react";

/**
 * Mobile tabbar (horizontaal scrollbaar op mobile).
 * @param {Object[]} tabs
 * @param {string} activeTab
 * @param {function} onSelectTab
 */
export default function SettingsTabBar({ tabs, activeTab, onSelectTab, ariaLabel = "Settings tabs" }) {
  return (
    <nav
      className="
        w-full
        overflow-x-auto
        border-b border-gray-200
        bg-white
        sticky top-0 z-10
      "
      aria-label={ariaLabel}
    >
      <ul
        className="
          flex
          flex-nowrap
          gap-1
          px-2
          md:justify-start
          md:overflow-x-visible
          scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
        "
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {tabs.map((tab) => (
          <li key={tab.key} className="shrink-0">
            <button
              type="button"
              className={`
                whitespace-nowrap
                px-4 py-2
                rounded-t-lg
                font-medium
                text-sm
                focus:outline-none
                transition
                ${activeTab === tab.key
                  ? "bg-primary-100 text-primary-700 border-b-2 border-primary-600"
                  : "bg-white text-gray-500 hover:bg-gray-50"
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
  );
}
