// src/features/micros/MicrosSyncPage.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import Papa from "papaparse";
import { useHotelContext } from "contexts/HotelContext";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import {
  UploadCloud,
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Circle,
  FileSpreadsheet,
  ListOrdered,
  ArrowLeft,
  ArrowRight,
  ArrowDownToLine
} from "lucide-react";
import { signOut, db, doc, setDoc, getDoc } from "../../firebaseConfig";
import {
  getReceiptIndexes,
  addReceipts
} from "../lightspeed/lightspeedService";
import { updateDailyProductSales } from "../../services/firebaseSalesSnapshot";
import { updateReceiptItemSummary } from "../../services/firebaseReceiptItemSummary";
import { getProductsIndexed } from "../../services/firebaseProducts";
import ProgressModal from "../lightspeed/ProgressModal";

import {
  sanitizeKey,
  dateRange,
  formatDateNL,
  resolveLightspeedShiftDay
} from "../lightspeed/lightspeedHelpers";
import { getReceiptItemSummaries } from "../../services/firebaseReceiptItemSummary";

const STRINGS = {
  title: "Micros Symphony Sync & Import",
  subtitle:
    "Importeer Micros Symphony data en beheer de maandelijkse synchronisatie.",
  productLinkLabel: "Koppeling Micros Symphony producten:",
};
const STORAGE_KEY = "microsExcludedProducts";

export default function MicrosSyncPage() {
  const { title, subtitle, productLinkLabel } = STRINGS;

  const normalizeHeaderKey = (name) =>
    String(name || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

  const receiptKeyMap = useMemo(
    () => ({
      receiptid: "Check Number",
      createdby: "Employee",
      creationdate: "Open Date/Time",
      finalizeddate: "Close Date/Time",
      floorname: "Revenue Center",
      outletname: "Revenue Center",
      username: "Employee",
      liteserverid: "Liteserver ID",
    }),
    []
  );

  const getReceiptHeader = (name) =>
    receiptKeyMap[normalizeHeaderKey(name)] || name;
  const { hotelName, hotelUid, lightspeedShiftRolloverHour } = useHotelContext();
  const [receiptDays, setReceiptDays] = useState([]); // lijst van { day, receiptCount }
  const [sortBy, setSortBy] = useState("day");
  const [sortDir, setSortDir] = useState("desc");
  const [error, setError] = useState("");
  const [duplicateProducts, setDuplicateProducts] = useState([]);
  const [foundProducts, setFoundProducts] = useState([]);
  const [notFoundProducts, setNotFoundProducts] = useState([]);
  const [showNotFound, setShowNotFound] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [progressDoneText, setProgressDoneText] = useState("");
  const [minAvailableDay, setMinAvailableDay] = useState(null);
  const [excludedNames, setExcludedNames] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.warn("Kon excluded producten niet laden", err);
      return [];
    }
  });
  const [excludeInput, setExcludeInput] = useState("");

  const getLocalMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const [currentMonthStart, setCurrentMonthStart] = useState(() => getLocalMonthStart());

  const receiptsInputRef = useRef(null);
  const receiptItemsInputRef = useRef(null);
  const discountItemsInputRef = useRef(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(excludedNames));
    } catch (err) {
      console.warn("Kon excluded producten niet opslaan", err);
    }
  }, [excludedNames]);

  const handleLogout = async () => {
    await signOut();
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const handleImportReceipts = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setError("");
    setProgress(0);
    setProgressText("Importeren van receipts...");
    setProgressDoneText("Import van receipts afgerond.");
    setShowProgressModal(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvText = e.target.result;
        const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        const key = (name) => getReceiptHeader(name);

        const groupedReceipts = {};
        const receiptDayMap = new Map();
        for (const row of data) {
          const creationRaw = row[key("CreationDate")];
          const finalizedRaw = row[key("FinalizedDate")];
          const day = resolveLightspeedShiftDay(
            creationRaw,
            finalizedRaw,
            lightspeedShiftRolloverHour
          );
          if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
            console.warn("Skipped row, geen geldige dag:", {
              row,
              creationRaw,
              finalizedRaw,
              day,
            });
            continue;
          }
          const receiptIdRaw = row[key("ReceiptId")];
          const receiptId = sanitizeKey(receiptIdRaw);
          if (!receiptId) {
          console.warn("Skipped row, geen geldige receiptId:", row);
          continue;
        }
        const existingDay = receiptDayMap.get(receiptId);
        let finalDay = day;

        if (existingDay && existingDay !== day) {
          finalDay = day < existingDay ? day : existingDay;
          if (finalDay !== existingDay) {
            const prevGroup = groupedReceipts[existingDay];
            if (prevGroup && prevGroup[receiptId]) {
              delete prevGroup[receiptId];
              if (Object.keys(prevGroup).length === 0) {
                delete groupedReceipts[existingDay];
              }
            }
          } else {
            console.info(
              "Ontdubbelen receipts: bestaande dag behouden",
              receiptId,
              existingDay,
              day
            );
            continue;
          }
        }

        receiptDayMap.set(receiptId, finalDay);
        if (!groupedReceipts[finalDay]) groupedReceipts[finalDay] = {};
        groupedReceipts[finalDay][receiptId] = {
          receiptId: receiptIdRaw,
          liteserverId: row[key("LiteserverId")] || "",
          createdBy: row[key("CreatedBy")] || "",
          creationDate: row[key("CreationDate")] || "",
          finalizedDate: row[key("FinalizedDate")] || "",
          importBatchId: "import_" + Date.now(),
          importedAt: new Date().toISOString(),
          originalFilename: file.name,
          outletName: row[key("OutletName")] || row[key("FloorName")] || "",
          floorName: row[key("FloorName")] || "",
          username: row[key("Username")] || "",
          // geen products
        };
      }

      // 1. Receipts importeren
      await addReceipts(hotelUid, groupedReceipts, (pct) => {
        setProgress(pct);
      });

      // 2. Receipt-index bijwerken per dag
      for (const [day, receiptsOfDay] of Object.entries(groupedReceipts)) {
        const receiptMap = {};
        for (const receiptId of Object.keys(receiptsOfDay)) {
          const mappedDay = receiptDayMap.get(receiptId);
          if (mappedDay && mappedDay !== day) {
            console.warn(
              "Ontdubbelen receiptMap: dag mismatch, overslaan",
              receiptId,
              mappedDay,
              day
            );
            continue;
          }
          receiptMap[receiptId] = `receipts/${day}/receiptList/${receiptId}`;
        }
        // Sla de index op: 1 document per dag. De index bevat nu ook de volledige receipts.
        await setDoc(
          doc(db, `hotels/${hotelUid}/indexes/receiptMasterIndex/receiptsForLightspeedSync/${day}`),
          { receiptMap, day},
          { merge: true }
        );
      }

      setProgress(100);
      fetchReceiptDaysAndProducts();
    } catch (err) {
      setError("Fout bij importeren van receipts-CSV.");
    }
  };
  reader.readAsText(file);
};

