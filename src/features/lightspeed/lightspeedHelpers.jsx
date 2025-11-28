// src/features/lightspeed/lightspeedHelpers.js

export function parseDay(str) {
  if (!str) return "";
  str = String(str).trim();

  // Remove time if present
  str = str.split(" ")[0];

  // Try dd/mm/yy or d/m/yy or d/m/yyyy
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let day = m[1].padStart(2, "0");
    let month = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = Number(year) < 50 ? "20" + year : "19" + year;
    return `${year}-${month}-${day}`;
  }

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.slice(0, 10))) return str.slice(0, 10);

  return "";
}


export function sanitizeKey(str) {
  if (!str) return "";
  return String(str).replace(/[.#$/\[\]]/g, "_").replace(/\//g, "_");
}

export function parseLightspeedDateTime(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  const day = parseDay(str);
  if (!day) return null;

  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
    seconds = Number(timeMatch[3] || 0);
    const ampm = timeMatch[4]?.toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
  }

  const isoTime = [hours, minutes, seconds]
    .map((val) => String(Number.isFinite(val) ? val : 0).padStart(2, "0"))
    .join(":");

  const date = new Date(`${day}T${isoTime}`);
  if (Number.isNaN(date.getTime())) return { day };

  return { day, date, hasTime: Boolean(timeMatch) };
}

export function resolveLightspeedShiftDay(
  rawCreation,
  rawFinalized,
  rolloverHour = 4
) {
  const resolveWithRollover = (raw) => {
    const parsed = parseLightspeedDateTime(raw);
    if (!parsed) return "";
    if (!parsed.date || Number.isNaN(parsed.date.getTime())) return parsed.day;

    const safeRollover = Number.isFinite(Number(rolloverHour))
      ? Number(rolloverHour)
      : 0;
    const adjusted = new Date(parsed.date);
    if (safeRollover > 0 && parsed.hasTime && adjusted.getHours() < safeRollover) {
      adjusted.setDate(adjusted.getDate() - 1);
    }
    const year = adjusted.getFullYear();
    const month = String(adjusted.getMonth() + 1).padStart(2, "0");
    const day = String(adjusted.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const finalizedDay = resolveWithRollover(rawFinalized);
  if (finalizedDay) return finalizedDay;

  const creationDay = resolveWithRollover(rawCreation);
  if (creationDay) return creationDay;

  return parseDay(rawFinalized) || parseDay(rawCreation) || "";
}

export function dateRange(start, end) {
  const out = [];
  let d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function formatDateNL(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("nl-BE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}
