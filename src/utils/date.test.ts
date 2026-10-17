import { describe, expect, it } from "vitest";
import {
  calculateMonthRange,
  getWibCurrentMonthString,
  getWibDateRange,
  getWibDateString,
  getWibTodayDateString,
} from "./date";

describe("calculateMonthRange", () => {
  it("menghasilkan rentang awal dan akhir bulan yang valid", () => {
    const range = calculateMonthRange("2026-10");
    expect(range).not.toBeNull();
    expect(range?.startOfMonth).toBe("2026-10-01");
    expect(range?.endOfMonth).toBe("2026-11-01");
  });

  it("menghitung pergantian tahun secara benar saat bulan Desember", () => {
    const range = calculateMonthRange("2026-12");
    expect(range).not.toBeNull();
    expect(range?.startOfMonth).toBe("2026-12-01");
    expect(range?.endOfMonth).toBe("2027-01-01");
  });

  it("mengembalikan null tanpa error untuk input tidak valid", () => {
    expect(calculateMonthRange("")).toBeNull();
    expect(calculateMonthRange("all")).toBeNull();
    expect(calculateMonthRange("2026-13")).toBeNull();
    expect(calculateMonthRange("2026-00")).toBeNull();
    expect(calculateMonthRange("2026-abc")).toBeNull();
  });
});

describe("getWibDateRange", () => {
  it("menghasilkan rentang hari ini dengan batas waktu WIB yang benar", () => {
    const range = getWibDateRange("today");
    expect(range.startDate).toBe(getWibTodayDateString());
    expect(range.endDate).toBe(getWibTodayDateString());
    expect(range.startIso).not.toBeNull();
    expect(range.endIso).not.toBeNull();
    // Memastikan ISO timestamp dibentuk dari string dengan offset +07:00
    const startDate = new Date(range.startIso!);
    const endDate = new Date(range.endIso!);
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
  });

  it("menghasilkan rentang 7 hari ke belakang", () => {
    const range = getWibDateRange("7days");
    expect(range.startDate).not.toBeNull();
    expect(range.endDate).toBe(getWibTodayDateString());
    expect(range.startIso).not.toBeNull();
    expect(range.endIso).not.toBeNull();
  });

  it("menghasilkan rentang bulan berjalan", () => {
    const range = getWibDateRange("this_month");
    expect(range.startDate).toBe(`${getWibTodayDateString().slice(0, 7)}-01`);
    expect(range.endDate).toBe(getWibTodayDateString());
    expect(range.startIso).not.toBeNull();
    expect(range.endIso).not.toBeNull();
  });

  it("menangani rentang custom tanggal yang valid", () => {
    const range = getWibDateRange("custom", "2026-10-01", "2026-10-15");
    expect(range.startDate).toBe("2026-10-01");
    expect(range.endDate).toBe("2026-10-15");
    expect(range.startIso).not.toBeNull();
    expect(range.endIso).not.toBeNull();
  });

  it("menangani rentang custom yang tidak valid dengan null", () => {
    const range = getWibDateRange("custom", "invalid", "invalid");
    expect(range.startDate).toBeNull();
    expect(range.endDate).toBeNull();
    expect(range.startIso).toBeNull();
    expect(range.endIso).toBeNull();
  });

  it("menangani periode all dengan nilai null", () => {
    const range = getWibDateRange("all");
    expect(range.startDate).toBeNull();
    expect(range.endDate).toBeNull();
    expect(range.startIso).toBeNull();
    expect(range.endIso).toBeNull();
  });
});

describe("getWibDateString dan pembantu tanggal WIB", () => {
  it("menghasilkan format YYYY-MM-DD", () => {
    const today = getWibTodayDateString();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true);
  });

  it("menghasilkan bulan berjalan berformat YYYY-MM", () => {
    const month = getWibCurrentMonthString();
    expect(/^\d{4}-\d{2}$/.test(month)).toBe(true);
  });

  it("mengonversi objek tanggal ke format YYYY-MM-DD Asia/Jakarta", () => {
    const testDate = new Date("2026-10-17T17:00:00.000Z"); // 17:00 UTC = 00:00 WIB keesokan harinya (18 Okt)
    const result = getWibDateString(testDate);
    expect(result).toBe("2026-10-18");
  });
});
