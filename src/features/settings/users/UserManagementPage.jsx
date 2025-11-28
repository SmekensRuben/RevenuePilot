import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import SettingsSidebar from "../SettingsSidebar";
import SettingsTabBar from "../SettingsTabBar";
import { getSettingsNavTabs, USER_MANAGEMENT_TAB_KEY } from "../settingsNavTabs";
import { useHotelContext } from "contexts/HotelContext";
import { getSelectedHotelUid } from "utils/hotelUtils";
import { getAllUsers, updateUserRoles } from "services/firebaseUserManagement";
import { ROLE_PERMISSIONS } from "constants/roles";
import { useTranslation } from "react-i18next";

const AVAILABLE_ROLES = Object.keys(ROLE_PERMISSIONS).sort();
const DATE_OPTIONS = { weekday: "long", month: "long", day: "numeric" };

function usesHotelRoleStructure(user) {
  return (
    !!user &&
    typeof user.roles === "object" &&
    user.roles !== null &&
    !Array.isArray(user.roles)
  );
}

function getRolesForUser(user, hotelUid) {
  if (!user) return [];

  if (Array.isArray(user.roles)) {
    return user.roles;
  }

  if (usesHotelRoleStructure(user)) {
    if (!hotelUid) return [];
    const rolesForHotel = user.roles?.[hotelUid];
    return Array.isArray(rolesForHotel) ? rolesForHotel : [];
  }

  return [];
}

function extractHotels(user) {
  if (!user) return [];
  if (Array.isArray(user.hotelUids)) {
    return user.hotelUids.filter(Boolean);
  }
  if (Array.isArray(user.hotelUid)) {
    return user.hotelUid.filter(Boolean);
  }
  if (typeof user.hotelUid === "string" && user.hotelUid) {
    return [user.hotelUid];
  }
  return [];
}

function formatUserName(user, translate) {
  const unknown = typeof translate === "function"
    ? translate("userManagement.unknownUser")
    : "Onbekende gebruiker";
  if (!user) return unknown;
  const fromDisplay = user.displayName || user.name;
  if (fromDisplay) return fromDisplay;

  const composed = [user.firstName, user.lastName].filter(Boolean).join(" ");
  if (composed) return composed;

  return user.email || user.id || unknown;
}

