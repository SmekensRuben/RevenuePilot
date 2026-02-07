import { Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./components/pages/LandingPage.jsx";
import LoginPage from "./components/pages/LoginPage.jsx";
import DashboardPage from "./components/pages/DashboardPage.jsx";
import MadeReservationsPage from "./components/pages/MadeReservationsPage.jsx";
import InventoryBalancerPage from "./components/pages/InventoryBalancerPage.jsx";
import SegmentationMappingPage from "./components/pages/SegmentationMappingPage.jsx";
import MarketSegmentDetailPage from "./components/pages/MarketSegmentDetailPage.jsx";
import SubSegmentDetailPage from "./components/pages/SubSegmentDetailPage.jsx";
import LocalCalendarPage from "./components/pages/LocalCalendarPage.jsx";
import LocalEventDetailPage from "./components/pages/LocalEventDetailPage.jsx";
import ForecastPage from "./components/pages/ForecastPage.jsx";
import WeeklyForecastToolPage from "./components/pages/WeeklyForecastToolPage.jsx";
import HistoricalForecastPacePage from "./components/pages/HistoricalForecastPacePage.jsx";
import ProtectedRoute from "./components/shared/ProtectedRoute.jsx";
import CompsetPage from "./components/pages/CompsetPage.jsx";
import ArrivalConverterPage from "./components/pages/ArrivalConverterPage.jsx";
import ArrivalConverterProductDetailPage from "./components/pages/ArrivalConverterProductDetailPage.jsx";
import QuotesPage from "./components/pages/QuotesPage.jsx";
import QuoteCreatePage from "./components/pages/QuoteCreatePage.jsx";
import QuoteEditPage from "./components/pages/QuoteEditPage.jsx";
import AutoquoterPage from "./components/pages/AutoquoterPage.jsx";
import RoomTypesPage from "./components/pages/RoomTypesPage.jsx";
import RoomTypeCreatePage from "./components/pages/RoomTypeCreatePage.jsx";
import RoomTypeEditPage from "./components/pages/RoomTypeEditPage.jsx";
import RoomClassesPage from "./components/pages/RoomClassesPage.jsx";
import RoomClassCreatePage from "./components/pages/RoomClassCreatePage.jsx";
import RoomClassEditPage from "./components/pages/RoomClassEditPage.jsx";
import GeneralSettingsPage from "./components/pages/GeneralSettingsPage.jsx";
import EditWebsitePage from "./components/pages/EditWebsitePage.jsx";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservations/made"
        element={
          <ProtectedRoute>
            <MadeReservationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservations/inventory-balancer"
        element={
          <ProtectedRoute>
            <InventoryBalancerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/segmentation-mapping"
        element={
          <ProtectedRoute>
            <SegmentationMappingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/general"
        element={
          <ProtectedRoute>
            <GeneralSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/edit-website"
        element={
          <ProtectedRoute>
            <EditWebsitePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/compset"
        element={
          <ProtectedRoute>
            <CompsetPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/segmentation-mapping/market-segments/:segmentId"
        element={
          <ProtectedRoute>
            <MarketSegmentDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/segmentation-mapping/sub-segments/:subSegmentId"
        element={
          <ProtectedRoute>
            <SubSegmentDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar/local"
        element={
          <ProtectedRoute>
            <LocalCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar/local/:eventId"
        element={
          <ProtectedRoute>
            <LocalEventDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forecast"
        element={
          <ProtectedRoute>
            <ForecastPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forecast/weekly"
        element={
          <ProtectedRoute>
            <WeeklyForecastToolPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forecast/historical-pace"
        element={
          <ProtectedRoute>
            <HistoricalForecastPacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tools/arrival-converter"
        element={
          <ProtectedRoute>
            <ArrivalConverterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tools/arrival-converter/product/:productName"
        element={
          <ProtectedRoute>
            <ArrivalConverterProductDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotes"
        element={
          <ProtectedRoute>
            <QuotesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotes/new"
        element={
          <ProtectedRoute>
            <QuoteCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotes/:quoteId"
        element={
          <ProtectedRoute>
            <QuoteEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotes/autoquoter"
        element={
          <ProtectedRoute>
            <AutoquoterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/room-types"
        element={
          <ProtectedRoute>
            <RoomTypesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/room-types/new"
        element={
          <ProtectedRoute>
            <RoomTypeCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/room-types/:roomTypeId"
        element={
          <ProtectedRoute>
            <RoomTypeEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/room-classes"
        element={
          <ProtectedRoute>
            <RoomClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/room-classes/new"
        element={
          <ProtectedRoute>
            <RoomClassCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/room-classes/:roomClassId"
        element={
          <ProtectedRoute>
            <RoomClassEditPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
