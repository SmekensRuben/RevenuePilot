export const marketSegments = [
  {
    id: "corporate",
    name: "Corporate",
    description: "Business travel accounts and negotiated partners.",
  },
  {
    id: "leisure",
    name: "Leisure",
    description: "Standard leisure bookings and vacation travelers.",
  },
  {
    id: "group",
    name: "Group",
    description: "Group blocks and event-related stays.",
  },
];

export const subSegments = [
  {
    id: "corporate-standard",
    name: "Corporate Standard",
    prefix: "CORP",
    rateType: "BAR",
    description: "Default corporate negotiated rate.",
    rateCategory: "Negotiated",
    marketSegment: "Corporate",
    transactionCode: "T001",
  },
  {
    id: "leisure-direct",
    name: "Leisure Direct",
    prefix: "LEIS",
    rateType: "Package",
    description: "Direct bookings from leisure travelers.",
    rateCategory: "Retail",
    marketSegment: "Leisure",
    transactionCode: "T045",
  },
  {
    id: "group-event",
    name: "Group Event",
    prefix: "GRPE",
    rateType: "Group",
    description: "Event and conference group blocks.",
    rateCategory: "Group",
    marketSegment: "Group",
    transactionCode: "T210",
  },
];
