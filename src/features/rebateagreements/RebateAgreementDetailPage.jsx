import React, { useState, useEffect, useMemo } from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { usePermission } from "../../hooks/usePermission";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Combobox } from "components/ui/combobox";
import { normalizeTiers, computeEligibleTierUnits, computeRebateTotal, nextTierProgress } from "../rebateagreements/tierLogic";
import {
  addRebateAgreement,
  updateRebateAgreement,
  getRebateAgreement,
  deleteRebateAgreement,
} from "../../services/firebaseRebateAgreements";
import { getArticlesIndexed } from "../../services/firebaseArticles";
import { getOrderedUnitsByArticle } from "../../services/ordersAdapter";

export default function RebateAgreementDetailPage() {
  const { hotelName, hotelUid } = useHotelContext();
  const { t } = useTranslation("hoteldashboard");
  const canView = usePermission("rebateagreements", "view");
  const { agreementId } = useParams();
  const isNew = !agreementId || agreementId === "new";
  const navigate = useNavigate();

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const [agreement, setAgreement] = useState({
    name: "",
    status: "Active",
    mode: "brand", // 'brand' or 'articles'
    brand: "",
    articles: [], // [{id, name, unitsPerTierUnit}]
    start: "",
    end: "",
    method: "RETROACTIVE", // or 'INCREMENTAL'
    tiers: [{ from: 0, to: null, rebate: 0 }],
  });
  const [allArticles, setAllArticles] = useState([]);
  const [orderedMap, setOrderedMap] = useState({}); // { articleId: units }

  const allArticleIds = useMemo(() => agreement.articles.map((a) => a?.id || a).filter(Boolean), [agreement.articles]);

  useEffect(() => { getArticlesIndexed().then(setAllArticles); }, []);

  useEffect(() => {
    if (!isNew) {
      // IMPORTANT: pass hotelUid if your service requires it
      getRebateAgreement(hotelUid, agreementId).then((data) => {
        if (!data) return;
        const tiers = normalizeTiers(data.tiers || []);
        const articles = (data.articles || []).map((id) => {
          const base = allArticles.find((a) => a.id === id) || { id, name: id };
          const stored = (data.articleConfigs || {})[id];
          return { ...base, unitsPerTierUnit: stored?.unitsPerTierUnit ?? 1 };
        });
        setAgreement({
          name: data.name || "",
          status: data.status || "Active",
          mode: data.mode || (data.brand ? "brand" : "articles"),
          brand: data.brand || "",
          articles,
          start: data.start || "",
          end: data.end || "",
          method: data.method || "RETROACTIVE",
          tiers,
        });
      });
    }
  }, [agreementId, allArticles, hotelUid]);

  // Auto-fetch ordered units per article (placeholder returns zeros until wired)
  useEffect(() => {
    if (!allArticleIds.length || !agreement.start || !agreement.end) {
      setOrderedMap({});
      return;
    }
    getOrderedUnitsByArticle({ articleIds: allArticleIds, start: agreement.start, end: agreement.end })
      .then(setOrderedMap)
      .catch(() => setOrderedMap({}));
  }, [allArticleIds, agreement.start, agreement.end]);

  const addTier = () => setAgreement((prev) => ({ ...prev, tiers: [...prev.tiers, { from: 0, to: null, rebate: 0 }] }));
  const removeTier = (index) => setAgreement((prev) => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }));
  const updateTier = (idx, field, value) => setAgreement((prev) => ({
    ...prev,
    tiers: prev.tiers.map((t, i) => (i === idx ? { ...t, [field]: value === "" ? "" : Number(value) } : t)),
  }));

  const addArticle = () => setAgreement((prev) => ({ ...prev, articles: [...prev.articles, { id: null, name: "", unitsPerTierUnit: 1 }] }));
  const updateArticle = (index, value) =>
    setAgreement((prev) => {
      const articles = prev.articles.map((a, i) =>
        i === index ? { ...(value || {}), id: value?.id || null, name: value?.name || "", unitsPerTierUnit: a?.unitsPerTierUnit ?? 1 } : a
      );
      return { ...prev, articles };
    });
  const updateArticleUnit = (index, factor) =>
    setAgreement((prev) => ({
      ...prev,
      articles: prev.articles.map((a, i) => (i === index ? { ...a, unitsPerTierUnit: Number(factor) || 1 } : a)),
    }));
  const removeArticle = (index) => setAgreement((prev) => ({ ...prev, articles: prev.articles.filter((_, i) => i !== index) }));

  const tiers = useMemo(() => normalizeTiers(agreement.tiers || []), [agreement.tiers]);
  const eligibleTierUnits = useMemo(() => computeEligibleTierUnits(agreement, orderedMap), [agreement, orderedMap]);
  const progress = useMemo(() => nextTierProgress(eligibleTierUnits, tiers), [eligibleTierUnits, tiers]);
  const totalRebate = useMemo(() => computeRebateTotal(eligibleTierUnits, tiers, agreement.method), [eligibleTierUnits, tiers, agreement.method]);
  const totalUnits = useMemo(() => Object.values(orderedMap).reduce((acc, v) => acc + Number(v || 0), 0), [orderedMap]);

  const handleSave = async () => {
    const payload = {
      name: agreement.name,
      status: agreement.status,
      mode: agreement.mode,
      brand: agreement.mode === "brand" ? agreement.brand : "",
      start: agreement.start,
      end: agreement.end,
      method: agreement.method,
      // ids + config map
      articles: agreement.articles.filter((a) => a && a.id).map((a) => a.id),
      articleConfigs: Object.fromEntries(
        agreement.articles.filter((a) => a && a.id).map((a) => [a.id, { unitsPerTierUnit: Number(a.unitsPerTierUnit) || 1 }])
      ),
      tiers: tiers.map((t) => ({ from: Number(t.from), to: t.to == null ? null : Number(t.to), rebate: Number(t.rebate) })),
    };

    try {
      if (!hotelUid) throw new Error("hotelUid missing");
      if (isNew) {
        await addRebateAgreement(hotelUid, payload);
      } else {
        await updateRebateAgreement(hotelUid, agreementId, payload);
      }
      navigate("/rebate-agreements");
    } catch (err) {
      console.error("Save failed", err);
      alert("Saving failed. Check console for details.");
    }
  };

  const handleDelete = async () => {
    if (!isNew && confirm("Delete this agreement?")) {
      await deleteRebateAgreement(hotelUid, agreementId);
      navigate("/rebate-agreements");
    }
  };

  if (!canView) return <div>{t("noAccessModule")}</div>;

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={() => { sessionStorage.clear(); window.location.href = "/login"; }} />
      <PageContainer className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{isNew ? "New Rebate Agreement" : (agreement.name || "Rebate Agreement")}</h1>
          {!isNew && (
            <button className="text-red-600 hover:text-red-800" onClick={handleDelete} title="Delete">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label htmlFor="name" className="text-sm mb-1">Name</label>
              <input id="name" type="text" className="border px-3 py-2 rounded" value={agreement.name}
                     onChange={(e) => setAgreement({ ...agreement, name: e.target.value })} />
            </div>
            <div className="flex flex-col">
              <label htmlFor="status" className="text-sm mb-1">Status</label>
              <select id="status" className="border px-3 py-2 rounded" value={agreement.status}
                      onChange={(e) => setAgreement({ ...agreement, status: e.target.value })}>
                <option>Active</option>
                <option>Draft</option>
                <option>Expired</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="start" className="text-sm mb-1">Start</label>
              <input id="start" type="date" className="border px-3 py-2 rounded" value={agreement.start}
                     onChange={(e) => setAgreement({ ...agreement, start: e.target.value })} />
            </div>
            <div className="flex flex-col">
              <label htmlFor="end" className="text-sm mb-1">End</label>
              <input id="end" type="date" className="border px-3 py-2 rounded" value={agreement.end}
                     onChange={(e) => setAgreement({ ...agreement, end: e.target.value })} />
            </div>

            <div className="flex flex-col md:col-span-2">
              <span className="text-sm mb-1">Scope</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="mode" value="brand" checked={agreement.mode === "brand"}
                         onChange={(e) => setAgreement({ ...agreement, mode: e.target.value })} />
                  Brand
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="mode" value="articles" checked={agreement.mode === "articles"}
                         onChange={(e) => setAgreement({ ...agreement, mode: e.target.value })} />
                  Articles
                </label>
              </div>
            </div>

            {agreement.mode === "brand" ? (
              <div className="flex flex-col md:col-span-2">
                <label htmlFor="brand" className="text-sm mb-1">Brand</label>
                <input id="brand" type="text" className="border px-3 py-2 rounded" value={agreement.brand}
                       onChange={(e) => setAgreement({ ...agreement, brand: e.target.value })} />
              </div>
            ) : (
              <div className="md:col-span-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left pb-1">Article</th>
                      <th className="text-left pb-1">Units per tier unit</th>
                      <th className="pb-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {agreement.articles.map((art, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-1">
                          <Combobox
                            value={art}
                            onChange={(val) => updateArticle(idx, val)}
                            options={allArticles}
                            displayValue={(opt) =>
                              [opt?.name, opt?.brand, opt?.supplier]
                                .filter(Boolean)
                                .join(" - ")
                            }
                            getOptionValue={(opt) => opt?.id}
                            placeholder="Select article"
                          />
                        </td>
                        <td className="py-1">
                          <input type="number" min={0.0001} step={0.0001} className="border px-3 py-2 rounded w-full" value={art?.unitsPerTierUnit ?? 1}
                                 onChange={(e) => updateArticleUnit(idx, e.target.value)} />
                        </td>
                        <td className="py-1 w-10 text-right">
                          <button type="button" className="text-red-600" onClick={() => removeArticle(idx)} title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="mt-2 flex items-center gap-1 text-sm text-blue-600" onClick={addArticle}>
                  <Plus className="w-4 h-4" /> Add article
                </button>
              </div>
            )}

            <div className="flex flex-col md:col-span-2">
              <label htmlFor="method" className="text-sm mb-1">Method</label>
              <select id="method" className="border px-3 py-2 rounded" value={agreement.method}
                      onChange={(e) => setAgreement({ ...agreement, method: e.target.value })}>
                <option value="RETROACTIVE">RETROACTIVE</option>
                <option value="INCREMENTAL">INCREMENTAL</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Tiers</h2>
              <button type="button" className="text-sm text-blue-600 flex items-center gap-1" onClick={addTier}>
                <Plus className="w-4 h-4" /> Add tier
              </button>
            </div>
            <table className="w-full text-sm mb-2">
              <thead>
                <tr>
                  <th className="text-left pb-1">From (tier units)</th>
                  <th className="text-left pb-1">To (blank = ∞)</th>
                  <th className="text-left pb-1">Rebate (€/tier unit)</th>
                  <th className="pb-1"></th>
                </tr>
              </thead>
              <tbody>
                {agreement.tiers.map((tier, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="py-1">
                      <input id={`from-${idx}`} type="number" className="border px-3 py-2 rounded w-full" value={tier.from}
                             onChange={(e) => updateTier(idx, "from", e.target.value)} />
                    </td>
                    <td className="py-1">
                      <input id={`to-${idx}`} type="number" className="border px-3 py-2 rounded w-full" value={tier.to ?? ""}
                             onChange={(e) => updateTier(idx, "to", e.target.value)} />
                    </td>
                    <td className="py-1">
                      <input id={`rebate-${idx}`} type="number" step={0.01} className="border px-3 py-2 rounded w-full" value={tier.rebate}
                             onChange={(e) => updateTier(idx, "rebate", e.target.value)} />
                    </td>
                    <td className="py-1 w-10 text-right">
                      {agreement.tiers.length > 1 && (
                        <button type="button" className="text-red-600" onClick={() => removeTier(idx)} title="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500">Voorbeeld: 0–1000, 1000–3000, 3000–∞. Laatste “To” leeg voor open einde.</p>
          </div>

          <div className="p-4 bg-gray-50 border rounded space-y-2">
            <div className="text-sm text-gray-600">Purchased units: <b>{totalUnits.toFixed(2)}</b></div>
            <div className="text-sm text-gray-600">Eligible tier units (auto from orders): <b>{eligibleTierUnits.toFixed(2)}</b></div>
            <div className="text-sm text-gray-600">Total rebate ({agreement.method}): <b>€ {totalRebate.toFixed(2)}</b></div>
            <div>
              <div className="text-xs text-gray-600 mb-1">{progress.label}</div>
              <div className="h-2 w-full bg-gray-200 rounded">
                <div className="h-full bg-black rounded" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          </div>

          <button type="button" onClick={handleSave} className="bg-black text-white px-4 py-2 rounded">Save</button>
        </div>
      </PageContainer>
    </>
  );
}
