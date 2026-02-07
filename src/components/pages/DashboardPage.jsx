import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { getSettings } from "../../services/firebaseSettings";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";

export default function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const { hotelName, hotelUid, roles } = useHotelContext();
  const [websiteIntroTitle, setWebsiteIntroTitle] = useState("");
  const [websiteIntroText, setWebsiteIntroText] = useState("");

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!hotelUid) return;
    const loadWebsiteIntro = async () => {
      const settings = await getSettings(hotelUid);
      setWebsiteIntroTitle(settings?.websiteIntroTitle ?? "");
      setWebsiteIntroText(settings?.websiteIntroText ?? "");
    };
    loadWebsiteIntro();
  }, [hotelUid]);

  const introTitle = websiteIntroTitle.trim() || t("title", { hotel: hotelName });
  const introText = websiteIntroText.trim() || t("intro");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={today} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <Card className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">
            {t("welcomeLabel")}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold">{introTitle}</h1>
          <p className="text-gray-600 max-w-3xl">{introText}</p>
          {hotelUid && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
              <span className="font-semibold text-[#b41f1f]">{t("activeHotel")}</span>
              <span className="font-mono">{hotelUid}</span>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h2 className="text-lg font-semibold mb-2">{t("rolesTitle")}</h2>
            <p className="text-gray-600 mb-3">{t("rolesBody")}</p>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(roles) && roles.length > 0 ? (
                roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-[#b41f1f] bg-opacity-10 text-[#b41f1f] px-3 py-1 text-sm font-semibold"
                  >
                    {role}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">{t("noRoles")}</span>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-2">{t("nextStepsTitle")}</h2>
            <ul className="space-y-2 text-gray-700 list-disc list-inside">
              <li>{t("nextSteps.clean")}</li>
              <li>{t("nextSteps.login")}</li>
              <li>{t("nextSteps.properties")}</li>
            </ul>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
