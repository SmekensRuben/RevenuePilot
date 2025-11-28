const BASE_SETTINGS_NAV_TABS = [
  { key: "general", translationKey: "tabs.general" },
  { key: "reporting", translationKey: "tabs.reporting" },
  { key: "ordering", translationKey: "tabs.ordering" },
  { key: "people", translationKey: "tabs.people" },
  { key: "stamgegevens", translationKey: "tabs.stamgegevens" },
  { key: "synchronisatie", translationKey: "tabs.synchronisatie" },
  { key: "mappings", translationKey: "tabs.mappings" },
  { key: "data-upload", translationKey: "tabs.dataUpload" },
  { key: "transfer", translationKey: "tabs.transfer" },
];

const USER_MANAGEMENT_TAB = {
  key: "user-management",
  translationKey: "tabs.userManagement",
  path: "/settings/users",
};

export function getSettingsNavTabs(userRoles = [], translate) {
  const roles = Array.isArray(userRoles) ? userRoles : [];
  const isAdmin = roles.includes("admin");

  const tabs = isAdmin
    ? [...BASE_SETTINGS_NAV_TABS, USER_MANAGEMENT_TAB]
    : BASE_SETTINGS_NAV_TABS;

  if (typeof translate !== "function") {
    return tabs.map(tab => ({
      ...tab,
      label: tab.translationKey,
    }));
  }

  return tabs.map(tab => ({
    ...tab,
    label: translate(tab.translationKey),
  }));
}

export const SETTINGS_NAV_TABS = BASE_SETTINGS_NAV_TABS;
export const USER_MANAGEMENT_TAB_KEY = USER_MANAGEMENT_TAB.key;
