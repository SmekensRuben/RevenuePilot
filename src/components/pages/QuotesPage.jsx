import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { deleteQuote, subscribeQuotes } from "../../services/firebaseQuotes";

const columns = [
  { key: "company", label: "Company", isNumeric: false },
  { key: "startDate", label: "Start Date", isNumeric: false },
  { key: "endDate", label: "End Date", isNumeric: false },
  { key: "rooms", label: "Rooms", isNumeric: true },
  { key: "quotedPrice", label: "Quoted Price", isNumeric: true },
  { key: "quoteDate", label: "Quote Date", isNumeric: false },
  { key: "actions", label: "Acties", isNumeric: false },
];

function normalizeDate(value) {
  if (!value) return "";
  return value;
}

export default function QuotesPage() {
  const navigate = useNavigate();
  const { hotelUid } = useHotelContext();
  const [quotes, setQuotes] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [quoteDateFilter, setQuoteDateFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "quoteDate", direction: "desc" });

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }),
    []
  );

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!hotelUid) {
      setQuotes([]);
      return undefined;
    }
    const unsubscribe = subscribeQuotes(hotelUid, setQuotes);
    return () => unsubscribe();
  }, [hotelUid]);

  const filteredQuotes = useMemo(() => {
    const companyQuery = companyFilter.trim().toLowerCase();
    return quotes.filter((quote) => {
      const matchesCompany = companyQuery
        ? String(quote.company || "").toLowerCase().includes(companyQuery)
        : true;
      const startDate = normalizeDate(quote.startDate);
      const endDate = normalizeDate(quote.endDate);
      const matchesRangeStart = rangeStart ? startDate >= rangeStart : true;
      const matchesRangeEnd = rangeEnd ? endDate <= rangeEnd : true;
      const matchesQuoteDate = quoteDateFilter
        ? normalizeDate(quote.quoteDate) === quoteDateFilter
        : true;
      return matchesCompany && matchesRangeStart && matchesRangeEnd && matchesQuoteDate;
    });
  }, [companyFilter, quotes, quoteDateFilter, rangeEnd, rangeStart]);

  const sortedQuotes = useMemo(() => {
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
    const sorted = [...filteredQuotes].sort((a, b) => {
      const aValue = a?.[sortConfig.key];
      const bValue = b?.[sortConfig.key];
      const numericValue = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };
      const aNumeric = numericValue(aValue);
      const bNumeric = numericValue(bValue);

      if (aNumeric !== null && bNumeric !== null) {
        return (aNumeric - bNumeric) * directionMultiplier;
      }

      return String(aValue || "").localeCompare(String(bValue || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * directionMultiplier;
    });
    return sorted;
  }, [filteredQuotes, sortConfig]);

  const handleSort = (columnKey) => {
    if (columnKey === "actions") return;
    setSortConfig((current) => {
      if (current.key === columnKey) {
        return {
          key: columnKey,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const handleDelete = async (quoteId) => {
    if (!hotelUid || !quoteId) return;
    if (!window.confirm("Weet je zeker dat je deze quote wilt verwijderen?")) return;
    await deleteQuote(hotelUid, quoteId);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">Quotes</p>
            <h1 className="text-2xl sm:text-3xl font-bold">Quotes overzicht</h1>
            <p className="text-gray-600 mt-1">
              Houd een overzicht bij van alle gemaakte quotes en filter per periode of company.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => navigate("/quotes/new")}
              className="bg-[#b41f1f] text-white px-3 py-2 rounded-full shadow hover:bg-[#961919] transition-colors"
              aria-label="Nieuwe quote aanmaken"
              title="Nieuwe quote aanmaken"
            >
              <Plus className="h-5 w-5" />
              <span className="sr-only">Nieuwe quote aanmaken</span>
            </button>
          </div>
        </div>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Filters</h2>
            <p className="text-sm text-gray-600">
              Filter op company, datumrange of quote datum.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col text-sm font-semibold text-gray-700 w-56">
              Company name
              <input
                type="text"
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Zoek company"
              />
            </label>
            <label className="flex flex-col text-sm font-semibold text-gray-700 w-44">
              Start date
              <input
                type="date"
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col text-sm font-semibold text-gray-700 w-44">
              End date
              <input
                type="date"
                value={rangeEnd}
                onChange={(event) => setRangeEnd(event.target.value)}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col text-sm font-semibold text-gray-700 w-44">
              Quote date
              <input
                type="date"
                value={quoteDateFilter}
                onChange={(event) => setQuoteDateFilter(event.target.value)}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Quotes</h2>
              <p className="text-sm text-gray-600">
                {filteredQuotes.length} quote{filteredQuotes.length === 1 ? "" : "s"} gevonden
              </p>
            </div>
          </div>
          {filteredQuotes.length === 0 ? (
            <p className="text-gray-600">Nog geen quotes gevonden voor deze filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((column) => {
                      if (column.key === "actions") {
                        return (
                          <th
                            key={column.key}
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                          >
                            {column.label}
                          </th>
                        );
                      }
                      const isActiveSort = sortConfig.key === column.key;
                      const sortIndicator = isActiveSort
                        ? sortConfig.direction === "asc"
                          ? "▲"
                          : "▼"
                        : "⇅";
                      return (
                        <th
                          key={column.key}
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(column.key)}
                            className="inline-flex items-center gap-2 focus:outline-none"
                          >
                            <span>{column.label}</span>
                            <span className="text-gray-400 text-[10px]">{sortIndicator}</span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {sortedQuotes.map((quote) => (
                    <tr key={quote.id}>
                      <td className="px-4 py-3 text-sm text-gray-800">{quote.company || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{quote.startDate || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{quote.endDate || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{quote.rooms || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {quote.quotedPrice !== ""
                          ? currencyFormatter.format(Number(quote.quotedPrice) || 0)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">{quote.quoteDate || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/quotes/${quote.id}`)}
                            className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                            aria-label="Quote bewerken"
                            title="Quote bewerken"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(quote.id)}
                            className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                            aria-label="Quote verwijderen"
                            title="Quote verwijderen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}
