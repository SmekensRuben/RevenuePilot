import { Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./components/pages/LandingPage.jsx";
import LoginPage from "./components/pages/LoginPage.jsx";
import DashboardPage from "./components/pages/DashboardPage.jsx";
import MadeReservationsPage from "./components/pages/MadeReservationsPage.jsx";
import SegmentationMappingPage from "./components/pages/SegmentationMappingPage.jsx";
import MarketSegmentDetailPage from "./components/pages/MarketSegmentDetailPage.jsx";
import SubSegmentDetailPage from "./components/pages/SubSegmentDetailPage.jsx";
import ProtectedRoute from "./components/shared/ProtectedRoute.jsx";

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
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
