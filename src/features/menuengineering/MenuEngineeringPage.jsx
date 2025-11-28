import React, { useEffect, useState } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useNavigate } from "react-router-dom";
import { getProducts } from "../products/productsService";
import { getIngredients } from "services/firebaseIngredients";
import { getArticlesIndexed } from "services/firebaseArticles";
import { getRecipesIndexed } from "services/firebaseRecipes";
import { getProductCategories, getOutlets } from "services/firebaseSettings";
import { getProductSalesRange } from "services/firebaseSalesSnapshot";
import { calculateCostAndFoodcost } from "../products/productHelpers";
import MenuEngineeringMatrix from "./MenuEngineeringMatrix";
import DownloadPDFButton from "./DownloadPDFButton";

const CLASS_COLORS = {
  Star: "bg-green-100 text-green-800 border-green-300",
  Plowhorse: "bg-blue-100 text-blue-800 border-blue-300",
  Puzzle: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Dog: "bg-red-100 text-red-800 border-red-300",
};

const CLASS_LABELS = {
  Star: "Stars",
  Plowhorse: "Plowhorses",
  Puzzle: "Puzzles",
  Dog: "Dogs",
};

const CLASS_DESCRIPTIONS = {
  Star:
    "Veel verkocht én hoge marge. Dit zijn je paradepaardjes. Koesteren!",
  Plowhorse:
    "Veel verkocht, maar lage marge. Mogelijk prijshervorming of recept optimaliseren.",
  Puzzle:
    "Weinig verkocht, hoge marge. Meer promoten of op betere plek op de kaart zetten.",
  Dog:
    "Weinig verkocht én lage marge. Kandidaten om te schrappen of radicaal te verbeteren.",
};

function getLocalYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


