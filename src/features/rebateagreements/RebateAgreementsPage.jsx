import React, { useEffect, useState } from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { usePermission } from "../../hooks/usePermission";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getRebateAgreements } from "../../services/firebaseRebateAgreements";
import { getOrderedUnitsByArticle } from "../../services/ordersAdapter";
import { normalizeTiers, computeEligibleTierUnits, nextTierProgress, tierIndexFor, computeRebateTotal } from "./tierLogic";

export default function RebateAgreementsPage() {
  const { hotelName, hotelUid } = useHotelContext();
  const { t } = useTranslation("hoteldashboard");
  const canView = usePermission("rebateagreements", "view");
  const navigate = useNavigate();

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const [agreements, setAgreements] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!hotelUid) return; // guard against undefined path
        const res = await getRebateAgreements(hotelUid);
        const enriched = await Promise.all(
          (res || []).map(async (ag) => {
            const articles = (ag.articles || []).map((id) => ({
              id,
              unitsPerTierUnit: ag.articleConfigs?.[id]?.unitsPerTierUnit || 1,
            }));
            const ordered = await getOrderedUnitsByArticle({
              articleIds: articles.map((a) => a.id),
              start: ag.start,
              end: ag.end,
            });
            const tiers = normalizeTiers(ag.tiers || []);
            const eligible = computeEligibleTierUnits({ ...ag, articles }, ordered);
            const progress = nextTierProgress(eligible, tiers);
            const tierIdx = tierIndexFor(eligible, tiers);
            const totalUnits = Object.values(ordered).reduce((s, v) => s + Number(v || 0), 0);
            const totalRebate = computeRebateTotal(eligible, tiers, ag.method);
            return { ...ag, articles, progress, tierIdx, totalUnits, totalRebate, tierCount: tiers.length };
          })
        );
        setAgreements(enriched);
      } catch (e) {
        console.error("Failed to load rebate agreements", e);
      }
    })();
  }, [hotelUid]);

  if (!canView) return <div>{t("noAccessModule")}</div>;

  const filtered = status ? agreements.filter(a => a.status === status) : agreements;

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={() => { sessionStorage.clear(); window.location.href = "/login"; }} />
      <PageContainer className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t("rebateAgreementsTitle") || "Rebate Agreements"}</h1>
          <button className="bg-black text-white p-2 rounded-lg hover:opacity-90" onClick={() => navigate("/rebate-agreements/new")} title="Add">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">{t("rebateAgreementsSubtitle") || "Manage vendor rebates, track tier progress and settlements."}</p>

        {/* Status-only filter */}
        <div className="mb-4">
          <select className="border px-3 py-2 rounded w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option>Draft</option>
            <option>Active</option>
            <option>Expired</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Agreement</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Scope</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Purchased</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tier</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Progress</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Total Rebate</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Valid</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((ag) => (
                <tr key={ag.id} onClick={() => navigate(`/rebate-agreements/${ag.id}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-2 whitespace-nowrap">{ag.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{ag.mode === "brand" ? ag.brand : `${ag.articles?.length || 0} articles`}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{ag.totalUnits?.toFixed(2)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {ag.tierCount ? `${ag.tierIdx >= 0 ? ag.tierIdx + 1 : 0}/${ag.tierCount}` : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="w-24 h-2 bg-gray-200 rounded" title={ag.progress?.label}>
                      <div className="h-full bg-black rounded" style={{ width: `${ag.progress?.percent || 0}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">€ {ag.totalRebate?.toFixed(2)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{ag.start} - {ag.end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageContainer>
    </>
  );
}
