import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import SettingsSidebar from "./SettingsSidebar";
import SettingsTabBar from "./SettingsTabBar";
import GeneralSettings from "./sections/GeneralSettings";
import StamgegevensSettings from "./sections/StamgegevensSettings";
import PeopleSettings from "./sections/PeopleSettings";
import OrderingSettings from "./sections/OrderingSettings";
import SynchronisatieSettings from "./sections/SynchronisatieSettings";
import MappingsSettings from "./sections/MappingsSettings";
import DataUploadSettings from "./sections/DataUploadSettings";
import TransferDataSettings from "./sections/TransferDataSettings";
import ReportingSettings from "./sections/ReportingSettings";
import { useHotelContext } from "contexts/HotelContext";
import { getSettingsNavTabs } from "./settingsNavTabs";
import {
  getSettings, setSettings,
  getCategories, addCategory, deleteCategory,
  getProductCategories, addProductCategory, deleteProductCategory,
  getSuppliers, addSupplier, deleteSupplier,
  getUnits, setUnits,
  getLocations, setLocations,
  getSalesPromoTypes, setSalesPromoTypes,
  getCategoryMappings, addCategoryMapping, deleteCategoryMapping
} from "services/firebaseSettings";
import { getSelectedHotelUid } from "utils/hotelUtils";
import { useTranslation } from "react-i18next";

const CONTENT_TABS = [
  { key: "general", component: GeneralSettings },
  { key: "reporting", component: ReportingSettings },
  { key: "ordering", component: OrderingSettings },
  { key: "people", component: PeopleSettings },
  { key: "stamgegevens", component: StamgegevensSettings },
  { key: "synchronisatie", component: SynchronisatieSettings },
  { key: "mappings", component: MappingsSettings },
  { key: "data-upload", component: DataUploadSettings },
  { key: "transfer", component: TransferDataSettings }
];

const CONTENT_TAB_KEYS = CONTENT_TABS.map(tab => tab.key);

const DEFAULT_TAB_KEY = "general";