// -------------------
// IMPORT RECEIPT ITEMS (producten per bon)
const importReceiptItems = (event, options = {}) => {
  const {
    progressText = "Importeren van receipt items...",
    doneText = "Import van receipt items afgerond.",
    shouldIncludeRow,
    markProductsAsDiscount = false,
  } = options;

  const file = event.target.files[0];
  if (!file) return;
  setError("");
  setProgress(0);
  setProgressText(progressText);
  setProgressDoneText(doneText);
  setShowProgressModal(true);

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const csvText = e.target.result;
      const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const normalizeItemKey = (name) =>
        String(name || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const key = (name) => {
        const map = {
          receiptid: "Receipt ID",
          checknumber: "Check Number",
          productid: "Product ID",
          name: "Name",
          quantity: "Quantity",
          taxinclusiveprice: "Tax Inclusive Price",
          totaltaxinclusiveprice: "Total Tax Inclusive Price",
          taxpercentage: "Tax Percentage",
          itemname: "Item Name",
          itemnumber: "Item Number",
          linenumber: "Line Number",
          linecount: "Line Count",
          linetotal: "Line Total",
          transactiondate: "Transaction Date/Time",
          transactiondatetime: "Transaction Date/Time",
        };
        return map[normalizeItemKey(name)] || name;
      };

      const getValue = (row, columns, fallback = "") => {
        for (const column of columns) {
          const mapped = key(column);
          const value = row[mapped];
          if (value !== undefined && value !== null && value !== "") {
            return value;
          }
        }
        return fallback;
      };

      const rowPassesFilter = (row) => {
        if (typeof shouldIncludeRow !== "function") return true;
        try {
          return Boolean(shouldIncludeRow(row, getValue));
        } catch (err) {
          console.warn("Kon filter op receipt item niet toepassen", err, row);
          return false;
        }
      };

      // 1. Verzamel unieke receiptIds uit CSV
      const allReceiptIds = new Set();
      for (const row of data) {
        if (!rowPassesFilter(row)) continue;
        const receiptIdRaw = getValue(row, ["Check Number", "ReceiptId", "Receipt ID"]);
        const receiptId = sanitizeKey(receiptIdRaw);
        if (receiptId) allReceiptIds.add(receiptId);
      }

      // 2. Bepaal de relevante dagen op basis van Transaction Date/Time
      let minDate = null;
      for (const row of data) {
        if (!rowPassesFilter(row)) continue;
        const transactionRaw = getValue(
          row,
          [
            "Transaction Date/Time",
            "TransactionDateTime",
            "Transaction Date",
            "TransactionDate",
            "Open Date/Time",
          ]
        );
        const day = resolveLightspeedShiftDay(
          transactionRaw,
          transactionRaw,
          lightspeedShiftRolloverHour
        );
        if (!day) continue;
        if (!minDate || day < minDate) minDate = day;
      }
      // Bouw lijst van 20 dagen vanaf minDate
      const dayList = [];
      if (minDate) {
        let d = new Date(minDate);
        for (let i = 0; i < 20; i++) { // <= 20 dagen
          dayList.push(d.toISOString().slice(0, 10));
          d.setDate(d.getDate() + 1);
        }
      }

      // 3. Receipt-indexen ophalen voor relevante dagen
      let receiptsIndexMap = {};
      const dayIndexes = {};
      for (const day of dayList) {
        const ref = doc(db, `hotels/${hotelUid}/indexes/receiptMasterIndex/receiptsForLightspeedSync/${day}`);
        const indexDoc = await getDoc(ref);
        if (indexDoc.exists()) {
          const data = indexDoc.data();
          const map = data.receiptMap || {};
          for (const [receiptId, path] of Object.entries(map)) {
            if (receiptsIndexMap[receiptId] && receiptsIndexMap[receiptId] !== path) {
              console.warn(
                "Conflict in receiptsIndexMap: behoud bestaande mapping",
                receiptId,
                receiptsIndexMap[receiptId],
                path
              );
              continue;
            }
            if (!receiptsIndexMap[receiptId]) {
              receiptsIndexMap[receiptId] = path;
            }
          }
          dayIndexes[day] = { ref, data };
        } else {
          dayIndexes[day] = { ref, data: { receiptMap: {}, productIndex: {} } };
        }
      }

      // 4. Groepeer producten per receiptId + (productId, naam)
      const productsPerReceipt = {};
      const pendingVoidsPerReceipt = {};

      const roundNumber = (value) => {
        if (!Number.isFinite(value)) return 0;
        return Math.round(value * 1e6) / 1e6;
      };

      const applyVoidsForProduct = (receiptId, prodKey) => {
        const receiptProducts = productsPerReceipt[receiptId];
        if (!receiptProducts) return;
        const productEntry = receiptProducts[prodKey];
        if (!productEntry) return;
        const pendingVoids = pendingVoidsPerReceipt[receiptId]?.[prodKey];
        if (!pendingVoids || pendingVoids.length === 0) return;

        const remainingVoids = [];
        for (const voidData of pendingVoids) {
          let remainingQty = Number(voidData.quantity) || 0;
          if (remainingQty <= 0) continue;

          while (remainingQty > 0 && productEntry.quantity > 0) {
            const qtyToSubtract = Math.min(remainingQty, productEntry.quantity);
            const pricePerUnitRaw = Number.isFinite(voidData.unitPrice) && voidData.unitPrice !== 0
              ? voidData.unitPrice
              : productEntry.taxInclusivePrice || 0;
            const pricePerUnit = Math.abs(pricePerUnitRaw);

            productEntry.quantity = roundNumber(productEntry.quantity - qtyToSubtract);
            productEntry.netQuantity = roundNumber(productEntry.netQuantity - qtyToSubtract);
            productEntry.totalTaxInclusivePrice = roundNumber(
              productEntry.totalTaxInclusivePrice - pricePerUnit * qtyToSubtract
            );

            if (productEntry.totalTaxInclusivePrice < 0) {
              productEntry.totalTaxInclusivePrice = 0;
            }

            remainingQty = roundNumber(remainingQty - qtyToSubtract);
          }

          if (remainingQty > 0) {
            remainingVoids.push({ ...voidData, quantity: remainingQty });
          }
        }

        if (productEntry.quantity <= 0 || productEntry.netQuantity <= 0) {
          delete receiptProducts[prodKey];
        }

        if (remainingVoids.length > 0) {
          pendingVoidsPerReceipt[receiptId][prodKey] = remainingVoids;
        } else {
          delete pendingVoidsPerReceipt[receiptId][prodKey];
          if (Object.keys(pendingVoidsPerReceipt[receiptId]).length === 0) {
            delete pendingVoidsPerReceipt[receiptId];
          }
        }
      };

      const queueVoidForProduct = (receiptId, prodKey, voidData) => {
        if (!pendingVoidsPerReceipt[receiptId]) pendingVoidsPerReceipt[receiptId] = {};
        if (!pendingVoidsPerReceipt[receiptId][prodKey]) {
          pendingVoidsPerReceipt[receiptId][prodKey] = [];
        }
        pendingVoidsPerReceipt[receiptId][prodKey].push(voidData);
        applyVoidsForProduct(receiptId, prodKey);
      };

      for (const row of data) {
        const receiptIdRaw = getValue(row, ["Check Number", "ReceiptId", "Receipt ID"]);
        const receiptId = sanitizeKey(receiptIdRaw);
        if (!receiptId) continue;

        if (!productsPerReceipt[receiptId]) productsPerReceipt[receiptId] = {};
        const pid = getValue(row, ["Item Number", "ProductId", "Product ID"]);
        const pname = getValue(row, ["Item Name", "Name"]);
        if (!pid || !pname) continue;

        const quantityRaw = getValue(row, ["Line Count", "Quantity", "Line Number"], 0);
        let quantityNum = Number(quantityRaw) || 0;

        const totalTaxInclRaw = getValue(
          row,
          ["Line Total", "TotalTaxInclusivePrice", "Total Tax Inclusive Price"],
          0
        );
        let totalTaxInclNum = Number(totalTaxInclRaw);
        if (!Number.isFinite(totalTaxInclNum)) totalTaxInclNum = 0;

        const taxInclPriceRaw = getValue(row, ["Tax Inclusive Price", "TaxInclusivePrice"], "");
        let baseTaxInclusivePrice = Number(taxInclPriceRaw);
        if (!Number.isFinite(baseTaxInclusivePrice)) baseTaxInclusivePrice = 0;

        const voidFlagRaw = getValue(row, ["Voids"], "");
        const isVoid =
          typeof voidFlagRaw === "string" && voidFlagRaw.trim().toUpperCase() === "VOID";

        const baseProdKey = `${pid}___${pname}`;

        if (isVoid) {
          const voidQuantity = Math.abs(quantityNum);
          if (voidQuantity > 0) {
            let voidUnitPrice = 0;
            if (voidQuantity !== 0 && totalTaxInclNum !== 0) {
              voidUnitPrice = totalTaxInclNum / voidQuantity;
            }
            if (!Number.isFinite(voidUnitPrice) || voidUnitPrice === 0) {
              voidUnitPrice = baseTaxInclusivePrice || 0;
            }
            if (Number.isFinite(voidUnitPrice)) {
              voidUnitPrice = Math.abs(voidUnitPrice);
            }
            queueVoidForProduct(receiptId, baseProdKey, {
              quantity: voidQuantity,
              unitPrice: Number.isFinite(voidUnitPrice) ? voidUnitPrice : 0,
            });
          }
          continue;
        }

        if (!rowPassesFilter(row)) {
          continue;
        }

        const isNegativeQuantity = quantityNum < 0;
        const normalizedQuantity = isNegativeQuantity ? Math.abs(quantityNum) : quantityNum;

        let taxInclusivePrice = baseTaxInclusivePrice;
        if (!Number.isFinite(taxInclusivePrice) || taxInclusivePrice === 0) {
          if (quantityNum !== 0) {
            taxInclusivePrice = totalTaxInclNum / quantityNum;
          } else if (normalizedQuantity !== 0) {
            taxInclusivePrice = totalTaxInclNum / normalizedQuantity;
          } else {
            taxInclusivePrice = totalTaxInclNum;
          }
        }
        if (!Number.isFinite(taxInclusivePrice)) taxInclusivePrice = 0;
        if (isNegativeQuantity) {
          taxInclusivePrice = -Math.abs(taxInclusivePrice);
        }

        let totalToAdd = totalTaxInclNum;
        if (!Number.isFinite(totalToAdd) || totalToAdd === 0) {
          totalToAdd = taxInclusivePrice * quantityNum;
        }
        if (!Number.isFinite(totalToAdd)) totalToAdd = 0;
        if (isNegativeQuantity && totalToAdd > 0) {
          totalToAdd = -Math.abs(totalToAdd);
        }

        // Gebruik een samengestelde key van productId + naam + refund flag
        const prodKey = isNegativeQuantity
          ? `${pid}___${pname}___refund`
          : `${pid}___${pname}`;
        if (!productsPerReceipt[receiptId][prodKey]) {
          const taxPercentage = Number(
            getValue(row, ["Tax Percentage", "TaxPercentage"], 0)
          ) || 0;
          productsPerReceipt[receiptId][prodKey] = {
            productId: pid,
            name: isNegativeQuantity ? `${pname} (refund)` : pname,
            quantity: 0,
            netQuantity: 0,
            taxInclusivePrice,
            totalTaxInclusivePrice: 0,
            taxPercentage,
            isRefund: isNegativeQuantity,
            ...(markProductsAsDiscount ? { isDiscount: true } : {}),
          };
          if (isNegativeQuantity) {
            productsPerReceipt[receiptId][prodKey].originalProductId = pid;
          }
        }

        const productEntry = productsPerReceipt[receiptId][prodKey];
        if (productEntry.taxInclusivePrice === 0 && taxInclusivePrice !== 0) {
          productEntry.taxInclusivePrice = taxInclusivePrice;
        }

        productEntry.quantity += normalizedQuantity;
        productEntry.netQuantity += quantityNum;
        productEntry.totalTaxInclusivePrice += totalToAdd;
        productEntry.quantity = roundNumber(productEntry.quantity);
        productEntry.netQuantity = roundNumber(productEntry.netQuantity);
        productEntry.totalTaxInclusivePrice = roundNumber(productEntry.totalTaxInclusivePrice);

        if (!isNegativeQuantity) {
          applyVoidsForProduct(receiptId, prodKey);
        }
      }

      // Zet elk receipt om naar een array
      Object.keys(productsPerReceipt).forEach(receiptId => {
        const products = Object.values(productsPerReceipt[receiptId]).filter(prod => {
          if (prod.isRefund) return true;
          return prod.quantity > 0 && prod.netQuantity > 0;
        });
        productsPerReceipt[receiptId] = products;
      });

      // 5. Update de Firestore receipts via index + PROGRESS BAR!
      const receiptIds = Object.keys(productsPerReceipt);
      let processed = 0;
      let notFound = [];
      const dayCount = Object.keys(dayIndexes).length;
      const totalSteps = receiptIds.length + dayCount * 3;
      let done = 0;
      const updateProg = () => {
        const pct = Math.round((done / totalSteps) * 100);
        setProgress(pct);
      };
      // Bouw een mapping per dag voor productIndex
      const productIndexPerDay = {}; // { day: { [productId]: { name, taxInclusivePrice } } }

      // Producten aan receipts koppelen én per dag productIndex bouwen
      for (const [receiptId, rawProductsArr] of Object.entries(productsPerReceipt)) {
        let productsArr = rawProductsArr;
        if (markProductsAsDiscount) {
          productsArr = rawProductsArr.map(prod => ({ ...prod, isDiscount: true }));
        }
        const relPath = receiptsIndexMap[receiptId];
        if (!relPath) {
          notFound.push(receiptId);
          continue;
        }
        const receiptDocRef = doc(db, `hotels/${hotelUid}/${relPath}`);
        if (markProductsAsDiscount) {
          const existingReceipt = await getDoc(receiptDocRef);
          if (existingReceipt.exists()) {
            const existingProducts = existingReceipt.data()?.products;
            if (Array.isArray(existingProducts)) {
              const nonDiscountProducts = existingProducts.filter(
                prod => !prod || !prod.isDiscount
              );
              productsArr = [...nonDiscountProducts, ...productsArr];
            }
          }
        }
        await setDoc(receiptDocRef, { products: productsArr }, { merge: true });

        // Haal dag uit het Firestore pad
        const dayMatch = relPath.match(/receipts\/(\d{4}-\d{2}-\d{2})\//);
        const day = dayMatch ? dayMatch[1] : null;
        if (day) {
          if (!productIndexPerDay[day]) productIndexPerDay[day] = {};
          for (const prod of productsArr) {
            if (prod.isRefund) continue;
            // Voeg product toe aan productIndex als nog niet aanwezig, neem prijs van eerste occurrence
            if (!productIndexPerDay[day][prod.productId]) {
              productIndexPerDay[day][prod.productId] = {
                name: prod.name,
                taxInclusivePrice: prod.taxInclusivePrice
              };
            }
          }
        }

        processed++;
        done++;
        updateProg();
      }

      // Update de dag-indexen met het productIndex
      for (const [day, { ref, data }] of Object.entries(dayIndexes)) {
        // Voeg bestaande samen met nieuwe producten (indien gewenst)
        const newProductIndex = { ...(data.productIndex || {}), ...(productIndexPerDay[day] || {}) };
        await setDoc(ref, { productIndex: newProductIndex }, { merge: true });
        done++;
        updateProg();
      }

      // -- En nu de sales snapshots en samenvattingen bouwen --
      for (const day of Object.keys(dayIndexes)) {
        await updateDailyProductSales(hotelUid, day);
        done++;
        updateProg();
        await updateReceiptItemSummary(hotelUid, day);
        done++;
        updateProg();
      }

      done = totalSteps;
      updateProg();

      let msg = doneText;
      if (notFound.length > 0) {
        msg += `\nNiet gevonden receiptIds: ${notFound.join(", ")}.`;
        console.warn("Deze receipts werden niet gevonden in indexen:", notFound);
      }
      setProgressDoneText(msg);
      fetchReceiptDaysAndProducts();

    } catch (err) {
      setError("Fout bij importeren van receipt-items-CSV.");
      console.error("Fout bij importeren van receipt-items-CSV:", err);
      setProgress(0);
      setShowProgressModal(false);
    }
  };
  reader.readAsText(file);
  if (event.target) {
    event.target.value = "";
  }
};

