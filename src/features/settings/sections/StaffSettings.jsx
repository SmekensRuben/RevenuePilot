import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import AddStaffForm from "../cards/AddStaffForm";
import StaffList from "../components/StaffList";
import { useHotelContext } from "contexts/HotelContext";
import { getIncompleteTicketsForStaff } from "utils/staff";

const ALL_OPTION = "all";
const MISSING_DEPARTMENT_OPTION = "__missing_department__";
const MISSING_CONTRACT_OPTION = "__missing_contract__";

export default function StaffSettings({
  staff = [],
  salesPromoTickets = [],
  handleAddStaff,
  contractTypes = [],
}) {
  const { roles } = useHotelContext();
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const handleAdd = async form => {
    await handleAddStaff(form);
    setShowAddForm(false);
  };

  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_OPTION);
  const [contractTypeFilter, setContractTypeFilter] = useState(ALL_OPTION);

  const staffWithRemarks = useMemo(() => {
    return staff.map(member => {
      const incompleteTickets = getIncompleteTicketsForStaff(member, salesPromoTickets);
      const uncorrectedTickets = incompleteTickets.filter(ticket => !ticket?.corrected);
      const ticketNumbers = Array.from(
        new Set(
          uncorrectedTickets
            .map(ticket => `${ticket?.receiptNumber || ticket?.ticketNumber || ticket?.id || ""}`.trim())
            .filter(Boolean)
        )
      );

      return {
        ...member,
        remarksCount: ticketNumbers.length,
      };
    });
  }, [staff, salesPromoTickets]);

  const departmentOptions = useMemo(() => {
    const unique = new Set();
    let hasMissing = false;

    staffWithRemarks.forEach(member => {
      const value = (member?.department || "").trim();
      if (value) {
        unique.add(value);
      } else {
        hasMissing = true;
      }
    });

    const options = Array.from(unique)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map(value => ({ value, label: value }));

    if (hasMissing) {
      options.push({ value: MISSING_DEPARTMENT_OPTION, label: "Geen afdeling" });
    }

    return [{ value: ALL_OPTION, label: "Alle afdelingen" }, ...options];
  }, [staffWithRemarks]);

  const contractTypeOptions = useMemo(() => {
    const unique = new Set();
    let hasMissing = false;

    staffWithRemarks.forEach(member => {
      const value = (member?.contractType || "").trim();
      if (value) {
        unique.add(value);
      } else {
        hasMissing = true;
      }
    });

    const options = Array.from(unique)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map(value => ({ value, label: value }));

    if (hasMissing) {
      options.push({ value: MISSING_CONTRACT_OPTION, label: "Geen contracttype" });
    }

    return [{ value: ALL_OPTION, label: "Alle contracttypes" }, ...options];
  }, [staffWithRemarks]);

  const filteredStaff = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = staffWithRemarks
      .filter(member => {
        if (!normalizedQuery) return true;
        const name = String(member?.name || "").toLowerCase();
        return name.includes(normalizedQuery);
      })
      .filter(member => {
        if (departmentFilter === ALL_OPTION) return true;
        const normalizedDepartment = String(member?.department || "").trim().toLowerCase();
        if (departmentFilter === MISSING_DEPARTMENT_OPTION) {
          return normalizedDepartment === "";
        }
        return normalizedDepartment === departmentFilter.trim().toLowerCase();
      })
      .filter(member => {
        if (contractTypeFilter === ALL_OPTION) return true;
        const normalizedContract = String(member?.contractType || "").trim().toLowerCase();
        if (contractTypeFilter === MISSING_CONTRACT_OPTION) {
          return normalizedContract === "";
        }
        return normalizedContract === contractTypeFilter.trim().toLowerCase();
      });

    const parseNumber = value => {
      if (value === null || value === undefined || value === "") return 0;
      const numeric = typeof value === "number" ? value : Number.parseFloat(value);
      return Number.isNaN(numeric) ? 0 : numeric;
    };

    const getSortValue = member => {
      switch (sortField) {
        case "job":
          return String(member?.job || "").trim().toLowerCase();
        case "department":
          return String(member?.department || "").trim().toLowerCase();
        case "contractType":
          return String(member?.contractType || "").trim().toLowerCase();
        case "contractHours":
          return parseNumber(member?.contractHours);
        case "remarksCount":
          return Number.isFinite(member?.remarksCount) ? member.remarksCount : 0;
        case "name":
        default:
          return String(member?.name || "").trim().toLowerCase();
      }
    };

    const direction = sortDir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (typeof valueA === "number" && typeof valueB === "number") {
        if (valueA === valueB) {
          return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" });
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
      });
    });

    return sorted;
  }, [
    staffWithRemarks,
    searchQuery,
    departmentFilter,
    contractTypeFilter,
    sortField,
    sortDir,
  ]);

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

  const handleSelect = member => {
    const id = member.id || member.key || member.name;
    if (id) {
      navigate(`/finance/staff/${encodeURIComponent(id)}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Personeel</h1>
          <p className="text-sm text-gray-600">Beheer alle personeelsleden en hun contractinformatie.</p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAddForm(prev => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-marriott text-white shadow transition hover:bg-marriott-dark"
            aria-label={showAddForm ? "Sluit formulier" : "Nieuw personeelslid"}
            title={showAddForm ? "Annuleer" : "Nieuw personeelslid"}
          >
            {showAddForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="max-w-2xl">
          <AddStaffForm
            onAdd={handleAdd}
            onCancel={() => setShowAddForm(false)}
            canEditHourlyWage={isAdmin}
            contractTypes={contractTypes}
          />
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="staff-search">
            Zoek op naam
          </label>
          <input
            id="staff-search"
            type="search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Zoek personeelsleden"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end lg:w-auto lg:justify-end">
          <div className="w-full sm:w-56">
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="staff-department-filter">
              Department
            </label>
            <select
              id="staff-department-filter"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={departmentFilter}
              onChange={event => setDepartmentFilter(event.target.value)}
            >
              {departmentOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-56">
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="staff-contract-filter">
              Contract type
            </label>
            <select
              id="staff-contract-filter"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={contractTypeFilter}
              onChange={event => setContractTypeFilter(event.target.value)}
            >
              {contractTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <StaffList
        staff={filteredStaff}
        onSelect={handleSelect}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  );
}
