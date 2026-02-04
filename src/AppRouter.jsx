import { Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./components/pages/LandingPage.jsx";
import LoginPage from "./components/pages/LoginPage.jsx";
import DashboardPage from "./components/pages/DashboardPage.jsx";
import MadeReservationsPage from "./components/pages/MadeReservationsPage.jsx";
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
import RoomTypesPage from "./components/pages/RoomTypesPage.jsx";
import RoomTypeCreatePage from "./components/pages/RoomTypeCreatePage.jsx";
import RoomTypeEditPage from "./components/pages/RoomTypeEditPage.jsx";

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
        path="/settings/segmentation-mapping"
        element={
          <ProtectedRoute>
            <SegmentationMappingPage />
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
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