const handleImportReceiptItems = (event) => {
  importReceiptItems(event);
};

const handleImportDiscountItems = (event) => {
  importReceiptItems(event, {
    progressText: "Importeren van discount items...",
    doneText: "Import van discount items afgerond.",
    shouldIncludeRow: (row, getValue) => {
      const reportCountRaw = getValue(row, ["Report Line Count"], 0);
      const reportCount = Number(reportCountRaw);
      return Number.isFinite(reportCount) && reportCount > 0;
    },
    markProductsAsDiscount: true,
  });
};



  const fetchReceiptDaysAndProducts = async () => {
    const [indexData, products, summaries] = await Promise.all([
      getReceiptIndexes(hotelUid),
      getProductsIndexed(hotelUid),
      getReceiptItemSummaries(hotelUid)
    ]);

    const productMap = new Map();
    const dupCheck = {};
    products.forEach(p => {
      if (!p.lightspeedId) return;
      const key = String(p.lightspeedId).trim();
      productMap.set(key, p);
      if (!dupCheck[key]) dupCheck[key] = [];
      dupCheck[key].push(p);
    });

    const nameLookup = {};
    Object.values(indexData).forEach(indexObj => {
      const prodIdx = indexObj.productIndex || {};
      Object.entries(prodIdx).forEach(([pid, info]) => {
        if (!nameLookup[pid]) nameLookup[pid] = info.name || "";
      });
    });

    const usedIds = new Set();
    summaries.forEach(summary => {
      Object.keys(summary.items || {}).forEach(pid => usedIds.add(pid));
    });

    const days = Object.entries(indexData)
      .filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day))
      .map(([day, indexObj]) => ({
        day,
        receiptCount: Object.keys(indexObj.receiptMap || {}).length
      }));

    days.sort((a, b) => a.day.localeCompare(b.day));
    setReceiptDays(days);

    const foundList = [];
    const notFoundList = [];
    usedIds.forEach(pid => {
      const name = nameLookup[pid] || "";
      if (productMap.has(pid)) {
        const prod = productMap.get(pid);
        foundList.push({ productId: pid, name: prod.name || name });
      } else {
        notFoundList.push({ productId: pid, name });
      }
    });

    foundList.sort((a, b) => (a.name || a.productId).localeCompare(b.name || b.productId));
    notFoundList.sort((a, b) => a.productId.localeCompare(b.productId));
    setFoundProducts(foundList);
    setNotFoundProducts(notFoundList);

    const dupList = [];
    usedIds.forEach(id => {
      if (dupCheck[id] && dupCheck[id].length > 1) {
        dupList.push({ productId: id, products: dupCheck[id] });
      }
    });
    dupList.sort((a, b) => a.productId.localeCompare(b.productId));
    setDuplicateProducts(dupList);

    setMinAvailableDay(days.length > 0 ? days[0].day : null);
  };

  useEffect(() => { fetchReceiptDaysAndProducts(); }, [hotelUid]);

  const totalMatched = foundProducts.length;
  const totalUnique = foundProducts.length + notFoundProducts.length;
  const matchPercent = totalUnique > 0 ? ((totalMatched / totalUnique) * 100).toFixed(1) : "0.0";

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const monthRange = useMemo(() => {
    const start = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), 1);
    const end = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0);
    return {
      start,
      end,
      startStr: formatLocalDate(start),
      endStr: formatLocalDate(end)
    };
  }, [currentMonthStart]);

  const visibleDateList = useMemo(() => {
    return dateRange(monthRange.startStr, monthRange.endStr);
  }, [monthRange.endStr, monthRange.startStr]);

  const sortedDays = useMemo(() => {
    const daysWithCounts = visibleDateList.map(dayStr => {
      const found = receiptDays.find(d => d.day === dayStr);
      return found ? found : { day: dayStr, receiptCount: 0 };
    });

    return [...daysWithCounts].sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (sortBy === "day") {
        if (sortDir === "asc") return valA.localeCompare(valB);
        return valB.localeCompare(valA);
      }
      if (sortDir === "asc") return valA - valB;
      return valB - valA;
    });
  }, [visibleDateList, receiptDays, sortBy, sortDir]);

  const monthLabel = useMemo(() => {
    return currentMonthStart.toLocaleDateString("nl-BE", { month: "long", year: "numeric" });
  }, [currentMonthStart]);

  const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth();
  const prevMonthStart = useMemo(() => new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 1, 1), [currentMonthStart]);
  const nextMonthStart = useMemo(() => new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1), [currentMonthStart]);
  const todayMonthStart = useMemo(() => getLocalMonthStart(), []);
  const minMonthIndex = useMemo(() => {
    if (!minAvailableDay) return null;
    const [year, month] = minAvailableDay.split("-");
    return Number(year) * 12 + (Number(month) - 1);
  }, [minAvailableDay]);

  const canGoPrev = minMonthIndex === null || monthIndex(prevMonthStart) >= minMonthIndex;
  const canGoNext = monthIndex(currentMonthStart) < monthIndex(todayMonthStart);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setCurrentMonthStart(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setCurrentMonthStart(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const normalizedExcluded = useMemo(
    () => excludedNames.map(name => name.trim().toLowerCase()).filter(Boolean),
    [excludedNames]
  );

  const filteredNotFoundProducts = useMemo(() => {
    if (normalizedExcluded.length === 0) return notFoundProducts;
    return notFoundProducts.filter(prod => {
      const prodName = (prod.name || "").trim().toLowerCase();
      const prodId = String(prod.productId || "").trim().toLowerCase();
      return !normalizedExcluded.some(exName => exName === prodName || exName === prodId);
    });
  }, [notFoundProducts, normalizedExcluded]);

  const filteredNotFoundCount = filteredNotFoundProducts.length;
  const excludedCount = notFoundProducts.length - filteredNotFoundCount;

  const handleAddExcludedName = (event) => {
    event.preventDefault();
    const value = excludeInput.trim();
    if (!value) return;
    const exists = normalizedExcluded.includes(value.toLowerCase());
    if (exists) {
      setExcludeInput("");
      return;
    }
    setExcludedNames(prev => [...prev, value]);
    setExcludeInput("");
  };

  const handleRemoveExcludedName = (name) => {
    setExcludedNames(prev => prev.filter(n => n !== name));
  };

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer className="max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UploadCloud className="w-7 h-7 text-marriott" />
              {title}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {subtitle}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <input
              type="file"
              accept=".csv"
              ref={receiptsInputRef}
              className="hidden"
              onChange={handleImportReceipts}
            />
            <button
              type="button"
              onClick={() => receiptsInputRef.current && receiptsInputRef.current.click()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-marriott bg-white px-4 py-2 font-medium text-marriott shadow-sm transition hover:bg-marriott hover:text-white"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Receipts importeren
            </button>
            <input
              type="file"
              accept=".csv"
              ref={receiptItemsInputRef}
              className="hidden"
              onChange={handleImportReceiptItems}
            />
            <button
              type="button"
              onClick={() => receiptItemsInputRef.current && receiptItemsInputRef.current.click()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-marriott bg-white px-4 py-2 font-medium text-marriott shadow-sm transition hover:bg-marriott hover:text-white"
            >
              <ListOrdered className="h-4 w-4" />
              Receipt items importeren
            </button>
            <input
              type="file"
              accept=".csv"
              ref={discountItemsInputRef}
              className="hidden"
              onChange={handleImportDiscountItems}
            />
            <button
              type="button"
              onClick={() => discountItemsInputRef.current && discountItemsInputRef.current.click()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-marriott bg-white px-4 py-2 font-medium text-marriott shadow-sm transition hover:bg-marriott hover:text-white"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Import Discount Items
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-red-800">{error}</div>
        )}

        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {[{ id: "overview", label: "Overview" }, { id: "nonLinked", label: "Non-Linked Products" }].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "border-marriott bg-marriott text-white shadow"
                    : "border-gray-200 bg-white text-gray-600 hover:border-marriott hover:text-marriott"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold">Overview</h2>
                  <p className="text-sm text-gray-500">Dagen en aantal receipts per maand</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    disabled={!canGoPrev}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                      canGoPrev ? "border-gray-300 text-gray-600 hover:bg-gray-100" : "border-gray-200 text-gray-300"
                    }`}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="font-medium capitalize">{monthLabel}</span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    disabled={!canGoNext}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                      canGoNext ? "border-gray-300 text-gray-600 hover:bg-gray-100" : "border-gray-200 text-gray-300"
                    }`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div className="text-sm font-medium">
                  {productLinkLabel}
                  <span
                    className={`ml-2 text-lg font-extrabold ${
                      matchPercent >= 90 ? "text-green-600" : matchPercent >= 70 ? "text-yellow-600" : "text-red-600"
                    }`}
                  >
                    {matchPercent}%
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    ({totalMatched} van {totalUnique} unieke producten)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-2" style={{ width: 45 }}></th>
                        <th
                          className="px-4 py-2 cursor-pointer select-none"
                          onClick={() => {
                            setSortBy("day");
                            setSortDir(sortDir === "desc" ? "asc" : "desc");
                          }}
                        >
                          Dag {sortBy === "day" ? (sortDir === "desc" ? <ArrowDown className="inline h-4 w-4" /> : <ArrowUp className="inline h-4 w-4" />) : <ArrowDownUp className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-4 py-2 cursor-pointer select-none"
                          onClick={() => {
                            setSortBy("receiptCount");
                            setSortDir(sortDir === "desc" ? "asc" : "desc");
                          }}
                        >
                          Aantal receipts {sortBy === "receiptCount" ? (sortDir === "desc" ? <ArrowDown className="inline h-4 w-4" /> : <ArrowUp className="inline h-4 w-4" />) : <ArrowDownUp className="inline h-4 w-4" />}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDays.map(dayObj => (
                        <tr key={dayObj.day} className="border-b last:border-0">
                          <td className="px-2 py-2">
                            {dayObj.receiptCount > 0 ? (
                              <Circle className="inline h-4 w-4 text-green-600" fill="currentColor" title="Gesynced" />
                            ) : (
                              <Circle className="inline h-4 w-4 text-red-500" fill="currentColor" title="Niet gesynced" />
                            )}
                          </td>
                          <td className="px-4 py-2 font-semibold">{formatDateNL(dayObj.day)}</td>
                          <td className="px-4 py-2">{dayObj.receiptCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {duplicateProducts.length > 0 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                    <div className="font-medium">Dubbele producten in database:</div>
                    <ul className="mt-2 list-disc pl-5">
                      {duplicateProducts.map(dup => (
                        <li key={dup.productId}>
                          {dup.products.map(p => p.name).join(" / ")} <span className="text-xs text-gray-500">({dup.productId})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "nonLinked" && (
            <div className="grid gap-6">
              <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow">
                <div className="border-b border-gray-200 px-4 py-3">
                  <h2 className="text-lg font-semibold">Excluded Products</h2>
                  <p className="text-sm text-gray-500">
                    Beheer de namen of IDs die worden uitgesloten van de lijst met niet gekoppelde producten.
                  </p>
                </div>
                <div className="space-y-4 p-4">
                  <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleAddExcludedName}>
                    <label className="flex-1 text-sm font-medium text-gray-700">
                      <span className="block text-xs uppercase tracking-wide text-gray-500">Naam of ID uitsluiten</span>
                      <input
                        type="text"
                        value={excludeInput}
                        onChange={event => setExcludeInput(event.target.value)}
                        placeholder="Bijvoorbeeld: Gratis water"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-marriott focus:outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-2 inline-flex items-center justify-center rounded-lg bg-marriott px-4 py-2 text-sm font-semibold text-white shadow hover:bg-marriott-dark sm:mt-6"
                    >
                      Toevoegen
                    </button>
                  </form>

                  {excludedNames.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Uitgesloten namen</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {excludedNames.map(name => (
                          <span key={name} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                            {name}
                            <button
                              type="button"
                              onClick={() => handleRemoveExcludedName(name)}
                              className="text-gray-500 transition hover:text-gray-800"
                              aria-label={`Verwijder ${name} uit uitsluitingen`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Er zijn nog geen namen uitgesloten.</p>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
                  <div>
                    <h2 className="text-lg font-semibold">Niet gekoppelde producten</h2>
                    <p className="text-sm text-gray-500">
                      {filteredNotFoundCount} producten worden momenteel getoond. {excludedCount > 0 && `${excludedCount} uitgesloten via de lijst.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNotFound(o => !o)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-marriott hover:underline"
                  >
                    {showNotFound ? "Verberg lijst" : "Toon lijst"}
                  </button>
                </div>
                <div className="space-y-4 p-4">
                  {showNotFound && (
                    <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200">
                      {filteredNotFoundCount === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">Geen niet-gekoppelde producten over.</div>
                      ) : (
                        <ul className="divide-y divide-gray-100 text-sm">
                          {filteredNotFoundProducts.map(prod => (
                            <li key={prod.productId} className="flex items-center justify-between px-4 py-2">
                              <span>{prod.name || "(geen naam)"}</span>
                              <span className="text-xs text-gray-500">{prod.productId}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </PageContainer>
      <ProgressModal
        open={showProgressModal}
        progress={progress}
        text={progressText}
        doneText={progressDoneText}
        onClose={() => setShowProgressModal(false)}
      />
    </>
  );
}