const getTabFromSearch = search => {
  const params = new URLSearchParams(search);
  const tabParam = params.get("tab");
  return CONTENT_TAB_KEYS.includes(tabParam) ? tabParam : DEFAULT_TAB_KEY;
};

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    hotelName: hotelContextName,
    roles: userRoles = [],
    language,
    setPosProvider,
    setOrderMode,
  } = useHotelContext?.() || {};
  const hotelUid = getSelectedHotelUid();
  const { t } = useTranslation("settings");
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

  const [activeTab, setActiveTab] = useState(() => getTabFromSearch(location.search));
  const syncInitialTab = location.state?.syncTab;

  useEffect(() => {
    setActiveTab(getTabFromSearch(location.search));
  }, [location.search]);

  // Logout
  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const tabs = useMemo(
    () => getSettingsNavTabs(userRoles, key => t(key)),
    [userRoles, t]
  );

  const handleSelectTab = tab => {
    if (tab.path) {
      navigate(tab.path);
      return;
    }

    if (!CONTENT_TAB_KEYS.includes(tab.key)) {
      return;
    }

    const targetTab = tab.key || DEFAULT_TAB_KEY;
    setActiveTab(targetTab);
    const params = new URLSearchParams(location.search);
    params.set("tab", targetTab);
    navigate({ pathname: "/settings", search: params.toString() });
  };

  // SETTINGS ophalen uit Firestore
  const [settings, setSettingsState] = useState({});
  useEffect(() => {
    getSettings(hotelUid).then(setSettingsState);
  }, [hotelUid]);

  // SETTINGS updaten ("Algemeen")
  const handleUpdateSettings = async (newSettings) => {
    await setSettings(hotelUid, newSettings);
    setSettingsState(prev => ({ ...prev, ...newSettings }));
    if (newSettings && Object.prototype.hasOwnProperty.call(newSettings, "posProvider")) {
      setPosProvider?.(newSettings.posProvider);
    }
    if (newSettings && Object.prototype.hasOwnProperty.call(newSettings, "orderMode")) {
      setOrderMode?.(newSettings.orderMode);
    }
  };

  // CATEGORIEËN
  const [categories, setCategories] = useState({});
  useEffect(() => { getCategories().then(setCategories); }, []);
  const categoryList = Object.entries(categories).map(([key, value]) => ({
    key,
    ...value,
    type: value.type || (
      key.startsWith("food_")
        ? "food"
        : key.startsWith("beverage_")
        ? "beverage"
        : key.startsWith("other_")
        ? "other"
        : "food"
    ),
  }));

  const handleAddCategory = async (key, label, vat, type, parentId = "") => {
    await addCategory(key, label, vat, type, parentId);
    setCategories(await getCategories());
  };
  const handleDeleteCategory = async (key) => {
    await deleteCategory(key);
    setCategories(await getCategories());
  };

  // PRODUCT CATEGORIEËN
  const [productCategories, setProductCategories] = useState({});
  useEffect(() => { getProductCategories().then(setProductCategories); }, []);
  const productCategoryList = Object.entries(productCategories).map(([key, value]) => ({
    key,
    ...value,
    type: value.type || (
      key.startsWith("food_")
        ? "food"
        : key.startsWith("beverage_")
        ? "beverage"
        : key.startsWith("other_")
        ? "other"
        : "food"
    ),
  }));

  const handleAddProductCategory = async (key, label, vat, type, parentId = "") => {
    await addProductCategory(key, label, vat, type, parentId);
    setProductCategories(await getProductCategories());
  };
  const handleDeleteProductCategory = async (key) => {
    await deleteProductCategory(key);
    setProductCategories(await getProductCategories());
  };

  // CATEGORIE-MAPPING
  const [categoryMappings, setCategoryMappings] = useState({});
  useEffect(() => { getCategoryMappings().then(setCategoryMappings); }, []);

  const handleAddCategoryMapping = async (pcKey, catKey) => {
    await addCategoryMapping(pcKey, catKey);
    setCategoryMappings(await getCategoryMappings());
  };
  const handleUpdateCategoryMapping = handleAddCategoryMapping;
  const handleDeleteCategoryMapping = async pcKey => {
    await deleteCategoryMapping(pcKey);
    setCategoryMappings(await getCategoryMappings());
  };

  // LEVERANCIERS
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => { getSuppliers().then(setSuppliers); }, []);
  const handleAddSupplier = async (supplierObj) => {
    await addSupplier(supplierObj);
    setSuppliers(await getSuppliers());
  };
  const handleUpdateSupplier = handleAddSupplier;
  const handleDeleteSupplier = async (id) => {
    await deleteSupplier(id);
    setSuppliers(await getSuppliers());
  };

  // UNITS
  const [units, setUnitsState] = useState([]);
  useEffect(() => { getUnits(hotelUid).then(setUnitsState); }, [hotelUid]);
  const handleAddUnit = async (unitObj) => {
    const newUnits = [...units, unitObj];
    await setUnits(hotelUid, newUnits);
    setUnitsState(newUnits);
  };
  const handleDeleteUnit = async (id) => {
    const newUnits = units.filter(unit => (unit.id || unit.name) !== id);
    await setUnits(hotelUid, newUnits);
    setUnitsState(newUnits);
  };

  // LOCATIONS
  const [locations, setLocationsState] = useState([]);
  useEffect(() => { getLocations(hotelUid).then(setLocationsState); }, [hotelUid]);
  const handleAddLocation = async (locationObj) => {
    const newLocations = [...locations, locationObj];
    await setLocations(hotelUid, newLocations);
    setLocationsState(newLocations);
  };
  const handleDeleteLocation = async (id) => {
    const newLocations = locations.filter(loc => (loc.id || loc.name) !== id);
    await setLocations(hotelUid, newLocations);
    setLocationsState(newLocations);
  };

  // SALES & PROMO TYPES
  const [salesPromoTypes, setSalesPromoTypesState] = useState([]);
  useEffect(() => {
    getSalesPromoTypes(hotelUid).then(setSalesPromoTypesState);
  }, [hotelUid]);
  const handleAddSalesPromoType = async typeName => {
    const trimmed = (typeName || "").trim();
    if (!trimmed) return;
    const exists = salesPromoTypes.some(
      type => type.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return;
    const newTypes = [...salesPromoTypes, { name: trimmed, checklist: [] }];
    await setSalesPromoTypes(hotelUid, newTypes);
    setSalesPromoTypesState(newTypes);
  };
  const handleDeleteSalesPromoType = async typeName => {
    const newTypes = salesPromoTypes.filter(type => type.name !== typeName);
    await setSalesPromoTypes(hotelUid, newTypes);
    setSalesPromoTypesState(newTypes);
  };
  const handleUpdateSalesPromoType = async updatedType => {
    if (!updatedType?.name) return;
    const newTypes = salesPromoTypes.map(type =>
      type.name === updatedType.name ? updatedType : type
    );
    await setSalesPromoTypes(hotelUid, newTypes);
    setSalesPromoTypesState(newTypes);
  };

  return (
    <>
      <HeaderBar
        hotelName={settings.hotelName || hotelContextName}
        today={today}
        onLogout={handleLogout}
      />
      <PageContainer className="flex-1 flex flex-col md:flex-row w-full bg-gray-50 min-h-screen">
        {/* Sidebar (desktop) */}
        <div className="hidden md:block md:w-64 bg-white border-r border-gray-200">
          <SettingsSidebar
            tabs={tabs}
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
          />
        </div>
        {/* Tabbar (mobile) */}
        <div className="md:hidden w-full">
          <SettingsTabBar
            tabs={tabs}
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            ariaLabel={t("navigation.ariaLabel")}
          />
        </div>
        {/* Main content */}
        <main className="flex-1 flex flex-col items-center md:items-start px-0 md:px-8 py-4">
          <div className="w-full max-w-full md:max-w-4xl lg:max-w-6xl xl:max-w-7xl flex flex-col gap-6">
            <div className="w-full">
              {activeTab === "general" && (
                <GeneralSettings
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
              {activeTab === "reporting" && (
                <ReportingSettings
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
              {activeTab === "ordering" && (
                <OrderingSettings
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
              {activeTab === "people" && (
                <PeopleSettings
                  suppliers={suppliers}
                  handleAddSupplier={handleAddSupplier}
                  handleUpdateSupplier={handleUpdateSupplier}
                  handleDeleteSupplier={handleDeleteSupplier}
                />
              )}
              {activeTab === "stamgegevens" && (
                <StamgegevensSettings
                  categoryList={categoryList}
                  addCategory={handleAddCategory}
                  deleteCategory={handleDeleteCategory}
                  setCategories={setCategories}
                  productCategoryList={productCategoryList}
                  addProductCategory={handleAddProductCategory}
                  deleteProductCategory={handleDeleteProductCategory}
                  setProductCategories={setProductCategories}
                  units={units}
                  handleAddUnit={handleAddUnit}
                  handleDeleteUnit={handleDeleteUnit}
                  locations={locations}
                  handleAddLocation={handleAddLocation}
                  handleDeleteLocation={handleDeleteLocation}
                  salesPromoTypes={salesPromoTypes}
                  handleAddSalesPromoType={handleAddSalesPromoType}
                  handleDeleteSalesPromoType={handleDeleteSalesPromoType}
                  handleUpdateSalesPromoType={handleUpdateSalesPromoType}
                />
              )}
              {activeTab === "synchronisatie" && (
                <SynchronisatieSettings initialTab={syncInitialTab} />
              )}
              {activeTab === "mappings" && (
                <MappingsSettings
                  categoryList={categoryList}
                  productCategoryList={productCategoryList}
                  categoryMappings={categoryMappings}
                  handleAddCategoryMapping={handleAddCategoryMapping}
                  handleUpdateCategoryMapping={handleUpdateCategoryMapping}
                  handleDeleteCategoryMapping={handleDeleteCategoryMapping}
                />
              )}
              {activeTab === "data-upload" && (
                <DataUploadSettings
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
              {activeTab === "transfer" && <TransferDataSettings />}
            </div>
          </div>
        </main>
      </PageContainer>
    </>
  );
}
