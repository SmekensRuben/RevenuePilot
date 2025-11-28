import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// Directe imports van pagina's
import LandingPage from "./components/pages/LandingPage.jsx";
import LoginPage from "./components/pages/LoginPage.jsx";

import ProtectedRoute from "./components/shared/ProtectedRoute.jsx";
import IngredientsPage from "./features/ingredients/IngredientsPage.jsx";
import ArticlesPage from "./features/articles/ArticlesPage.jsx";
import ArticleDetailsPage from "./features/articles/ArticleDetailsPage.jsx";
import NonLinkedArticlesPage from "./features/articles/NonLinkedArticlesPage.jsx";
import HotelDashboard from "./features/dashboard/HotelDashboard.jsx";
import SettingsPage from "./features/settings/SettingsPage.jsx";
import UserManagementPage from "./features/settings/users/UserManagementPage.jsx";
import OutletListPage from "./features/settings/outlets/OutletListPage.jsx";
import OutletDetailPage from "./features/settings/outlets/OutletDetailPage.jsx";
import OrdersPage from "./features/orders/OrdersPage.jsx";
import NewOrderPage from "./features/orders/NewOrderPage.jsx";
import EditOrderPage from "./features/orders/EditOrderPage.jsx";
import InventoryPage from "./features/inventory/InventoryPage.jsx";
import ReceiveOrderPage from "./features/orders/ReceiveOrderPage.jsx";
import OrderDetailsPage from "./features/orders/OrderDetailsPage.jsx";
import InvoicesPage from "./features/invoices/InvoicesPage.jsx";
import StockCountDashboardPage from "./features/stockcount/StockCountDashboardPage.jsx";
import StockCountLocationPage from "./features/stockcount/StockCountLocationPage.jsx";
import StockCountReportPage from "./features/stockcount/StockCountReportPage.jsx";
import ProductsPage from "./features/products/ProductsPage.jsx";
import ProductDetailsPage from "./features/products/ProductDetailsPage.jsx";
import ProductEditPage from "./features/products/ProductEditPage.jsx";
import RecipesPage from "./features/recipes/RecipesPage.jsx";
import MancoPage from "./features/manco/MancoPage.jsx";
import LightspeedSyncPage from "./features/lightspeed/LightspeedSyncPage.jsx";
import MicrosSyncPage from "./features/micros/MicrosSyncPage.jsx";
import ReturnsPage from "./features/returns/ReturnsPage.jsx";
import NewReturnPage from "./features/returns/NewReturnPage.jsx";
import MenuEngineeringPage from "./features/menuengineering/MenuEngineeringPage.jsx";
import SalesPromoPage from "./features/salespromo/SalesPromoPage.jsx";
import SalesPromoTicketPage from "./features/salespromo/SalesPromoTicketPage.jsx";
import SalesPromoReconciliationDayPage from "./features/salespromo/SalesPromoReconciliationDayPage.jsx";
import RevenueCenterPage from "./features/revenuecenter/RevenueCenterPage.jsx";
import SoldProductsPage from "./features/soldproducts/SoldProductsPage.jsx";
import TransfersPage from "./features/transfers/TransfersPage.jsx";
import NewTransferPage from "./features/transfers/NewTransferPage.jsx";
import TransferDetailsPage from "./features/transfers/TransferDetailsPage.jsx";
import ReceiveTransferPage from "./features/transfers/ReceiveTransferPage.jsx";
import ShoppingListsPage from "./features/shoppinglists/ShoppingListsPage.jsx";
import ShoppingListOrderPage from "./features/shoppinglists/ShoppingListOrderPage.jsx";
import AnalyticsPage from "./features/analytics/AnalyticsPage.jsx";
import SchedulePage from "./features/schedule/SchedulePage.jsx";
import MaintenanceContractsPage from "./features/maintenancecontracts/MaintenanceContractsPage.jsx";
import RebateAgreementsPage from "./features/rebateagreements/RebateAgreementsPage.jsx";
import RebateAgreementDetailPage from "./features/rebateagreements/RebateAgreementDetailPage.jsx";
import StaffSettingsPage from "./features/settings/staff/StaffSettingsPage.jsx";
import StaffMemberDetailPage from "./features/settings/staff/StaffMemberDetailPage.jsx";
import StaffContractSettingsPage from "./features/settings/staff/StaffContractSettingsPage.jsx";


