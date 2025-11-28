import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import StaffSettings from "../sections/StaffSettings";
import { useHotelContext } from "contexts/HotelContext";
import { getSettings, getStaff, addStaffMember, getStaffContractTypes } from "services/firebaseSettings";
import { getSalesPromoTickets } from "services/firebaseSalesPromo";
import { getSelectedHotelUid } from "utils/hotelUtils";
import { useTranslation } from "react-i18next";

export default function StaffSettingsPage() {
  const { hotelName: hotelContextName, language } = useHotelContext?.() || {};
  const hotelUid = getSelectedHotelUid();
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

  const [settings, setSettingsState] = useState({});
  useEffect(() => {
    getSettings(hotelUid).then(setSettingsState);
  }, [hotelUid]);

  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const [staff, setStaff] = useState([]);
  const [salesPromoTickets, setSalesPromoTickets] = useState([]);
  const [contractTypes, setContractTypes] = useState([]);
  useEffect(() => {
    getStaff().then(setStaff);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!hotelUid) return undefined;
    (async () => {
      try {
        const tickets = await getSalesPromoTickets(hotelUid);
        if (isMounted) {
          setSalesPromoTickets(Array.isArray(tickets) ? tickets : []);
        }
      } catch (error) {
        console.error("Failed to load sales & promo tickets", error);
        if (isMounted) {
          setSalesPromoTickets([]);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [hotelUid]);

  useEffect(() => {
    let isMounted = true;
    if (!hotelUid) {
      setContractTypes([]);
      return undefined;
    }
    (async () => {
      try {
        const types = await getStaffContractTypes(hotelUid);
        if (isMounted) {
          setContractTypes(types);
        }
      } catch (error) {
        console.error("Failed to load staff contract types", error);
        if (isMounted) {
          setContractTypes([]);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [hotelUid]);

  const refreshStaff = async () => {
    setStaff(await getStaff());
  };

  const handleAddStaff = async memberObj => {
    await addStaffMember(memberObj);
    await refreshStaff();
  };

  return (
    <>
      <HeaderBar
        hotelName={settings.hotelName || hotelContextName}
        today={today}
        onLogout={handleLogout}
      />
      <PageContainer className="flex-1 bg-gray-50 min-h-screen">
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
          <StaffSettings
            staff={staff}
            salesPromoTickets={salesPromoTickets}
            handleAddStaff={handleAddStaff}
            contractTypes={contractTypes}
          />
        </main>
      </PageContainer>
    </>
  );
}