export default function UserManagementPage() {
  const navigate = useNavigate();
  const {
    hotelName = "Hotel",
    roles: currentUserRoles = [],
    language,
  } = useHotelContext?.() || {};
  const hotelUid = getSelectedHotelUid();
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const locale = useMemo(() => {
    switch (language) {
      case "en":
        return "en-GB";
      case "fr":
        return "fr-FR";
      default:
        return "nl-NL";
    }
  }, [language]);
  const today = useMemo(
    () => new Date().toLocaleDateString(locale, DATE_OPTIONS),
    [locale]
  );

  const tabs = useMemo(
    () => getSettingsNavTabs(currentUserRoles, key => t(key)),
    [currentUserRoles, t]
  );

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [nameFilter, setNameFilter] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
      setAlert(null);
    } catch (error) {
      console.error("Kon gebruikers niet laden:", error);
      setAlert({
        type: "error",
        message: t("userManagement.loadError"),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, hotelUid]);

  useEffect(() => {
    if (!alert) return undefined;
    const timeout = window.setTimeout(() => setAlert(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [alert]);

  const hotelUsers = useMemo(() => {
    return users
      .map(user => ({
        ...user,
        _displayName: formatUserName(user, t),
        _hotels: extractHotels(user),
      }))
      .filter(user => {
        if (!hotelUid) return true;
        if (user._hotels.includes(hotelUid)) {
          return true;
        }
        const hotelRoles = getRolesForUser(user, hotelUid);
        return hotelRoles.length > 0;
      })
      .sort((a, b) => a._displayName.localeCompare(b._displayName));
  }, [users, hotelUid, t]);

  const filteredUsers = useMemo(() => {
    const query = nameFilter.trim().toLowerCase();
    if (!query) {
      return hotelUsers;
    }
    return hotelUsers.filter(user =>
      user._displayName.toLowerCase().includes(query)
    );
  }, [hotelUsers, nameFilter]);

  const hasActiveFilter = Boolean(nameFilter.trim());

  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const handleSelectTab = tab => {
    if (tab.path) {
      navigate(tab.path);
      return;
    }

    const params = new URLSearchParams();
    params.set("tab", tab.key);
    navigate({ pathname: "/settings", search: params.toString() });
  };

  const handleAddRole = async (userId, role) => {
    if (!role) return;
    const targetUser = users.find(user => user.id === userId);
    if (!targetUser) return;

    const perHotelStructure = usesHotelRoleStructure(targetUser);
    if (perHotelStructure && !hotelUid) {
      setAlert({
        type: "error",
        message: t("userManagement.roleHotelMissing"),
      });
      return;
    }

    const currentRoles = getRolesForUser(targetUser, hotelUid);
    if (currentRoles.includes(role)) return;

    const updatedRoles = [...currentRoles, role];

    setUpdatingUserId(userId);
    setAlert(null);

    try {
      await updateUserRoles(userId, perHotelStructure ? hotelUid : null, updatedRoles);
      setUsers(prevUsers =>
        prevUsers.map(user => {
          if (user.id !== userId) return user;
          if (usesHotelRoleStructure(user)) {
            return {
              ...user,
              roles: {
                ...(typeof user.roles === "object" && user.roles !== null ? user.roles : {}),
                [hotelUid]: updatedRoles,
              },
            };
          }
          return { ...user, roles: updatedRoles };
        })
      );
      setAlert({
        type: "success",
        message: t("userManagement.roleAdded", {
          role,
          user: formatUserName(targetUser, t),
        }),
      });
    } catch (error) {
      console.error("Kon rol niet toevoegen:", error);
      setAlert({
        type: "error",
        message: t("userManagement.roleAddError"),
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRemoveRole = async (userId, role) => {
    const targetUser = users.find(user => user.id === userId);
    if (!targetUser) return;

    const perHotelStructure = usesHotelRoleStructure(targetUser);
    if (perHotelStructure && !hotelUid) {
      setAlert({
        type: "error",
        message: t("userManagement.roleHotelMissing"),
      });
      return;
    }

    const currentRoles = getRolesForUser(targetUser, hotelUid);
    if (!currentRoles.includes(role)) return;

    const updatedRoles = currentRoles.filter(item => item !== role);

    setUpdatingUserId(userId);
    setAlert(null);

    try {
      await updateUserRoles(userId, perHotelStructure ? hotelUid : null, updatedRoles);
      setUsers(prevUsers =>
        prevUsers.map(user => {
          if (user.id !== userId) return user;
          if (usesHotelRoleStructure(user)) {
            return {
              ...user,
              roles: {
                ...(typeof user.roles === "object" && user.roles !== null ? user.roles : {}),
                [hotelUid]: updatedRoles,
              },
            };
          }
          return { ...user, roles: updatedRoles };
        })
      );
      setAlert({
        type: "success",
        message: t("userManagement.roleRemoved", {
          role,
          user: formatUserName(targetUser, t),
        }),
      });
    } catch (error) {
      console.error("Kon rol niet verwijderen:", error);
      setAlert({
        type: "error",
        message: t("userManagement.roleRemoveError"),
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer className="flex-1 flex flex-col md:flex-row w-full bg-gray-50 min-h-screen">
        <div className="hidden md:block md:w-64 bg-white border-r border-gray-200">
          <SettingsSidebar
            tabs={tabs}
            activeTab={USER_MANAGEMENT_TAB_KEY}
            onSelectTab={handleSelectTab}
          />
        </div>
        <div className="md:hidden w-full">
          <SettingsTabBar
            tabs={tabs}
            activeTab={USER_MANAGEMENT_TAB_KEY}
            onSelectTab={handleSelectTab}
            ariaLabel={t("navigation.ariaLabel")}
          />
        </div>
        <main className="flex-1 flex flex-col items-center md:items-start px-0 md:px-8 py-4">
          <div className="w-full max-w-full md:max-w-4xl lg:max-w-6xl xl:max-w-7xl flex flex-col gap-6">
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold text-gray-900">{t("userManagement.title")}</h1>
                    <p className="text-sm text-gray-500">
                      {t("userManagement.description")}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="user-name-filter"
                        className="text-sm font-medium text-gray-700"
                      >
                        {t("userManagement.searchLabel")}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="user-name-filter"
                          list="user-name-options"
                          type="search"
                          placeholder={t("userManagement.searchPlaceholder")}
                          value={nameFilter}
                          onChange={event => setNameFilter(event.target.value)}
                          className="w-full md:w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <datalist id="user-name-options">
                          {hotelUsers.map(user => (
                            <option key={user.id} value={user._displayName} />
                          ))}
                        </datalist>
                        {hasActiveFilter && (
                          <button
                            type="button"
                            onClick={() => setNameFilter("")}
                            className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                          >
                            {t("userManagement.reset")}
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={loadUsers}
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t("userManagement.refresh")}
                    </button>
                  </div>
                </div>
                {alert && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      alert.type === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-green-200 bg-green-50 text-green-700"
                    }`}
                  >
                    {alert.message}
                  </div>
                )}
                {loading ? (
                  <div className="py-10 text-center text-sm text-gray-500">
                    {t("userManagement.loading")}
                  </div>
                ) : !hotelUid ? (
                  <div className="py-10 text-center text-sm text-gray-500">
                    {t("userManagement.selectHotel")}
                  </div>
                ) : hotelUsers.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500">
                    {t("userManagement.empty")}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500">
                    {hasActiveFilter
                      ? t("userManagement.emptyFiltered")
                      : t("userManagement.empty")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    {filteredUsers.map(user => {
                      const userRoles = getRolesForUser(user, hotelUid);
                      const availableRoles = AVAILABLE_ROLES.filter(
                        role => !userRoles.includes(role)
                      );
                      const initials = user._displayName
                        .split(" ")
                        .filter(Boolean)
                        .map(part => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "U";

                      return (
                        <article
                          key={user.id}
                          className="flex h-full w-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                        >
                          <div className="flex flex-1 flex-col gap-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1">
                                <h2 className="text-lg font-semibold text-gray-900">
                                  {user._displayName}
                                </h2>
                                <p className="text-sm text-gray-500">
                                  {user.email || t("userManagement.noEmail")}
                                </p>
                              </div>
                              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-base font-semibold text-primary-700">
                                {initials}
                              </span>
                            </div>
                            {user._hotels.length > 0 && (
                              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                {user._hotels.map(hotel => (
                                  <span
                                    key={hotel}
                                    className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1"
                                  >
                                    {hotel}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {userRoles.length === 0 ? (
                                <span className="text-sm text-gray-400">
                                  {t("userManagement.noRolesAssigned")}
                                </span>
                              ) : (
                                userRoles.map(role => (
                                  <span
                                    key={role}
                                    className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700"
                                  >
                                    {role}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRole(user.id, role)}
                                      disabled={updatingUserId === user.id}
                                      className="ml-1 text-xs text-primary-600 transition hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <span aria-hidden="true">×</span>
                                      <span className="sr-only">{t("userManagement.removeRole", { role })}</span>
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="mt-6 border-t border-gray-100 pt-4">
                            {availableRoles.length === 0 ? (
                              <p className="text-sm text-gray-400">
                                {t("userManagement.allRolesAssigned")}
                              </p>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor={`add-role-${user.id}`}
                                  className="text-xs font-medium uppercase tracking-wide text-gray-500"
                                >
                                  {t("userManagement.addRoleLabel")}
                                </label>
                                <select
                                  id={`add-role-${user.id}`}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  defaultValue=""
                                  disabled={updatingUserId === user.id}
                                  onChange={event => {
                                    const value = event.target.value;
                                    if (!value) return;
                                    handleAddRole(user.id, value);
                                    event.target.value = "";
                                  }}
                                >
                                  <option value="" disabled hidden>
                                    {t("userManagement.addRolePlaceholder")}
                                  </option>
                                  {availableRoles.map(role => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </PageContainer>
    </>
  );
}
