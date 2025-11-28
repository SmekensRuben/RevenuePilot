import React, { useCallback, useEffect, useState } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getOutlets, getSalesPromoTypes, getStaff } from "services/firebaseSettings";
import SalesPromoTicketForm from "./SalesPromoTicketForm";
import { useSalesPromo } from "./SalesPromoContext";

export default function SalesPromoTicketPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { t } = useTranslation("salespromo");
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tickets, addTicket, updateTicket, deleteTicket } = useSalesPromo();
  const isNew = ticketId === "new";
  const ticket = tickets.find(t => t.id === ticketId);
  const [outlets, setOutlets] = useState([]);
  const [types, setTypes] = useState([]);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const [outs = [], fetchedTypes = [], fetchedStaff = []] = await Promise.all([
        getOutlets(hotelUid),
        getSalesPromoTypes(hotelUid),
        getStaff(),
      ]);
      setOutlets(outs || []);
      setTypes(fetchedTypes || []);
      setStaff(fetchedStaff || []);
    }
    if (hotelUid) fetchData();
  }, [hotelUid]);

  const navigateBackToList = useCallback(() => {
    const from = location.state?.from;
    if (typeof from === "string") {
      navigate(from);
      return;
    }
    if (from?.pathname) {
      navigate(
        {
          pathname: from.pathname,
          search: from.search || "",
          hash: from.hash || "",
        },
        { state: from.state }
      );
      return;
    }
    navigate("/salespromo");
  }, [location.state, navigate]);

  const handleSave = async data => {
    if (isNew) {
      await addTicket(data);
    } else {
      await updateTicket(ticketId, data);
    }
    navigateBackToList();
  };

  const handleDelete = async () => {
    await deleteTicket(ticketId);
    navigateBackToList();
  };

  if (!isNew && !ticket) {
    return (
      <PageContainer>
        <div className="text-center text-gray-500">Ticket not found</div>
      </PageContainer>
    );
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer className="max-w-4xl">
        <button
          onClick={navigateBackToList}
          className="mb-4 text-sm text-marriott"
        >
          &larr; {t("back")}
        </button>
        <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
        <SalesPromoTicketForm
          outlets={outlets}
          types={types}
          staff={staff}
          onSave={handleSave}
          onDelete={!isNew ? handleDelete : undefined}
          initialData={ticket}
        />
      </PageContainer>
    </>
  );
}

