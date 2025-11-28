import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHotelContext } from "contexts/HotelContext";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { getStockCountReport } from "./stockCountService";
import { getArticles } from "services/firebaseArticles";
import { getRecipes } from "services/firebaseRecipes";
import { getIngredients } from "services/firebaseIngredients";
import { calculateRecipeCost } from "../recipes/recipeHelpers";
import { db } from "../../firebaseConfig";
import { getCategoryLabels, buildRows, calculateKpi } from "./reportHelpers";
import ReportTableRow from "./ReportTableRow";
import { exportRowsToExcel } from "./reportHelpers";
import ReportProductCard from "./ReportProductCard";
import { resyncInventoryWithStockCount } from "./stockCountService";

export default function StockCountReportPage() {
  const { tellingId } = useParams();
  const { hotelUid, hotelName } = useHotelContext();
  const [report, setReport] = useState(null);
  const [articles, setArticles] = useState({});
  const [categoryLabels, setCategoryLabels] = useState({});
  const [rows, setRows] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("ALLE");
  const [searchTerm, setSearchTerm] = useState("");

  const [kpi, setKpi] = useState({
    totalValue: 0,
    totalProducts: 0,
    totalDeviations: 0,
    biggestDeviation: { name: "", diff: 0, percent: 0 }
  });
  const locaties = report && report.locations ? Object.keys(report.locations) : [];
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // --- Toegevoegd
  const [selectedCategories, setSelectedCategories] = useState([]);
  function toggleCategory(cat) {
    setSelectedCategories(selected =>
      selected.includes(cat)
        ? selected.filter(c => c !== cat)
        : [...selected, cat]
    );
  }
  // Sorting
  const [sortBy, setSortBy] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  function handleSort(column) {
    if (sortBy === column) setSortAsc(a => !a);
    else {
      setSortBy(column);
      setSortAsc(true);
    }
  }
  // ---

  useEffect(() => {
    async function fetchData() {
      if (!hotelUid || !tellingId) return;
      setLoading(true);

      const r = await getStockCountReport(hotelUid, tellingId);
      setReport(r);

      const [artArr, recArr, ingArr] = await Promise.all([
        getArticles(hotelUid),
        getRecipes(hotelUid),
        getIngredients(hotelUid),
      ]);
      const artMap = {};
      for (const art of artArr) artMap[art.id] = art;
      for (const rec of recArr) {
        const cost = calculateRecipeCost(rec, ingArr, artArr);
        const pricePerStockUnit = cost / Number(rec.content || 1);
        artMap[rec.id] = {
          ...rec,
          pricePerStockUnit,
          price: pricePerStockUnit,
          stockUnit: rec.contentUnit || "",
        };
      }
      setArticles(artMap);

      const labels = await getCategoryLabels(db, hotelUid);
      setCategoryLabels(labels);

      setLoading(false);
    }
    fetchData();
  }, [hotelUid, tellingId]);

  useEffect(() => {
  if (!report || !articles || !categoryLabels) return;
  const categories = report?.categories || [];
  const newRows = buildRows({ report, ingredients: articles, categoryLabels, categories, selectedLocation });
  setRows(newRows);
  setKpi(calculateKpi(newRows));
  setSelectedCategories(categories);
}, [report, articles, categoryLabels, selectedLocation]); // <-- hier!


  if (loading) {
    return (
      <>
        <HeaderBar hotelName={hotelName} />
        <PageContainer className="max-w-5xl px-2 py-8">
          <h1 className="text-2xl font-bold mb-4">Stocktelling Rapport</h1>
          <div className="text-center text-gray-400 py-8">Gegevens laden...</div>
        </PageContainer>
      </>
    );
  }

  // Categorieën uit telling
  const categories = report?.categories || [];

  // FILTEREN op geselecteerde categorieën
  let filteredRows =
    selectedCategories.length === 0
      ? rows
      : rows.filter(row =>
          categories.some(
            cat =>
              selectedCategories.includes(cat) &&
              (row.category === categoryLabels[cat] || row.category === cat)
          )
        );

  // --- FILTEREN op locatie
  const filteredRowsByLocation =
    selectedLocation === "ALLE"
      ? filteredRows
      : filteredRows.filter(row => row.locations && row.locations.includes(selectedLocation));

  const filteredRowsBySearch = filteredRowsByLocation.filter(row =>
  !searchTerm ||
  (row.name && row.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
  (row.category && row.category.toLowerCase().includes(searchTerm.toLowerCase()))
); 
  // --- SORTEREN (in-memory)
  const sortedRows = [...filteredRowsBySearch].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    // Normalize strings for case-insensitive sort
    if (typeof aValue === "string") aValue = aValue.toLowerCase();
    if (typeof bValue === "string") bValue = bValue.toLowerCase();

    if (aValue < bValue) return sortAsc ? -1 : 1;
    if (aValue > bValue) return sortAsc ? 1 : -1;
    return 0;
  });

  // --- KPI’s op basis van gefilterde en gesorteerde rows
  const kpiFiltered = calculateKpi(sortedRows);

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer className="max-w-5xl px-2 py-8">
        <h1 className="text-2xl font-bold mb-4">Stocktelling Rapport</h1>
        {/* Categorie-tags */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {categories.map(cat => {
            const selected = selectedCategories.includes(cat);
            return (
              <span
                key={cat}
                className={`
                  flex items-center justify-center
                  h-8 px-3 py-1 rounded-full
                  font-semibold text-sm cursor-pointer select-none border transition
                  ${selected
                    ? "bg-marriott text-white border-marriott"
                    : "bg-marriott/10 text-marriott border-transparent"}
                `}
                onClick={() => toggleCategory(cat)}
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") toggleCategory(cat); }}
                role="button"
                aria-pressed={selected}
              >
                {categoryLabels[cat] || cat}
              </span>
            );
          })}
          <div className="flex-1" />

  <div className="flex gap-2"></div>
          <button
  className="btn bg-marriott text-white px-4 py-2 rounded"
  onClick={async () => {
    await resyncInventoryWithStockCount({
      hotelUid,
      tellingId,
      report,
      categories,
      locations: Object.keys(report.locations || {}),
    });
    alert("Inventory succesvol gesynchroniseerd met de stocktelling!");
  }}
>
  Resync Inventory
</button>

          <button
  className="ml-auto btn bg-marriott text-white px-4 py-2 rounded"
  onClick={() => exportRowsToExcel({
    report,
    articles,
    categoryLabels,
    categories,
    locaties: ["ALLE", ...locaties],
    meta: {
      date: report?.date ? new Date(report.date).toLocaleDateString() : "",
      categories: categories.map(c => categoryLabels[c] || c),
    },
  })}
>
  Exporteer naar Excel
</button>
        </div>
        {/* KPI's op basis van filter */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl shadow bg-white px-5 py-4 flex flex-col items-center">
            <div className="text-gray-500 text-xs mb-1">Totale waarde</div>
            <div className="text-lg font-bold">€ {kpiFiltered.totalValue.toFixed(2)}</div>
          </div>
          <div className="rounded-xl shadow bg-white px-5 py-4 flex flex-col items-center">
            <div className="text-gray-500 text-xs mb-1">Producten geteld</div>
            <div className="text-lg font-bold">{kpiFiltered.totalProducts}</div>
          </div>
          <div className="rounded-xl shadow bg-white px-5 py-4 flex flex-col items-center">
            <div className="text-gray-500 text-xs mb-1">Afwijkingen &gt;10%</div>
            <div className="text-lg font-bold">{kpiFiltered.totalDeviations}</div>
          </div>
          <div className="rounded-xl shadow bg-white px-5 py-4 flex flex-col items-center">
            <div className="text-gray-500 text-xs mb-1">Grootste afwijking</div>
            <div className="text-lg font-bold">
              {kpiFiltered.biggestDeviation.name}<br />
              <span className={kpiFiltered.biggestDeviation.percent > 0 ? "text-green-600" : "text-red-600"}>
                {kpiFiltered.biggestDeviation.diff > 0 ? "+" : ""}
                {kpiFiltered.biggestDeviation.diff} ({kpiFiltered.biggestDeviation.percent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
        {/* Locatie dropdown */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
  <div className="flex items-center gap-2">
    <label className="font-semibold">Locatie:</label>
    <select
      className="rounded border border-gray-300 p-2"
      value={selectedLocation}
      onChange={e => setSelectedLocation(e.target.value)}
    >
      <option value="ALLE">Alle locaties</option>
      {locaties.map(loc => (
        <option key={loc} value={loc}>{loc}</option>
      ))}
    </select>
  </div>
  <div className="flex items-center gap-2 flex-1">
    <label className="font-semibold">Zoeken:</label>
    <input
      type="text"
      className="border rounded px-3 py-2 w-full max-w-xs"
      placeholder="Zoek op productnaam..."
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
    />
  </div>
</div>


        {/* Mobile: cards */}
        <div className="md:hidden">
          {sortedRows.length === 0 ? (
            <div className="text-center text-gray-400 py-6">Geen producten gevonden.</div>
          ) : (
            sortedRows.map(row => <ReportProductCard key={row.id} row={row} />)
          )}
        </div>
        {/* Desktop: tabel */}
        <div className="hidden md:block overflow-auto rounded-xl shadow bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left max-w-[200px] cursor-pointer" onClick={() => handleSort("name")}>
                  Product
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => handleSort("unit")}>
                  Eenheid
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => handleSort("countedPrice")}>
                  Eenheidsprijs
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => handleSort("nowAmount")}>
                  Geteld
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => handleSort("valueDiff")}>
                  Verschil (€)
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => handleSort("value")}>
                  Totale waarde 
                </th>
                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort("category")}>
                  Categorie 
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-6 text-gray-400">Geen producten gevonden.</td>
                </tr>
              ) : (
                sortedRows.map(row => (
                  <tr key={row.id}>
                    {/* Product + eenheid */}
                    <td className="p-3 max-w-[200px]">{row.name}</td>
                    <td className="p-3 text-right">{row.unit}</td>                     
                    <td className="p-3 text-right">€ {row.countedPrice.toFixed(2)}</td>
                    <td className="p-3 text-right">{row.nowAmount.toFixed(2)}</td>
                    <td className="p-3 text-right">{row.valueDiff >= 0 ? "+" : ""}€ {row.valueDiff.toFixed(2)}</td>
                    <td className="p-3 text-right">€ {row.value.toFixed(2)}</td>
                    <td className="p-3">{row.category}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Terug-knop */}
        <div className="mt-6">
          <button
            className="px-6 py-2 rounded-xl bg-gray-100 font-semibold"
            onClick={() => navigate("/stockcount")}
          >
            Terug naar overzicht
          </button>
        </div>
      </PageContainer>
    </>
  );
}
