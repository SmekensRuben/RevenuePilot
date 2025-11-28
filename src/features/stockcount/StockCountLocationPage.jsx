import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { serverTimestamp, onSnapshot, doc, getDoc, deleteField } from "firebase/firestore";
import { getArticles } from "services/firebaseArticles";
import { getRecipes } from "services/firebaseRecipes";
import { getIngredients } from "services/firebaseIngredients";
import { calculateRecipeCost } from "../recipes/recipeHelpers";
import { useHotelContext } from "contexts/HotelContext";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { auth, signOut, db, updateDoc } from "../../firebaseConfig";
import {
  getTellingCategories,
  addProductToLocation,
  finishLocation
} from "./stockCountService";
import StockCountAddForm from "./StockCountAddForm";
import StockCountTable from "./StockCountTable";
import StockCountCategoryChips from "./StockCountCategoryChips";
import { usePermission } from "../../hooks/usePermission";

function Toast({ message, onHide }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onHide, 1700);
      return () => clearTimeout(timer);
    }
  }, [message, onHide]);
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded shadow text-center">
      {message}
    </div>
  );
}

export default function StockCountLocationPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { locationId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tellingId = searchParams.get("tellingId");
  const navigate = useNavigate();
  const canManageStockCount =
    usePermission("stockcounts", "count") ||
    usePermission("stockcounts", "edit") ||
    usePermission("stockcounts", "create");

  const [articles, setArticles] = useState([]);
  const [articlesLoaded, setArticlesLoaded] = useState(false);
  const [lines, setLines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryLabels, setCategoryLabels] = useState({});
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // AddForm state
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [toast, setToast] = useState("");

  // HeaderBar support
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
  });
  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  // Artikels en recepten ophalen (met loaded-flag)
  useEffect(() => {
    async function fetchProducts() {
      const [artArr, recArr, ingArr] = await Promise.all([
        getArticles(hotelUid),
        getRecipes(hotelUid),
        getIngredients(hotelUid),
      ]);
      const activeArticles = artArr.filter(art => art.active !== false);

      // Remove duplicates by EAN, keeping the cheapest pricePerStockUnit
      const eanMap = {};
      const noEan = [];
      activeArticles.forEach(art => {
        if (art.ean) {
          const current = eanMap[art.ean];
          const price = Number(art.pricePerStockUnit) || Infinity;
          if (!current || price < (Number(current.pricePerStockUnit) || Infinity)) {
            eanMap[art.ean] = art;
          }
        } else {
          noEan.push(art);
        }
      });
      const dedupedArticles = [...noEan, ...Object.values(eanMap)];

      const recipeItems = recArr
        .filter(rec => rec.active !== false)
        .map(rec => {
          const cost = calculateRecipeCost(rec, ingArr, artArr);
          const pricePerStockUnit = cost / Number(rec.content || 1);
          return {
            ...rec,
            stockUnit: rec.contentUnit || "",
            pricePerStockUnit,
            price: pricePerStockUnit,
          };
        });
      setArticles([...dedupedArticles, ...recipeItems]);
      setArticlesLoaded(true);
    }
    fetchProducts();
  }, [hotelUid]);

  // Laad gekozen categorieën en labels
  useEffect(() => {
    async function fetchCatsAndLabels() {
      if (!hotelUid || !tellingId) return;
      const cats = await getTellingCategories(hotelUid, tellingId);
      setCategories(cats);
      setCategoryLabels(await fetchCategoryLabels(hotelUid));
    }
    fetchCatsAndLabels();
  }, [hotelUid, tellingId]);

  // lines real-time synchroniseren via onSnapshot
  useEffect(() => {
    if (!hotelUid || !locationId || !tellingId) return;

    const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);

    const unsubscribe = onSnapshot(stockCountDoc, (snap) => {
      if (!snap.exists()) {
        setLines([]);
        return;
      }
      const data = snap.data();
      const locData = data.locations?.[locationId] || {};
      const linesArr = Object.entries(locData)
        .filter(([id, d]) => id !== "status" && d && typeof d === "object")
        .map(([id, d]) => {
          const foundArt = articles.find(i => i.id === id);
          return {
            articleId: id,
            name: foundArt ? foundArt.name : id,
            brand: foundArt ? foundArt.brand : "",
            stockUnit: d.unit || (foundArt ? foundArt.stockUnit : "") || "",
            quantity: d.amount,
            timestamp: d.timestamp || null
          };
        });

      setLines(linesArr);
    });

    return () => unsubscribe();
  }, [hotelUid, tellingId, locationId, articles]);


  // Helper: haalt settings-categorieën op als {key, label}
  async function fetchCategoryLabels(hotelUid) {
    const settingsDoc = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
    const snap = await getDoc(settingsDoc);
    if (!snap.exists() || !snap.data().categories) return {};
    const all = snap.data().categories;
    const out = {};
    Object.entries(all).forEach(([key, val]) => {
      out[key] = val.label || key;
    });
    return out;
  }

  // Product toevoegen
  const handleAdd = useCallback(async (selected, quantity) => {
    if (!canManageStockCount) return;
    if (!selected || !quantity) return;

    let oldAmount = 0;
    const existing = lines.find(l => l.articleId === selected.id);
    if (existing) {
      oldAmount = existing.quantity || 0;
    }
    const newAmount = Number(oldAmount) + Number(quantity);

    // Zoek de actuele prijs en naam van het artikel
    // (deze heb je al in selected)
    const pricePerStockUnitAtCount = selected.pricePerStockUnit ?? 0;
    const nameAtCount = selected.name;

    await addProductToLocation(
      hotelUid,
      tellingId,
      locationId,
      selected.id,
      {
        amount: newAmount,
        unit: selected.stockUnit || "",
        enteredBy: "User",
        timestamp: serverTimestamp(),
        pricePerStockUnitAtCount, // <<<< NIEUW!
        nameAtCount,              // <<<< NIEUW!
      }
    );
    setToast(`${selected.name} toegevoegd!`);
    // Form wordt gereset in AddForm via props
  }, [hotelUid, tellingId, locationId, lines, canManageStockCount]);


  // Toast mag na toevoegen weer weg
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 1700);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Locatie afsluiten
  const handleFinishLocation = async () => {
    if (!canManageStockCount) return;
    if (!hotelUid || !tellingId || !locationId) return;
    await finishLocation(hotelUid, tellingId, locationId);
    navigate("/stockcount");
  };

  // Verwijderen uit DB
  const handleRemove = async id => {
    if (!canManageStockCount) return;
    try {
      const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
      await updateDoc(stockCountDoc, {
        [`locations.${locationId}.${id}`]: deleteField(),
      });
    } catch (e) {
      alert("Fout bij verwijderen: " + (e.message || e));
    }
  };


  // Sorting
  const handleSort = useCallback(
    key => {
      if (sortKey === key) {
        setSortDir(dir => (dir === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  if (!articlesLoaded) {
    return <div className="p-8 text-center text-gray-400">Loading articles...</div>;
  }

  // Filter alleen producten uit de gekozen categorieën
  const filteredArticles = articles.filter(
    ing => categories.includes(ing.category)
  );

  const filtered = search
    ? filteredArticles.filter(
        ing =>
          ing.name.toLowerCase().includes(search.toLowerCase()) ||
          (ing.brand && ing.brand.toLowerCase().includes(search.toLowerCase()))
      )
    : filteredArticles;

  // Toon de unit als een artikel is geselecteerd
  const selectedUnit = selected
    ? selected.stockUnit || ""
    : "";

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <Toast message={toast} onHide={() => setToast("")} />
      <PageContainer className="max-w-2xl px-2 py-8">
        <h2 className="text-xl font-bold mb-4">
          Stocktake: {locationId}
          <StockCountCategoryChips categories={categories} categoryLabels={categoryLabels} />
        </h2>
        {!canManageStockCount && (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            Je hebt alleen-lezen-toegang. Wijzigingen opslaan of toevoegen is uitgeschakeld.
          </div>
        )}
        <form className="mb-6">
          <StockCountAddForm
            search={search}
            setSearch={setSearch}
            selected={selected}
            setSelected={setSelected}
            quantity={quantity}
            setQuantity={setQuantity}
            filteredArticles={filtered}
            onAdd={handleAdd}
            selectedUnit={selectedUnit}
            setToast={setToast}
            disabled={!canManageStockCount}
          />
          <StockCountTable
            lines={lines}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onRemove={handleRemove}
            canManage={canManageStockCount}
          />
          <button
            type="button"
            className="bg-green-600 text-white px-8 py-2 rounded-xl font-semibold mt-5"
            onClick={handleFinishLocation}
            disabled={!canManageStockCount}
            title={!canManageStockCount ? "Je hebt geen rechten om deze telling af te ronden." : undefined}
          >
            Finished Location
          </button>
          <button
            type="button"
            className="ml-3 text-marriott border border-marriott px-4 py-2 rounded-xl font-semibold"
            onClick={() => navigate("/stockcount")}
          >
            Cancel
          </button>
        </form>
      </PageContainer>
    </>
  );
}