export default function MenuEngineeringPage() {
  const { hotelName, hotelUid } = useHotelContext();
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [productCategories, setProductCategories] = useState({});
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [productType, setProductType] = useState("food");
  const [parentCategoryFilter, setParentCategoryFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [soldCounts, setSoldCounts] = useState({});
  const [results, setResults] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const navigate = useNavigate();

  // Default range: eerste dag van de maand tot vandaag
  useEffect(() => {
  const todayDate = new Date();
  const first = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  setDateFrom(getLocalYYYYMMDD(first));
  setDateTo(getLocalYYYYMMDD(todayDate));
}, []);


  useEffect(() => {
    getProducts(hotelUid).then(setProducts);
    getIngredients(hotelUid).then(setIngredients);
    getArticlesIndexed(hotelUid).then(setArticles);
    getRecipesIndexed(hotelUid).then(setRecipes);
    getProductCategories().then(setProductCategories);
    getOutlets(hotelUid).then(setOutlets);
  }, [hotelUid]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const parentCategoryOptions = React.useMemo(() => {
    const list = Object.entries(productCategories)
      .filter(([_, val]) => !productType || val.type === productType)
      .map(([key, val]) => ({ key, ...val }));
    const map = {};
    list.forEach(cat => {
      map[cat.key] = { ...cat, childCount: 0 };
    });
    list.forEach(cat => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].childCount += 1;
      }
    });
    return Object.values(map)
      .filter(cat => !cat.parentId && cat.childCount > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [productCategories, productType]);

  const categoryOptions = React.useMemo(() => {
    return Object.entries(productCategories)
      .filter(
        ([_, val]) =>
          val.parentId === parentCategoryFilter &&
          (!productType || val.type === productType)
      )
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [productCategories, parentCategoryFilter, productType]);

  useEffect(() => {
    setParentCategoryFilter("");
    setSelectedCategory("");
  }, [productType]);

  const filteredProducts = products.filter(p => {
    if (selectedOutlet && !(Array.isArray(p.outlets) && p.outlets.includes(selectedOutlet))) return false;
    if (selectedCategory) {
      if (p.category !== selectedCategory) return false;
    } else if (parentCategoryFilter) {
      if (productCategories[p.category]?.parentId !== parentCategoryFilter) return false;
    }
    const type = productCategories[p.category]?.type || "";
    if (productType && type !== productType) return false;
    return true;
  });

  // Laad verkochte aantallen op basis van salesByDay
  useEffect(() => {
    if (!hotelUid || !dateFrom || !dateTo || products.length === 0) return;
    getProductSalesRange(hotelUid, dateFrom, dateTo).then(data => {
      const counts = {};
      products.forEach(p => {
        const lsId = String(p.lightspeedId).trim();
        if (data[lsId]) counts[p.id] = data[lsId].qty || 0;
      });
      setSoldCounts(counts);
    });
  }, [hotelUid, dateFrom, dateTo, products]);

  const handleAnalyze = () => {
    const data = filteredProducts.map((p) => {
      const { kostprijs, foodcostPct, verkoopprijsExclBtw } =
        calculateCostAndFoodcost(p, ingredients, recipes, articles);
      const sold = soldCounts[p.id] || 0;
      const marge = verkoopprijsExclBtw - kostprijs;
      return {
        id: p.id,
        product: p.name,
        sold,
        verkoopprijsExclBtw,
        kostprijs,
        foodcostPct,
        marge,
      };
    });
    if (!data.length) return;

    // Bereken gemiddelden
    const avgSold = data.reduce((s, d) => s + d.sold, 0) / data.length || 0;
    const avgMarge = data.reduce((s, d) => s + d.marge, 0) / data.length || 0;

    const rows = data.map((d) => {
      let classification = "Dog";
      if (d.sold >= avgSold && d.marge >= avgMarge) classification = "Star";
      else if (d.sold >= avgSold && d.marge < avgMarge) classification = "Plowhorse";
      else if (d.sold < avgSold && d.marge >= avgMarge) classification = "Puzzle";
      // else blijft Dog
      return {
        ...d,
        classification,
        totalMargin: d.marge * d.sold,
        marginPct: d.verkoopprijsExclBtw > 0 ? (d.marge / d.verkoopprijsExclBtw) * 100 : 0,
      };
    });
    setResults(rows);
  };

  // Data per type
  const matrixGroups = {
    Star: results.filter((r) => r.classification === "Star"),
    Plowhorse: results.filter((r) => r.classification === "Plowhorse"),
    Puzzle: results.filter((r) => r.classification === "Puzzle"),
    Dog: results.filter((r) => r.classification === "Dog"),
  };


  return (
    <>
      <HeaderBar
        hotelName={hotelName}
        today={today}
        onLogout={() => navigate("/login")}
      />
      <PageContainer className="max-w-5xl">
        <h1 className="text-3xl font-bold mb-2">Menu Engineering</h1>
        <p className="text-gray-700 mb-4">
          Ontdek welke gerechten <b>Stars</b>, <b>Plowhorses</b>, <b>Puzzles</b> en <b>Dogs</b> zijn op je menukaart, aan de hand van hun marge en populariteit.
        </p>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1">Van</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1">Tot</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1">Outlet</label>
              <select
                value={selectedOutlet}
                onChange={e => setSelectedOutlet(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="">Alle outlets</option>
                {outlets.map((o, idx) => (
                  <option key={o.id || o.name || idx} value={o.name || ''}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1">Type</label>
              <select
                value={productType}
                onChange={e => setProductType(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="food">Food</option>
                <option value="beverage">Beverage</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1">Hoofdcategorie</label>
              <select
                value={parentCategoryFilter}
                onChange={e => {
                  setParentCategoryFilter(e.target.value);
                  setSelectedCategory("");
                }}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="">Alle hoofdcategorieën</option>
                {parentCategoryOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1">Subcategorie</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                disabled={!parentCategoryFilter}
              >
                <option value="">Alle subcategorieën</option>
                {categoryOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          {filteredProducts.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-left">Kostprijs</th>
                    <th className="p-2 text-left">Aantal verkocht</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod) => {
                    const { kostprijs } = calculateCostAndFoodcost(
                      prod,
                      ingredients,
                      recipes,
                      articles,
                    );
                    return (
                      <tr key={prod.id} className="border-b last:border-b-0">
                        <td className="p-2">{prod.name}</td>
                        <td className="p-2">€{kostprijs.toFixed(2)}</td>
                        <td className="p-2">{soldCounts[prod.id] || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <button
            className="mt-4 bg-marriott text-white px-6 py-2 rounded-xl hover:bg-marriott-dark font-semibold transition"
            onClick={handleAnalyze}
          >
            Analyseer Menu
          </button>
        </div>

        {/* Resultaten */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-semibold mb-2">Resultaten</h2>
          <div className="flex justify-end">
    <DownloadPDFButton
      results={results}
      hotelName={hotelName}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  </div>
          {results.length > 0 ? (
            <>
              {/* Matrix Visualisatie */}
              <div className="my-8 flex flex-col md:flex-row gap-10 items-center">
                <div className="w-full md:w-2/3">
                  <h3 className="text-lg font-bold mb-2">Menu Engineering Matrix</h3>
                  <MenuEngineeringMatrix results={results} />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                    {Object.keys(CLASS_LABELS).map((key) => (
                      <div key={key} className={`rounded-xl px-2 py-2 border ${CLASS_COLORS[key]} shadow-sm`}>
                        <div className="font-bold mb-1">{CLASS_LABELS[key]}</div>
                        <div>{CLASS_DESCRIPTIONS[key]}</div>
                        <div className="mt-1 text-[11px] font-semibold">
                          {matrixGroups[key].length} product{matrixGroups[key].length === 1 ? "" : "en"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Lijst per type */}
                <div className="w-full md:w-1/3">
                  <h3 className="text-lg font-bold mb-2">Overzicht per type</h3>
                  {Object.keys(CLASS_LABELS).map((key) => (
                    <div key={key} className={`mb-4 p-2 rounded border-l-4 ${CLASS_COLORS[key]}`}>
                      <div className="font-semibold">{CLASS_LABELS[key]}</div>
                      {matrixGroups[key].length ? (
                        <ul className="list-disc ml-5">
                          {matrixGroups[key].map((r) => (
                            <li key={r.product}>{r.product}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-500 text-xs">Geen producten</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Product detailtabel */}
              <div className="overflow-x-auto mt-8">
                <table className="min-w-full text-sm rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-left">Aantal verkocht</th>
                      <th className="p-2 text-left">Kostprijs</th>
                      <th className="p-2 text-left">Verkoopprijs</th>                     
                      <th className="p-2 text-left">Marge per stuk</th>
                      <th className="p-2 text-left">Foodcost %</th>
                      <th className="p-2 text-left">Totale marge</th>
                      <th className="p-2 text-left">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row) => (
                      <tr key={row.product} className="border-b last:border-b-0">
                        <td className="p-2">{row.product}</td>
                        <td className="p-2">{row.sold}</td>
                        <td className="p-2">€{row.kostprijs.toFixed(2)}</td>
                        <td className="p-2">
                          €{row.verkoopprijsExclBtw.toFixed(2)}
                        </td>                        
                        <td className="p-2">€{row.marge.toFixed(2)}</td>
                        <td className="p-2">{row.foodcostPct.toFixed(1)}%</td>
                        <td className="p-2">€{row.totalMargin.toFixed(2)}</td>
                        <td className="p-2 capitalize">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${CLASS_COLORS[row.classification]}`}>
                            {CLASS_LABELS[row.classification]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-gray-500">
              Selecteer een datumbereik en klik op 'Analyseer Menu'.
            </p>
          )}
        </div>
      </PageContainer>
    </>
  );
}
