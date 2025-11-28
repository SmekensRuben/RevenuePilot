import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  getLightspeedNegativeTicketTotal,
  getSalesPromoReconciliation,
  getLightspeedReceiptDetails,
  setSalesPromoReconciliation,
} from "services/firebaseSalesPromo";
import { useSalesPromo } from "./SalesPromoContext";
import { parseLightspeedDateTime } from "../lightspeed/lightspeedHelpers";

export default function SalesPromoReconciliationDayPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { t } = useTranslation("salespromo");
  const navigate = useNavigate();
  const { day } = useParams();
  const { tickets } = useSalesPromo();

  const [lightspeedAmount, setLightspeedAmount] = useState();
  const [lightspeedTickets, setLightspeedTickets] = useState([]);
  const [loadingLightspeed, setLoadingLightspeed] = useState(true);
  const [refreshingLightspeed, setRefreshingLightspeed] = useState(false);
  const [lightspeedError, setLightspeedError] = useState(false);
  const [selectedLightspeedTicket, setSelectedLightspeedTicket] = useState(null);
  const [loadingOriginalReceipt, setLoadingOriginalReceipt] = useState(false);
  const [originalReceiptError, setOriginalReceiptError] = useState(false);

  const filteredTickets = useMemo(
    () => tickets.filter(ticket => ticket.date === day && !ticket.notInPos),
    [tickets, day]
  );

  const sumTicketAmounts = useCallback(ticket => {
    return (ticket.subOutlets || []).reduce((total, subOutlet) => {
      const amount = parseFloat(subOutlet.amount || 0);
      return total + (Number.isNaN(amount) ? 0 : amount);
    }, 0);
  }, []);

  const manualTotal = useMemo(
    () => filteredTickets.reduce((total, ticket) => total + sumTicketAmounts(ticket), 0),
    [filteredTickets, sumTicketAmounts]
  );

  const manualTicketLookup = useMemo(() => {
    const map = new Map();
    filteredTickets.forEach(ticket => {
      const total = sumTicketAmounts(ticket);
      const liteserverId = `${ticket?.liteserverId || ""}`.trim();
      const receiptNumber = `${ticket?.receiptNumber || ""}`.trim();
      const lookupValue = { amount: total, ticketId: ticket.id };

      if (liteserverId && !map.has(liteserverId)) {
        map.set(liteserverId, lookupValue);
      }

      if (receiptNumber && !map.has(receiptNumber)) {
        map.set(receiptNumber, lookupValue);
      }
    });
    return map;
  }, [filteredTickets, sumTicketAmounts]);

  const matchedManualTicketIds = useMemo(() => {
    const matchedIds = new Set();
    (lightspeedTickets || []).forEach(ticket => {
      const liteserverId = `${ticket?.liteserverId || ""}`.trim();
      const ticketNumber = `${ticket?.ticketNumber || ""}`.trim();
      const lookupId = liteserverId || ticketNumber;
      if (!lookupId) return;
      const lookupEntry = manualTicketLookup.get(lookupId);
      if (lookupEntry?.ticketId) {
        matchedIds.add(lookupEntry.ticketId);
      }
    });
    return matchedIds;
  }, [lightspeedTickets, manualTicketLookup]);

  const manualTicketsNotInLightspeed = useMemo(
    () =>
      filteredTickets.filter(ticket => {
        if (!ticket) return false;
        return !matchedManualTicketIds.has(ticket.id);
      }),
    [filteredTickets, matchedManualTicketIds]
  );

  const lightspeedTicketsWithRegistration = useMemo(
    () =>
      (lightspeedTickets || []).map(ticket => {
        const liteserverId = `${ticket?.liteserverId || ""}`.trim();
        const ticketNumber = `${ticket?.ticketNumber || ""}`.trim();
        const lookupId = liteserverId || ticketNumber;
        const lookupEntry = lookupId ? manualTicketLookup.get(lookupId) : undefined;
        const registeredAmount = lookupEntry?.amount;
        const baseRegistered =
          typeof registeredAmount === "number" ? registeredAmount : 0;
        const difference =
          typeof ticket?.amount === "number"
            ? Math.abs(ticket.amount) - baseRegistered
            : undefined;

        const resolvedTicketNumber = lookupId || ticketNumber;

        return {
          ...ticket,
          liteserverId: liteserverId || undefined,
          ticketNumber: resolvedTicketNumber,
          registeredAmount,
          difference,
          manualTicketId: lookupEntry?.ticketId,
        };
      }),
    [lightspeedTickets, manualTicketLookup]
  );

  const normalizedLightspeedAmount = useMemo(() => {
    if (typeof lightspeedAmount !== "number") {
      return undefined;
    }
    return Math.abs(lightspeedAmount);
  }, [lightspeedAmount]);

  const difference = useMemo(() => {
    if (typeof normalizedLightspeedAmount !== "number") {
      return undefined;
    }
    return normalizedLightspeedAmount - manualTotal;
  }, [normalizedLightspeedAmount, manualTotal]);

  const summaryRowClass = useMemo(() => {
    if (typeof difference !== "number") {
      return "";
    }
    return Math.abs(difference) < 0.5 ? "bg-green-50" : "bg-red-50";
  }, [difference]);

  const summaryDifferenceTextClass = useMemo(() => {
    if (typeof difference !== "number") {
      return "text-gray-700";
    }
    return Math.abs(difference) < 0.5 ? "text-green-700" : "text-red-700";
  }, [difference]);

  const handleOpenTicket = useCallback(
    ticketId => {
      if (!ticketId) return;
      navigate(`/salespromo/${ticketId}`, {
        state: { from: `/salespromo/reconciliation/${day}` },
      });
    },
    [navigate, day]
  );

  const handleShowOriginalTicket = useCallback(
    async ticket => {
      if (!ticket) return;

      setOriginalReceiptError(false);

      if (ticket.receiptDetails || !hotelUid || !day) {
        setLoadingOriginalReceipt(false);
        setSelectedLightspeedTicket(ticket);
        return;
      }

      const identifiers = {
        receiptDocId: ticket.receiptDocId,
        liteserverId: ticket.liteserverId,
        ticketNumber: ticket.ticketNumber,
      };

      const matchesIdentifiers = candidate => {
        if (!candidate) return false;
        const normalize = value => `${value || ""}`.trim();
        const candidateReceiptDocId = normalize(candidate.receiptDocId);
        const candidateLiteserverId = normalize(candidate.liteserverId);
        const candidateTicketNumber = normalize(candidate.ticketNumber);

        const identifierReceiptDocId = normalize(identifiers.receiptDocId);
        const identifierLiteserverId = normalize(identifiers.liteserverId);
        const identifierTicketNumber = normalize(identifiers.ticketNumber);

        if (identifierReceiptDocId && identifierReceiptDocId === candidateReceiptDocId) {
          return true;
        }
        if (identifierLiteserverId && identifierLiteserverId === candidateLiteserverId) {
          return true;
        }
        if (identifierTicketNumber && identifierTicketNumber === candidateTicketNumber) {
          return true;
        }
        return false;
      };

      setSelectedLightspeedTicket(ticket);
      setLoadingOriginalReceipt(true);
      try {
        const receiptDetails = await getLightspeedReceiptDetails(hotelUid, day, identifiers);
        if (receiptDetails) {
          setOriginalReceiptError(false);
          setLightspeedTickets(prevTickets =>
            (prevTickets || []).map(existing =>
              matchesIdentifiers(existing) ? { ...existing, receiptDetails } : existing
            )
          );
          setSelectedLightspeedTicket(prevTicket =>
            matchesIdentifiers(prevTicket) ? { ...prevTicket, receiptDetails } : prevTicket
          );
        } else {
          setOriginalReceiptError(true);
        }
      } catch (error) {
        console.error("Failed to load Lightspeed receipt details", error);
        setOriginalReceiptError(true);
      } finally {
        setLoadingOriginalReceipt(false);
      }
    },
    [hotelUid, day]
  );

  const handleCloseOriginalTicket = useCallback(() => {
    setSelectedLightspeedTicket(null);
    setLoadingOriginalReceipt(false);
    setOriginalReceiptError(false);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadLightspeedData() {
      if (!hotelUid || !day) return;
      setLoadingLightspeed(true);
      setLightspeedError(false);
      setLightspeedAmount(undefined);
      setLightspeedTickets([]);
      try {
        const reconciliation = await getSalesPromoReconciliation(hotelUid);
        if (isCancelled) return;
        if (Array.isArray(reconciliation)) {
          const entry = reconciliation.find(item => item?.day === day);
          if (entry) {
            if (typeof entry.lightspeedAmount === "number") {
              setLightspeedAmount(entry.lightspeedAmount);
            } else {
              setLightspeedAmount(undefined);
            }
            if (Array.isArray(entry.lightspeedTickets)) {
              setLightspeedTickets(entry.lightspeedTickets);
            } else {
              setLightspeedTickets([]);
            }
          } else {
            setLightspeedAmount(undefined);
            setLightspeedTickets([]);
          }
        } else {
          setLightspeedAmount(undefined);
          setLightspeedTickets([]);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to load Lightspeed reconciliation", error);
          setLightspeedError(true);
        }
      } finally {
        if (!isCancelled) {
          setLoadingLightspeed(false);
        }
      }
    }

    loadLightspeedData();

    return () => {
      isCancelled = true;
    };
  }, [hotelUid, day]);

  const handleRefreshLightspeed = async () => {
    if (!hotelUid || !day) return;
    setRefreshingLightspeed(true);
    setLightspeedError(false);
    try {
      const { total, tickets: refreshedTickets } = await getLightspeedNegativeTicketTotal(
        hotelUid,
        day
      );
      setLightspeedAmount(total);
      setLightspeedTickets(refreshedTickets || []);
      await setSalesPromoReconciliation(hotelUid, day, {
        lightspeedAmount: total,
        lightspeedTickets: refreshedTickets || [],
      });
    } catch (error) {
      console.error("Failed to refresh Lightspeed amount", error);
      setLightspeedError(true);
    } finally {
      setRefreshingLightspeed(false);
    }
  };

  const formatCurrency = value => `€ ${Number(value || 0).toFixed(2)}`;

  const parseReceiptDateTime = value => {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "object") {
      if (typeof value.toDate === "function") {
        const date = value.toDate();
        if (date instanceof Date && !Number.isNaN(date.getTime())) {
          return date;
        }
      }

      const secondsValue =
        typeof value.seconds === "number"
          ? value.seconds
          : typeof value._seconds === "number"
          ? value._seconds
          : undefined;

      if (typeof secondsValue === "number") {
        const milliseconds = secondsValue * 1000 + (value.nanoseconds || value._nanoseconds || 0) / 1e6;
        const date = new Date(milliseconds);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }

    if (typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const stringValue = `${value}`.trim();
    if (!stringValue) {
      return null;
    }

    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(stringValue)) {
      const normalizedString = stringValue.replace(/[.]/g, "/");
      const parsed = parseLightspeedDateTime(normalizedString);
      if (parsed?.date && !Number.isNaN(parsed.date.getTime())) {
        return parsed.date;
      }
    }

    const date = new Date(stringValue);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }

    return null;
  };

  const formatDateTime = value => {
    if (!value) return "–";
    const parsed = parseReceiptDateTime(value);
    if (!parsed) {
      return typeof value === "string" ? value : "–";
    }
    return parsed.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const formatQuantity = value => {
    if (value === null || value === undefined || value === "") {
      return "–";
    }
    if (typeof value === "number") {
      return Number.isInteger(value)
        ? value.toString()
        : value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Number.isInteger(parsed)
        ? parsed.toString()
        : parsed.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
    }
    return `${value}`;
  };

  const handleBack = () => {
    navigate("/salespromo", { state: { initialTab: "reconciliation" } });
  };

  const selectedReceiptDetails = selectedLightspeedTicket?.receiptDetails;
  const selectedReceiptProducts = selectedReceiptDetails?.products || [];
  const selectedReceiptId =
    selectedReceiptDetails?.receiptId ||
    selectedLightspeedTicket?.ticketNumber ||
    selectedLightspeedTicket?.liteserverId ||
    "";

  if (!day) {
    return (
      <>
        <HeaderBar hotelName={hotelName} />
        <PageContainer>
          <div className="text-center text-gray-500">{t("comparisonNoData")}</div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer>
        <button onClick={handleBack} className="mb-4 text-sm text-marriott">
          &larr; {t("comparisonBackToOverview", "Back to daily reconciliation")}
        </button>
        <h1 className="text-2xl font-bold mb-1">
          {t("comparisonDetailTitle", { day })}
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          {t("comparisonDetailDescription", "Overview of the Sales & Promo tickets and Lightspeed totals for this day.")}
        </p>

        <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold">{t("comparisonSummaryTitle", "Summary")}</h2>
            <div className="flex items-center gap-3">
              {lightspeedError && (
                <span className="text-sm text-red-500">{t("comparisonError")}</span>
              )}
              <button
                type="button"
                onClick={handleRefreshLightspeed}
                disabled={refreshingLightspeed}
                className="inline-flex items-center gap-2 rounded border border-marriott px-3 py-1 text-marriott hover:bg-marriott hover:text-white disabled:opacity-60"
              >
                {refreshingLightspeed ? t("loading") : t("comparisonRefresh")}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t("date")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t("comparisonRegistered")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t("comparisonLightspeed")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t("comparisonDifference", "Difference")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr className={summaryRowClass}>
                  <td className="px-4 py-3 text-sm text-gray-700">{day}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">
                    {formatCurrency(manualTotal)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">
                    {loadingLightspeed
                      ? t("loading")
                      : typeof normalizedLightspeedAmount === "number"
                      ? formatCurrency(normalizedLightspeedAmount)
                      : "–"}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${summaryDifferenceTextClass}`}>
                    {typeof difference === "number" ? formatCurrency(difference) : "–"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">
            {t("comparisonModalTitle", "Lightspeed tickets")}
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow">
            {loadingLightspeed ? (
              <div className="px-4 py-6 text-sm text-gray-500">{t("loading")}</div>
            ) : lightspeedTicketsWithRegistration.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                {t(
                  "comparisonModalNoTickets",
                  "No Lightspeed tickets with a negative amount were found for this day."
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {t("comparisonModalTicket", "Ticket number")}
                    </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t("comparisonModalAmount", "Negative amount")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t("comparisonRegistered", "Amount registered")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t("comparisonDifference", "Difference")}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t("comparisonShowOriginal", "Show original")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {lightspeedTicketsWithRegistration.map((ticket, index) => {
                  const differenceValue = ticket?.difference;
                    const isAcceptableDifference =
                      typeof differenceValue === "number" && Math.abs(differenceValue) < 0.2;
                    const rowClass = isAcceptableDifference
                      ? "bg-green-50"
                      : typeof differenceValue === "number"
                      ? "bg-red-50"
                      : "";
                    const isClickable = !!ticket.manualTicketId;
                    const hoverClass = isAcceptableDifference
                      ? "hover:bg-green-100"
                      : typeof differenceValue === "number"
                      ? "hover:bg-red-100"
                      : "hover:bg-gray-50";
                    const rowClassName = [
                      rowClass,
                      isClickable ? `cursor-pointer ${hoverClass}` : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <tr
                        key={`${ticket.ticketNumber || "ticket"}-${index}`}
                        className={rowClassName}
                        onClick={() => {
                          if (ticket.manualTicketId) {
                            handleOpenTicket(ticket.manualTicketId);
                          }
                        }}
                      >
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {ticket.ticketNumber || "–"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 text-right">
                          {formatCurrency(Math.abs(ticket.amount ?? 0))}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 text-right">
                          {typeof ticket.registeredAmount === "number"
                            ? formatCurrency(ticket.registeredAmount)
                            : "–"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 text-right">
                          {typeof differenceValue === "number"
                            ? formatCurrency(differenceValue)
                            : "–"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              handleShowOriginalTicket(ticket);
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-marriott px-3 py-1 text-xs font-semibold text-marriott transition-colors hover:bg-marriott hover:text-white"
                          >
                            {t("comparisonShowOriginal", "Show original")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">
            {t(
              "comparisonManualMissingTitle",
              "Manual tickets not in Lightspeed"
            )}
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            {t(
              "comparisonManualMissingDescription",
              "Sales & Promo tickets that were entered manually but do not appear in Lightspeed for this day."
            )}
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow">
            {manualTicketsNotInLightspeed.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                {t(
                  "comparisonManualMissingEmpty",
                  "No manually entered tickets without a Lightspeed match were found for this day."
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {t("comparisonModalTicket", "Ticket number")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {t("cashier", "Cashier")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {t("type", "Type")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {t("outlet", "Outlet")}
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {t("comparisonRegistered", "Amount registered")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {manualTicketsNotInLightspeed.map(ticket => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleOpenTicket(ticket.id)}
                    >
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {ticket.receiptNumber || "–"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {ticket.cashier || "–"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {ticket.type || "–"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {ticket.outlet || "–"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 text-right">
                        {formatCurrency(sumTicketAmounts(ticket))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </PageContainer>

      {selectedLightspeedTicket && (
        <Dialog
          open={!!selectedLightspeedTicket}
          onClose={handleCloseOriginalTicket}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
        >
          <div className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" />
          <Dialog.Panel className="relative z-50 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {t("comparisonOriginalTitle", "Original Lightspeed receipt")}
            </Dialog.Title>
            <div className="mt-1 text-sm text-gray-500">
              {selectedLightspeedTicket.ticketNumber
                ? `${t("comparisonModalTicket", "Ticket number")}: ${selectedLightspeedTicket.ticketNumber}`
                : null}
            </div>

            {loadingOriginalReceipt ? (
              <div className="mt-4 text-sm text-gray-500">{t("loading")}</div>
            ) : !selectedReceiptDetails ? (
              <div
                className={`mt-4 text-sm ${
                  originalReceiptError ? "text-red-500" : "text-gray-500"
                }`}
              >
                {t(
                  "comparisonOriginalUnavailable",
                  "Original receipt details are unavailable for this ticket."
                )}
              </div>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t("comparisonOriginalReceiptId", "Receipt ID")}
                    </div>
                    <div className="text-sm text-gray-900">
                      {selectedReceiptId || "–"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t("comparisonOriginalOutletName", "Outlet")}
                    </div>
                    <div className="text-sm text-gray-900">
                      {selectedReceiptDetails.outletName || "–"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t("comparisonOriginalCreationDate", "Creation date")}
                    </div>
                    <div className="text-sm text-gray-900">
                      {formatDateTime(selectedReceiptDetails.creationDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t("comparisonOriginalFinalizedDate", "Finalized date")}
                    </div>
                    <div className="text-sm text-gray-900">
                      {formatDateTime(selectedReceiptDetails.finalizedDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t("comparisonOriginalUsername", "Cashier")}
                    </div>
                    <div className="text-sm text-gray-900">
                      {selectedReceiptDetails.username || "–"}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 text-sm font-semibold text-gray-700">
                    {t("comparisonOriginalProducts", "Products")}
                  </div>
                  {selectedReceiptProducts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                      {t(
                        "comparisonOriginalNoProducts",
                        "No products found on this receipt."
                      )}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                              {t("comparisonOriginalProductName", "Product")}
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                              {t("comparisonOriginalProductQuantity", "Quantity")}
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                              {t("comparisonOriginalProductTotal", "Total (incl. tax)")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {selectedReceiptProducts.map((product, idx) => (
                            <tr key={`${product?.name || "product"}-${idx}`}>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {product?.name || "–"}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-700">
                                {formatQuantity(product?.quantity)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-700">
                                {typeof product?.totalTaxInclusivePrice === "number"
                                  ? formatCurrency(product.totalTaxInclusivePrice)
                                  : "–"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleCloseOriginalTicket}
                className="rounded-2xl bg-marriott px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-marriott-dark"
              >
                {t("comparisonOriginalClose", "Close")}
              </button>
            </div>
          </Dialog.Panel>
        </Dialog>
      )}
    </>
  );
}
