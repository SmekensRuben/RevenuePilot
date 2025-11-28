import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import AddOutletForm from "../cards/AddOutletForm";
import OutletList from "./components/OutletList";
import { useHotelContext } from "contexts/HotelContext";
import { getSettings, getOutlets, setOutlets } from "services/firebaseSettings";
import { getSelectedHotelUid } from "utils/hotelUtils";
import { useTranslation } from "react-i18next";

const ALL_DEPARTMENTS = "__all__";

export default function OutletListPage() {
  const { hotelName: hotelContextName, language } = useHotelContext?.() || {};
  const hotelUid = getSelectedHotelUid();
  const navigate = useNavigate();
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
    () =>
      new Date().toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [locale]
  );

  const [settings, setSettingsState] = useState({});
  useEffect(() => {
    if (!hotelUid) return;
    getSettings(hotelUid).then(setSettingsState);
  }, [hotelUid]);

  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const [outlets, setOutletsState] = useState([]);
  useEffect(() => {
    if (!hotelUid) return;
    getOutlets(hotelUid).then(data => setOutletsState(Array.isArray(data) ? data : []));
  }, [hotelUid]);

  const handleAddOutlet = async outletObj => {
    const newOutlets = [...outlets, outletObj];
    const savedOutlets = await setOutlets(hotelUid, newOutlets);
    setOutletsState(Array.isArray(savedOutlets) ? savedOutlets : newOutlets);
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const departmentOptions = useMemo(() => {
    const unique = new Set();
    outlets.forEach(outlet => {
      const value = (outlet?.department || "").trim();
      if (value) {
        unique.add(value);
      }
    });

    return [ALL_DEPARTMENTS, ...Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))];
  }, [outlets]);

  const filteredOutlets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = outlets
      .filter(outlet => {
        if (!normalizedQuery) return true;
        const name = String(outlet?.name || "").toLowerCase();
        const description = String(outlet?.description || "").toLowerCase();
        return name.includes(normalizedQuery) || description.includes(normalizedQuery);
      })
      .filter(outlet => {
        if (departmentFilter === ALL_DEPARTMENTS) return true;
        const department = String(outlet?.department || "").trim().toLowerCase();
        return department === departmentFilter.trim().toLowerCase();
      });

    const getSortValue = outlet => {
      switch (sortField) {
        case "department":
          return String(outlet?.department || "").trim().toLowerCase();
        case "outletId":
          return String(outlet?.outletId || "").trim().toLowerCase();
        case "costCenterIds": {
          const ids = Array.isArray(outlet?.costCenterIds) ? outlet.costCenterIds : [];
          return ids.length;
        }
        case "subOutlets":
          return Array.isArray(outlet?.subOutlets) ? outlet.subOutlets.length : 0;
        case "name":
        default:
          return String(outlet?.name || "").trim().toLowerCase();
      }
    };

    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (typeof valueA === "number" && typeof valueB === "number") {
        if (valueA === valueB) {
          return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
            sensitivity: "base",
          }) * direction;
        }
        return (valueA - valueB) * direction;
      }

      const comparison = String(valueA || "").localeCompare(String(valueB || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (comparison !== 0) {
        return comparison * direction;
      }
      return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      }) * direction;
    });
  }, [outlets, searchQuery, departmentFilter, sortField, sortDir]);

  const handleSort = field => {
    setSortField(previousField => {
      if (previousField === field) {
        setSortDir(prevDir => (prevDir === "asc" ? "desc" : "asc"));
        return previousField;
      }
      setSortDir("asc");
      return field;
    });
  };

  const handleSelect = outlet => {
    const id = outlet.id || outlet.name;
    if (!id) return;
    navigate(`/settings/outlets/${encodeURIComponent(id)}`);
  };

  const toggleAddForm = () => setShowAddForm(prev => !prev);

  return (
    <>
      <HeaderBar
        hotelName={settings.hotelName || hotelContextName}
        today={today}
        onLogout={handleLogout}
      />
      <PageContainer className="flex-1 bg-gray-50 min-h-screen">
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Outlets</h1>
                <p className="text-sm text-gray-600">Beheer en bekijk alle outlets van het hotel.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="bg-marriott text-white px-4 py-2 rounded font-semibold hover:bg-marriott-dark"
                  onClick={toggleAddForm}
                >
                  {showAddForm ? "Sluit formulier" : "Nieuwe outlet"}
                </button>
              </div>
            </div>

            {showAddForm && (
              <AddOutletForm onAdd={handleAddOutlet} />
            )}

            <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div className="flex flex-col gap-2 w-full lg:max-w-sm">
                  <label className="text-sm font-medium text-gray-700" htmlFor="outlet-search">
                    Zoek op naam of beschrijving
                  </label>
                  <input
                    id="outlet-search"
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
                    placeholder="Zoekterm"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full lg:max-w-xs">
                  <label className="text-sm font-medium text-gray-700" htmlFor="department-filter">
                    Filter op afdeling
                  </label>
                  <select
                    id="department-filter"
                    value={departmentFilter}
                    onChange={e => setDepartmentFilter(e.target.value)}
                    className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
                  >
                    <option value={ALL_DEPARTMENTS}>Alle afdelingen</option>
                    {departmentOptions
                      .filter(option => option !== ALL_DEPARTMENTS)
                      .map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <OutletList
                outlets={filteredOutlets}
                onSelect={handleSelect}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
            </div>
          </div>
        </main>
      </PageContainer>
    </>
  );
}
