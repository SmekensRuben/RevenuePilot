import React, { createContext, useContext, useEffect, useState } from "react";
import { useHotelContext } from "contexts/HotelContext";
import {
  getSalesPromoTickets,
  addSalesPromoTicket,
  updateSalesPromoTicket,
  deleteSalesPromoTicket,
} from "services/firebaseSalesPromo";

const SalesPromoContext = createContext();

export function SalesPromoProvider({ children }) {
  const { hotelUid } = useHotelContext();
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    async function load() {
      if (!hotelUid) {
        setTickets([]);
        return;
      }
      const data = await getSalesPromoTickets(hotelUid);
      setTickets(data);
    }
    load();
  }, [hotelUid]);

  const addTicket = async ticket => {
    const id = await addSalesPromoTicket(hotelUid, ticket);
    if (!id) return null;
    setTickets(list => [...list, { ...ticket, id }]);
    return id;
  };

  const updateTicket = async (id, ticket) => {
    await updateSalesPromoTicket(hotelUid, id, ticket);
    setTickets(list => list.map(t => (t.id === id ? { ...ticket, id } : t)));
  };

  const deleteTicket = async id => {
    await deleteSalesPromoTicket(hotelUid, id);
    setTickets(list => list.filter(t => t.id !== id));
  };

  return (
    <SalesPromoContext.Provider
      value={{ tickets, addTicket, updateTicket, deleteTicket }}
    >
      {children}
    </SalesPromoContext.Provider>
  );
}

export function useSalesPromo() {
  return useContext(SalesPromoContext);
}