export default function AppRouter() {
  const location = useLocation();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <HotelDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ingredients"
        element={
          <ProtectedRoute feature="ingredients">
            <IngredientsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/articles"
        element={
          <ProtectedRoute feature="articles">
            <ArticlesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/articles/:articleId"
        element={
          <ProtectedRoute feature="articles">
            <ArticleDetailsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalog/non-linked-articles"
        element={
          <ProtectedRoute feature="settings">
            <NonLinkedArticlesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders"
        element={
          <ProtectedRoute feature="orders">
            <OrdersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/invoices"
        element={
          <ProtectedRoute feature="orders">
            <InvoicesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/neworder"
        element={
          <ProtectedRoute feature="orders" action="create">
            <NewOrderPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/:orderId/edit"
        element={
          <ProtectedRoute feature="orders">
            <EditOrderPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/:orderId/receive"
        element={
          <ProtectedRoute feature="orders">
            <ReceiveOrderPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/:orderId"
        element={
          <ProtectedRoute feature="orders">
            <OrderDetailsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute feature="inventory">
            <InventoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stockcount"
        element={
          <ProtectedRoute feature="stockcounts">
            <StockCountDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={
          <ProtectedRoute feature="products">
            <ProductsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products/new"
        element={
          <ProtectedRoute feature="products">
            <ProductEditPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products/:productId"
        element={
          <ProtectedRoute feature="products">
            <ProductDetailsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products/:productId/edit"
        element={
          <ProtectedRoute feature="products">
            <ProductEditPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/recipes"
        element={
          <ProtectedRoute feature="recipes">
            <RecipesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/menu-engineering"
        element={
          <ProtectedRoute feature="menuengineering">
            <MenuEngineeringPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute feature="analytics">
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/revenue-center"
        element={
          <ProtectedRoute feature="revenuecenter">
            <RevenueCenterPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sold-products"
        element={
          <ProtectedRoute feature="soldproducts">
            <SoldProductsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute feature="schedule">
            <SchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance-contracts"
        element={
          <ProtectedRoute feature="maintenancecontracts">
            <MaintenanceContractsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rebate-agreements"
        element={
          <ProtectedRoute feature="rebateagreements">
            <RebateAgreementsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rebate-agreements/new"
        element={
          <ProtectedRoute feature="rebateagreements">
            <RebateAgreementDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rebate-agreements/:agreementId"
        element={
          <ProtectedRoute feature="rebateagreements">
            <RebateAgreementDetailPage />
          </ProtectedRoute>
        }
      />


      <Route
        path="/mancos"
        element={
          <ProtectedRoute feature="mancos">
            <MancoPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/lightspeed-sync"
        element={
          <ProtectedRoute feature="lightspeed">
            <LightspeedSyncPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/micros-sync"
        element={
          <ProtectedRoute feature="lightspeed">
            <MicrosSyncPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/salespromo"
        element={
          <ProtectedRoute feature="salespromo">
            <SalesPromoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salespromo/reconciliation/:day"
        element={
          <ProtectedRoute feature="salespromo">
            <SalesPromoReconciliationDayPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salespromo/:ticketId"
        element={
          <ProtectedRoute feature="salespromo">
            <SalesPromoTicketPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/returns"
        element={
          <ProtectedRoute feature="retours">
            <ReturnsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/newreturn"
        element={
          <ProtectedRoute feature="retours" action="create">
            <NewReturnPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/transfers"
        element={
          <ProtectedRoute feature="transfers">
            <TransfersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/newtransfer"
        element={
          <ProtectedRoute feature="transfers">
            <NewTransferPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/transfers/:transferId"
        element={
          <ProtectedRoute feature="transfers">
            <TransferDetailsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/transfers/:transferId/receive"
        element={
          <ProtectedRoute feature="transfers">
            <ReceiveTransferPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stockcount/location/:locationId" element={
          <ProtectedRoute feature="stockcounts">
            <StockCountLocationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stockcount/report/:tellingId" element={
          <ProtectedRoute feature="stockcounts">
            <StockCountReportPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/shoppinglists"
        element={
          <ProtectedRoute>
            <ShoppingListsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/shoppinglists/:listId"
        element={
          <ProtectedRoute>
            <ShoppingListOrderPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute feature="settings">
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/outlets"
        element={
          <ProtectedRoute feature="settings">
            <OutletListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/outlets/:outletId"
        element={
          <ProtectedRoute feature="settings">
            <OutletDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/users"
        element={
          <ProtectedRoute feature="userManagement">
            <UserManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance/staff"
        element={
          <ProtectedRoute feature="settings">
            <StaffSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance/staff/:staffId"
        element={
          <ProtectedRoute feature="settings">
            <StaffMemberDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/staff-settings"
        element={
          <ProtectedRoute feature="settings">
            <StaffContractSettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback: alle onbekende routes redirecten naar login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
