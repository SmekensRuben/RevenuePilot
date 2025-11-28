// src/features/stockcount/ActiveStockCount.jsx
import React, { useEffect, useState } from "react";
import { useHotelContext } from "contexts/HotelContext";
import { useNavigate } from "react-router-dom";
import LocationCard from "./LocationCard";
import ConfirmAllButton from "./ConfirmAllButton";
import StockCountResultDialog from "./StockCountResultDialog";
import { closeTelling, getTellingCategories } from "./stockCountService";
import { getArticles } from "services/firebaseArticles";
import { getRecipes } from "services/firebaseRecipes";
import { getLocations } from "services/firebaseSettings"; // <-- HIER!
import { db, doc, getDoc, collection, getDocs, updateDoc } from "../../firebaseConfig";
import { usePermission } from "../../hooks/usePermission";

export default function ActiveStockCount({ tellingId, onClosed, canManage: canManageProp }) {
  const { hotelUid } = useHotelContext();
  const navigate = useNavigate();
  const permissionCanManage =
    usePermission("stockcounts", "count") ||
    usePermission("stockcounts", "edit") ||
    usePermission("stockcounts", "create");
  const canManage = typeof canManageProp === "boolean" ? canManageProp : permissionCanManage;

  // State voor categorieën en labels
  const [categories, setCategories] = useState([]);
  const [categoryLabels, setCategoryLabels] = useState({});
  const [locationStatuses, setLocationStatuses] = useState({});
  const [resultOpen, setResultOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [locations, setLocations] = useState([]); // <-- DIT IS NIEUW

  // Haal locaties op uit settings
  useEffect(() => {
    async function fetchLocs() {
      if (!hotelUid) return;
      const locs = await getLocations(hotelUid);
      // Sorteer optioneel alfabetisch, of zoals jij wil
      setLocations(locs.map(l => l.name));
    }
    fetchLocs();
  }, [hotelUid]);

  // Haal categorieën en labels op
  useEffect(() => {
    async function fetchCatsAndLabels() {
      if (!hotelUid || !tellingId) return;
      const cats = await getTellingCategories(hotelUid, tellingId);
      setCategories(cats);

      // Categorie-labels ophalen vanuit Firestore
      const catLabelsDoc = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
      const catLabelsSnap = await getDoc(catLabelsDoc);
      if (catLabelsSnap.exists() && catLabelsSnap.data().categories) {
        const all = catLabelsSnap.data().categories;
        const out = {};
        Object.entries(all).forEach(([key, val]) => {
          out[key] = val.label || key;
        });
        setCategoryLabels(out);
      }
    }
    fetchCatsAndLabels();
  }, [hotelUid, tellingId]);

  // Haal locatie-statussen op
  useEffect(() => {
    async function fetchStatuses() {
      if (!hotelUid || !tellingId) return;
      const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
      const snap = await getDoc(stockCountDoc);
      let statuses = {};
      if (snap.exists()) {
        const data = snap.data();
        for (let loc of locations) {
          if (data.locations?.[loc]?.status === "Finished") {
            statuses[loc] = "Finished";
          } else if (data.locations?.[loc]?.status === "Started") {
            statuses[loc] = "Started";
          } else if (data.locations?.[loc] && Object.keys(data.locations[loc]).length > 0) {
            statuses[loc] = "Started";
          }
        }
      }
      setLocationStatuses(statuses);
    }
    if (locations.length > 0) fetchStatuses();
    // eslint-disable-next-line
  }, [hotelUid, tellingId, locations]);

  // Handler om een locatie te openen
  const handleOpenLocation = (loc) => {
    navigate(
      `/stockcount/location/${encodeURIComponent(loc)}?tellingId=${encodeURIComponent(tellingId)}`
    );
  };

  // Handler om een locatie te heropenen
  const handleReopenLocation = async (loc) => {
    if (!canManage) return;
    const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
    const snap = await getDoc(stockCountDoc);
    if (snap.exists()) {
      const data = snap.data();
      const update = {};
      update[loc] = { ...(data[loc] || {}), status: "Started" };
      await updateDoc(stockCountDoc, update);
      setLocationStatuses((prev) => ({
        ...prev,
        [loc]: "Started",
      }));
    }
  };

  // Handler voor afsluiten van telling (alles definitief bevestigen)
  const handleConfirmAll = async () => {
    if (!canManage) return;
    setIsFinishing(true);
    // 1. Oude inventory ophalen
    const invCol = collection(db, `hotels/${hotelUid}/inventory`);
    const invSnap = await getDocs(invCol);
    const oldInventory = {};
    invSnap.forEach(docSnap => {
      oldInventory[docSnap.id] = docSnap.data();
    });

    // 2. Categorieën ophalen
    const selectedCategories = categories;

    // 3. Alle artikels en recepten ophalen
    const [articlesArr, recipesArr] = await Promise.all([
      getArticles(hotelUid),
      getRecipes(hotelUid),
    ]);
    const articlesData = {};
    for (const art of articlesArr) {
      articlesData[art.id] = art;
    }
    for (const rec of recipesArr) {
      articlesData[rec.id] = {
        ...rec,
        stockUnit: rec.contentUnit || "",
      };
    }

    // 4. StockCount-gegevens ophalen
    const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
    const snap = await getDoc(stockCountDoc);
    let newInventory = { ...oldInventory };
    if (snap.exists()) {
      const data = snap.data();
      // 5. Verwijder oude producten in de gekozen categorieën
      for (const prodId in oldInventory) {
        const art = articlesData[prodId];
        if (art && selectedCategories.includes(art.category)) {
          delete newInventory[prodId];
        }
      }

      // 6. Voeg tellingen toe aan inventory
const stockLocations = data.locations || {};
const totalCounts = {};
for (const loc of locations) {
  const locData = stockLocations[loc] || {};
  for (const [prodId, prodInfo] of Object.entries(locData)) {
    if (prodId === "status") continue;
    totalCounts[prodId] = (totalCounts[prodId] || 0) + (Number(prodInfo.amount) || 0);
  }
}
for (const [prodId, quantity] of Object.entries(totalCounts)) {
  newInventory[prodId] = {
    articleId: prodId,
    quantity,
    lastCountDate: Date.now(),
  };
}


    }
    // 7. Telling afsluiten via service
    await closeTelling(hotelUid, tellingId, newInventory, oldInventory);
    setIsFinishing(false);
    setResultOpen(true);
    if (onClosed) onClosed();
  };

  // Alle locaties finished?
  const allFinished = locations.length > 0 && locations.every(
    (loc) => locationStatuses[loc] === "Finished"
  );

  return (
    <div className="bg-white rounded-xl p-6 shadow mb-6">
      {/* Header met datum & categorieën */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div className="font-semibold text-marriott text-lg">
          {new Date().toLocaleDateString("nl-BE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
          })}
        </div>
        {categories.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li
                key={c}
                className="px-3 py-1 rounded-full bg-marriott/10 text-marriott font-semibold text-sm"
              >
                {categoryLabels[c] || c}
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="text-xl font-bold mb-3">Actieve telling</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map((loc) => (
          <LocationCard
            key={loc}
            location={loc}
            status={locationStatuses[loc] || "Not Started"}
            onOpen={() => handleOpenLocation(loc)}
            onReopen={() => handleReopenLocation(loc)}
            canManage={canManage}
          />
        ))}
      </div>
      {allFinished && (
        <ConfirmAllButton
          ready={allFinished}
          onConfirm={handleConfirmAll}
          disabled={isFinishing || !canManage}
        />
      )}
      <StockCountResultDialog
        open={resultOpen}
        onClose={() => setResultOpen(false)}
      />
    </div>
  );
}
