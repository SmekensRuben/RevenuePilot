import React from "react";
import { Menu } from "@headlessui/react";
import { ChevronDown } from "lucide-react";

export function DashboardDropdown({ title, children }) {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button className="inline-flex items-center gap-1 bg-[#b41f1f] text-white px-3 py-1.5 rounded-md font-semibold text-sm">
        {title}
        <ChevronDown className="w-4 h-4" />
      </Menu.Button>
      <Menu.Items className="absolute left-0 mt-1 w-56 origin-top-left rounded-md bg-white text-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
        <div className="py-1">{children}</div>
      </Menu.Items>
    </Menu>
  );
}

export function DashboardMenuItem({ icon: Icon, title, onClick, disabled }) {
  return (
    <Menu.Item disabled={disabled}>
      {({ active }) => (
        <button
          type="button"
          onClick={onClick}
          className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {Icon && <Icon className="w-4 h-4 text-marriott" />}
          {title}
        </button>
      )}
    </Menu.Item>
  );
}

export function SidebarMenuItem({ icon: Icon, title, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {Icon && <Icon className="w-4 h-4 text-marriott" />}
      {title}
    </button>
  );
}
