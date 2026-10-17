/**
 * Utility functions for handling date and time in Western Indonesia Time (WIB / UTC+7).
 * Centralizes date formatting and range calculation to avoid UTC drift.
 */

const JAKARTA_TIMEZONE = "Asia/Jakarta";

/**
 * Returns a date string formatted as YYYY-MM-DD in Asia/Jakarta timezone.
 */
export function getWibDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns today date string formatted as YYYY-MM-DD in Asia/Jakarta timezone.
 */
export function getWibTodayDateString(): string {
  return getWibDateString(new Date());
}

/**
 * Returns current year-month string formatted as YYYY-MM in Asia/Jakarta timezone.
 */
export function getWibCurrentMonthString(): string {
  return getWibDateString(new Date()).slice(0, 7);
}

/**
 * Calculates start and end date for a given YYYY-MM month string safely without Date parsing errors.
 * Returns null if input is not in YYYY-MM format.
 */
export function calculateMonthRange(monthStr: string): {
  startOfMonth: string;
  endOfMonth: string;
} | null {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return null;
  }

  const parts = monthStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (month < 1 || month > 12) {
    return null;
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthPadded = String(nextMonth).padStart(2, "0");

  return {
    startOfMonth: `${monthStr}-01`,
    endOfMonth: `${nextYear}-${nextMonthPadded}-01`,
  };
}

export interface WibDateRangeResult {
  startIso: string | null;
  endIso: string | null;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Computes start and end timestamps and dates for standard dashboard time periods in WIB.
 */
export function getWibDateRange(
  period: "today" | "7days" | "this_month" | "all" | "custom",
  customStart?: string,
  customEnd?: string
): WibDateRangeResult {
  const now = new Date();
  const todayWib = getWibDateString(now);

  if (period === "today") {
    return {
      startIso: new Date(`${todayWib}T00:00:00.000+07:00`).toISOString(),
      endIso: new Date(`${todayWib}T23:59:59.999+07:00`).toISOString(),
      startDate: todayWib,
      endDate: todayWib,
    };
  }

  if (period === "7days") {
    const past7Date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const past7Wib = getWibDateString(past7Date);
    return {
      startIso: new Date(`${past7Wib}T00:00:00.000+07:00`).toISOString(),
      endIso: new Date(`${todayWib}T23:59:59.999+07:00`).toISOString(),
      startDate: past7Wib,
      endDate: todayWib,
    };
  }

  if (period === "this_month") {
    const monthStartWib = `${todayWib.slice(0, 7)}-01`;
    return {
      startIso: new Date(`${monthStartWib}T00:00:00.000+07:00`).toISOString(),
      endIso: new Date(`${todayWib}T23:59:59.999+07:00`).toISOString(),
      startDate: monthStartWib,
      endDate: todayWib,
    };
  }

  if (period === "custom") {
    const validStart = customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart);
    const validEnd = customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd);

    const startIso = validStart
      ? new Date(`${customStart}T00:00:00.000+07:00`).toISOString()
      : null;
    const endIso = validEnd
      ? new Date(`${customEnd}T23:59:59.999+07:00`).toISOString()
      : null;

    return {
      startIso,
      endIso,
      startDate: validStart ? customStart : null,
      endDate: validEnd ? customEnd : null,
    };
  }

  return { startIso: null, endIso: null, startDate: null, endDate: null };
}
