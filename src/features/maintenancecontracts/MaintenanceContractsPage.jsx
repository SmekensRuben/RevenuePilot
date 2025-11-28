import React from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { usePermission } from "../../hooks/usePermission";

export default function MaintenanceContractsPage() {
  const { hotelName } = useHotelContext();
  const { t } = useTranslation("hoteldashboard");
  const canView = usePermission("maintenancecontracts", "view");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/login";
  };

  if (!canView) return <div>{t("noAccessModule")}</div>;

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">{t("maintenanceContractsTitle")}</h1>
        <p className="text-gray-600">{t("maintenanceContractsSubtitle")}</p>
      </PageContainer>
    </>
  );
}
