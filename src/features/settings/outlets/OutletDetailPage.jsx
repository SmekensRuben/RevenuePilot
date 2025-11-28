import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import OutletCard from "../cards/OutletCard";
import { useHotelContext } from "contexts/HotelContext";
import {
  getSettings,
  getOutlets,
  setOutlets,
} from "services/firebaseSettings";
import {
  removeOutletFromProducts,
  renameOutletInProducts,
} from "services/firebaseProducts";
import { getSelectedHotelUid } from "utils/hotelUtils";
import { useTranslation } from "react-i18next";

export default function OutletDetailPage() {
  const { outletId: rawOutletId = "" } = useParams();
  const outletKey = decodeURIComponent(rawOutletId);
  const { hotelName: hotelContextName, language } = useHotelContext?.() || {};
  const hotelUid = getSelectedHotelUid();
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState(outletKey);
  const { t: tCommon } = useTranslation("common");

  const locale = useMemo(() => {
    switch (language) {
      case "en":
        return "en-GB";
      case "fr":
        return "fr-FR";
      default:
        return "nl-NL";
    }
  }, [language]);
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [locale]
  );

  useEffect(() => {
    setActiveKey(outletKey);
  }, [outletKey]);

  const [settings, setSettingsState] = useState({});
  useEffect(() => {
    if (!hotelUid) return;
    getSettings(hotelUid).then(setSettingsState);
  }, [hotelUid]);

  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const [outlets, setOutletsState] = useState([]);
  useEffect(() => {
    if (!hotelUid) return;
    getOutlets(hotelUid).then(data => setOutletsState(Array.isArray(data) ? data : []));
  }, [hotelUid]);

  const outlet = useMemo(
    () =>
      outlets.find(o => {
        const identifier = o.id || o.name;
        if (identifier === activeKey) return true;
        if (!o.id && identifier === outletKey) return true;
        return false;
      }),
    [outlets, activeKey, outletKey]
  );

  const handleBack = () => {
    navigate("/settings/outlets");
  };

  const handleUpdateOutlet = async updatedFields => {
    if (!outlet) return;
    const index = outlets.findIndex(o => (o.id || o.name) === activeKey);
    if (index === -1) return;
    const previousName = outlets[index].name;
    const nextOutlets = outlets.map((item, idx) =>
      idx === index ? { ...item, ...updatedFields } : item
    );
    const savedOutlets = await setOutlets(hotelUid, nextOutlets);
    const updatedList = Array.isArray(savedOutlets) ? savedOutlets : nextOutlets;
    setOutletsState(updatedList);
    if (
      updatedFields?.name &&
      updatedFields.name.trim() &&
      updatedFields.name !== previousName
    ) {
      const newName = updatedFields.name.trim();
      await renameOutletInProducts(hotelUid, previousName, newName);
      const updatedOutlet = updatedList.find(o => (o.id || o.name) === (outlet.id || outlet.name));
      const newKey = updatedOutlet?.id || newName;
      if (newKey && newKey !== activeKey) {
        setActiveKey(newKey);
        navigate(`/settings/outlets/${encodeURIComponent(newKey)}`, { replace: true });
      }
    }
  };

  const handleDeleteOutlet = async id => {
    const targetId = id || activeKey;
    const targetOutlet = outlets.find(o => (o.id || o.name) === targetId);
    const nextOutlets = outlets.filter(o => (o.id || o.name) !== targetId);
    const savedOutlets = await setOutlets(hotelUid, nextOutlets);
    setOutletsState(Array.isArray(savedOutlets) ? savedOutlets : nextOutlets);
    if (targetOutlet) {
      await removeOutletFromProducts(hotelUid, targetOutlet.name);
    }
    navigate("/settings/outlets");
  };

  return (
    <>
      <HeaderBar
        hotelName={settings.hotelName || hotelContextName}
        today={today}
        onLogout={handleLogout}
      />
      <PageContainer className="flex-1 bg-slate-100 min-h-screen">
        <main className="mx-auto w-full max-w-5xl px-4 py-8 flex flex-col gap-6">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-marriott hover:text-marriott-dark transition-colors"
          >
            <ArrowLeft size={16} />
            Terug naar overzicht
          </button>

          {!outlet ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow px-4 py-6 text-center text-gray-600">
              Outlet niet gevonden.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-marriott to-marriott/80 p-8 text-white shadow-xl">
                <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35)_0,_rgba(255,255,255,0)_60%)]" />
                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3 max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur">
                      Outlet
                    </span>
                    <div>
                      <h1 className="text-3xl font-semibold lg:text-4xl">{outlet.name}</h1>
                      {outlet.description && (
                        <p className="mt-2 text-sm lg:text-base text-white/80">
                          {outlet.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                    <p className="text-xs uppercase tracking-wide text-white/70">Kerngegevens</p>
                    <dl className="mt-4 space-y-3 text-sm">
                      {outlet.department && (
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-white/70">Afdeling</dt>
                          <dd className="font-medium text-white">{outlet.department}</dd>
                        </div>
                      )}
                      {outlet.outletId && (
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-white/70">Outlet ID</dt>
                          <dd className="font-mono text-white">{outlet.outletId}</dd>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-white/70">Suboutlets</dt>
                        <dd className="font-medium text-white">{(outlet.subOutlets || []).length}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-white/70">Menu-categorieën</dt>
                        <dd className="font-medium text-white">{(outlet.menuCategories || []).length}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-white/70">Cost center IDs</dt>
                        <dd className="font-medium text-white">{(outlet.costCenterIds || []).length}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>

              <OutletCard
                outlet={outlet}
                onSave={handleUpdateOutlet}
                onDelete={handleDeleteOutlet}
              />
            </div>
          )}
        </main>
      </PageContainer>
    </>
  );
}
