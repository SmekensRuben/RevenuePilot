import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp, Layers } from "lucide-react";
import { toast } from "react-toastify";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { Button } from "../layout/Button";
import {
  auth,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  setDoc,
  signOut,
} from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";

const normalizeHeader = (header) => String(header || "").replace(/^\uFEFF/, "").trim();

const formatCompactDate = (value) => {
  const raw = String(value || "").trim();
  if (!/^\d{8}$/.test(raw)) return "";
  const day = raw.slice(0, 2);
  const month = raw.slice(2, 4);
  const year = raw.slice(4, 8);
  return `${year}-${month}-${day}`;
};

const formatSlashDate = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const parseCsvFile = (file) =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: resolve,
      error: reject,
    });
  });

export default function BlocksPage() {
  const { hotelUid } = useHotelContext();
  const fileInputRef = useRef(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const loadBlocks = async () => {
    if (!hotelUid) {
      setBlocks([]);
      return;
    }

    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, `hotels/${hotelUid}/blocks`));
      const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      items.sort((a, b) => String(a.blockName || a.id).localeCompare(String(b.blockName || b.id)));
      setBlocks(items);
    } catch (error) {
      console.error("Blokken laden mislukt", error);
      toast.error("Blokken konden niet geladen worden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, [hotelUid]);

  const triggerImport = () => {
    if (importing) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !hotelUid) return;

    setImporting(true);
    try {
      const result = await parseCsvFile(file);
      const rows = Array.isArray(result.data) ? result.data : [];
      if (!rows.length) {
        toast.warn("Geen rijen gevonden in CSV.");
        return;
      }

      const groupedById = new Map();
      rows.forEach((row) => {
        const blockId = String(row.ALLOTMENT_HEADER_ID || "").trim();
        if (!blockId) return;

        if (!groupedById.has(blockId)) {
          groupedById.set(blockId, {
            blockName: String(row.DESCRIPTION || "").trim(),
            ownerCode: String(row.OWNER_CODE || "").trim(),
            companyName: String(row.COMPANY || "").trim(),
            changes: [],
          });
        }

        const change = {
          beginDate: formatCompactDate(row.BEGIN_DATE),
          endDate: formatCompactDate(row.END_DATE),
          roomRevenue: String(row.CF_ROOM_REVENUE || "").trim(),
          insertDate: formatSlashDate(row.INSERT_DATE_SORT),
          roomStatus: String(row.ROOM_STATUS || "").trim(),
          cateringStatus: String(row.CATERING_STATUS || "").trim(),
          roomNights: String(row.CF_NIGHTS || "").trim(),
        };

        groupedById.get(blockId).changes.push(change);
      });

      const entries = [...groupedById.entries()];
      if (!entries.length) {
        toast.warn("Geen geldige ALLOTMENT_HEADER_ID waarden gevonden.");
        return;
      }

      for (const [blockId, payload] of entries) {
        const blockRef = doc(db, `hotels/${hotelUid}/blocks`, blockId);
        const existing = await getDoc(blockRef);
        const existingChanges = existing.exists() && Array.isArray(existing.data().changes)
          ? existing.data().changes
          : [];

        await setDoc(blockRef, {
          blockName: payload.blockName,
          ownerCode: payload.ownerCode,
          companyName: payload.companyName,
          changes: [...existingChanges, ...payload.changes],
        }, { merge: true });
      }

      toast.success(`${entries.length} blocks geïmporteerd.`);
      await loadBlocks();
    } catch (error) {
      console.error("Import blocks mislukt", error);
      toast.error("Importeren van blocks is mislukt.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 space-y-6">
          <Card>
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Blocks</h1>
                  <p className="text-sm text-gray-600 mt-1">Overzicht van alle blocks per hotel.</p>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button onClick={triggerImport} disabled={importing || !hotelUid}>
                    <FileUp className="h-4 w-4 mr-2" />
                    {importing ? "Importeren..." : "Import blocks"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5 sm:p-6">
              {loading ? (
                <p className="text-sm text-gray-500">Blocks laden...</p>
              ) : !blocks.length ? (
                <p className="text-sm text-gray-500">Nog geen blocks gevonden.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Blocknaam</th>
                        <th className="py-2 pr-4">Owner code</th>
                        <th className="py-2 pr-4">Company</th>
                        <th className="py-2 pr-4">Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocks.map((block) => (
                        <tr key={block.id} className="border-b last:border-b-0 text-gray-800">
                          <td className="py-2 pr-4 font-medium">{block.id}</td>
                          <td className="py-2 pr-4">{block.blockName || "-"}</td>
                          <td className="py-2 pr-4">{block.ownerCode || "-"}</td>
                          <td className="py-2 pr-4">{block.companyName || "-"}</td>
                          <td className="py-2 pr-4">
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                              <Layers className="h-3 w-3" />
                              {Array.isArray(block.changes) ? block.changes.length : 0}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}
