import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home,
  Boxes,
  Settings,
  UtensilsCrossed,
  ChefHat,
  BookText,
  BarChart3,
  Users,
  ShoppingCart,
  ArrowLeftRight,
  Warehouse,
  ClipboardList,
  UploadCloud,
  Percent,
  FileText,
  Receipt,
  DollarSign,
  Package,
  Store,
  Link2,
} from "lucide-react";
import { usePermission } from "./usePermission";
import { useHotelContext } from "../contexts/HotelContext";

export function useNavigationSections() {
  const navigate = useNavigate();
  const { t } = useTranslation("hoteldashboard");

  const canViewIngredients = usePermission("ingredients", "view");
  const canViewArticles = usePermission("articles", "view");
  const canViewInventory = usePermission("inventory", "view");
  const canViewStockCounts = usePermission("stockcounts", "view");
  const canViewOrders = usePermission("orders", "view");
  const canViewMancos = usePermission("mancos", "view");
  const canViewRetours = usePermission("retours", "view");
  const canViewTransfers = usePermission("transfers", "view");
  const canViewProducts = usePermission("products", "view");
  const canViewRecipes = usePermission("recipes", "view");
  const canViewSettings = usePermission("settings", "view");
  const canViewPosSync = usePermission("lightspeed", "view");
  const canViewAnalytics = usePermission("analytics", "view");
  const canViewMenuEngineering = usePermission("menuengineering", "view");
  const canViewRevenueCenter = usePermission("revenuecenter", "view");
  const canViewSoldProducts = usePermission("soldproducts", "view");
  const canViewSalesPromo = usePermission("salespromo", "view");
  const canViewSchedule = usePermission("schedule", "view");
  const canViewMaintenanceContracts = usePermission("maintenancecontracts", "view");
  const canViewRebateAgreements = usePermission("rebateagreements", "view");
  const { posProvider = "lightspeed" } = useHotelContext() || {};

  const posNavigationItem = posProvider === "micros"
    ? {
        title: t("microsSyncTitle"),
        icon: UploadCloud,
        onClick: () => navigate("/micros-sync"),
        canView: canViewPosSync,
      }
    : {
        title: t("lightspeedSyncTitle"),
        icon: UploadCloud,
        onClick: () => navigate("/lightspeed-sync"),
        canView: canViewPosSync,
      };

  return [
    {
      title: t("catalogSection"),
      items: [
        { title: t("ingredientsTitle"), icon: Home, onClick: () => navigate("/ingredients"), canView: canViewIngredients },
        { title: t("articlesTitle"), icon: FileText, onClick: () => navigate("/articles"), canView: canViewArticles },
        { title: t("productsTitle"), icon: UtensilsCrossed, onClick: () => navigate("/products"), canView: canViewProducts },
        { type: "label", title: t("catalogSettingsLabel"), canView: canViewSettings },
        {
          title: t("nonLinkedArticlesTitle"),
          icon: Link2,
          onClick: () => navigate("/catalog/non-linked-articles"),
          canView: canViewSettings,
        },
      ],
    },
    {
      title: t("procurementSection"),
      items: [
        { title: t("shoppingListsTitle"), icon: ClipboardList, onClick: () => navigate("/shoppinglists"), canView: canViewOrders },
        { title: t("ordersTitle"), icon: ShoppingCart, onClick: () => navigate("/orders"), canView: canViewOrders },
        { title: t("returnsTitle"), icon: ClipboardList, onClick: () => navigate("/returns"), canView: canViewRetours },
        { title: t("mancosTitle"), icon: Boxes, onClick: () => navigate("/mancos"), canView: canViewMancos },
      ],
    },
    {
      title: t("inventorySection"),
      items: [
        { title: t("inventoryTitle"), icon: Warehouse, onClick: () => navigate("/inventory"), canView: canViewInventory },
        { title: t("stockCountTitle"), icon: ClipboardList, onClick: () => navigate("/stockcount"), canView: canViewStockCounts },
        { title: t("transfersTitle"), icon: ArrowLeftRight, onClick: () => navigate("/transfers"), canView: canViewTransfers },
      ],
    },
    {
      title: t("salesSection"),
      items: [
        { title: t("revenueCenterTitle"), icon: DollarSign, onClick: () => navigate("/revenue-center"), canView: canViewRevenueCenter },
        { title: t("soldProductsTitle"), icon: Package, onClick: () => navigate("/sold-products"), canView: canViewSoldProducts },
        { title: t("salesPromoTitle"), icon: Percent, onClick: () => navigate("/salespromo"), canView: canViewSalesPromo },
        posNavigationItem,
      ],
    },
    {
      title: t("financeSection"),
      items: [
        { title: t("invoicesTitle"), icon: Receipt, onClick: () => navigate("/invoices"), canView: canViewOrders },
        { title: t("rebateAgreementsTitle"), icon: Percent, onClick: () => navigate("/rebate-agreements"), canView: canViewRebateAgreements },
        { title: t("financeStaffTitle"), icon: Users, onClick: () => navigate("/finance/staff"), canView: canViewSettings },
        { title: t("scheduleTitle"), icon: Users, onClick: () => navigate("/schedule"), canView: canViewSchedule },
        { title: t("maintenanceContractsTitle"), icon: ClipboardList, onClick: () => navigate("/maintenance-contracts"), canView: canViewMaintenanceContracts },
      ],
    },
    {
      title: t("menuReportSection"),
      items: [
        { title: t("recipesTitle"), icon: ChefHat, onClick: () => navigate("/recipes"), canView: canViewRecipes },
        { title: t("menuEngineeringTitle"), icon: BookText, onClick: () => navigate("/menu-engineering"), canView: canViewMenuEngineering },
        { title: t("analyticsTitle"), icon: BarChart3, onClick: () => navigate("/analytics"), canView: canViewAnalytics },
      ],
    },
    {
      title: t("settingsSection"),
      items: [
        { title: t("settingsMasterdataTitle"), icon: Settings, onClick: () => navigate("/settings?tab=masterdata"), canView: canViewSettings },
        { title: t("settingsUsersTitle"), icon: Users, onClick: () => navigate("/settings/users"), canView: canViewSettings },
        { title: t("settingsStaffSettingsTitle"), icon: Settings, onClick: () => navigate("/settings/staff-settings"), canView: canViewSettings },
        { title: t("settingsOutletsTitle"), icon: Store, onClick: () => navigate("/settings/outlets"), canView: canViewSettings },
      ],
    },
  ];
}
