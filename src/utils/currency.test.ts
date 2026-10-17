import { describe, expect, it } from "vitest";
import { formatRupiah, formatThickness } from "./currency";

describe("formatRupiah", () => {
  it("memformat bilangan bulat tanpa pecahan desimal", () => {
    const formatted = formatRupiah(150000);
    expect(formatted).toContain("150.000");
    expect(formatted).toContain("Rp");
  });

  it("memformat bilangan desimal dengan dua digit pecahan", () => {
    const formatted = formatRupiah(150000.5);
    expect(formatted).toContain("150.000,50");
  });

  it("menangani angka nol dengan benar", () => {
    const formatted = formatRupiah(0);
    expect(formatted).toContain("0");
    expect(formatted).toContain("Rp");
  });

  it("menangani nilai non-angka dengan fallback aman", () => {
    expect(formatRupiah(NaN)).toBe("Rp 0");
    // @ts-expect-error Pengujian input tidak valid
    expect(formatRupiah(null)).toBe("Rp 0");
    // @ts-expect-error Pengujian input tidak valid
    expect(formatRupiah(undefined)).toBe("Rp 0");
  });
});

describe("formatThickness", () => {
  it("memformat ketebalan milimeter dengan dua digit desimal", () => {
    expect(formatThickness(1.2)).toBe("1.20 mm");
    expect(formatThickness(0.85)).toBe("0.85 mm");
  });

  it("memformat angka nol dengan dua digit desimal", () => {
    expect(formatThickness(0)).toBe("0.00 mm");
  });

  it("menangani input non-angka dengan aman", () => {
    expect(formatThickness(NaN)).toBe("0.00 mm");
    // @ts-expect-error Pengujian input tidak valid
    expect(formatThickness(null)).toBe("0.00 mm");
  });
});
