import { describe, expect, it } from "vitest";
import { calculateMovingAverage, calculateNetProfit } from "./calculation";

describe("calculateMovingAverage", () => {
  it("mengembalikan harga beli baru saat stok awal 0", () => {
    const result = calculateMovingAverage(0, 0, 50, 150000);
    expect(result).toBe(150000);
  });

  it("menghitung rata-rata tertimbang stok lama dan kulakan baru secara presisi", () => {
    // 100 BTG @ 150.000 + 100 BTG @ 160.000 = 200 BTG @ 155.000
    const result = calculateMovingAverage(100, 150000, 100, 160000);
    expect(result).toBe(155000);
  });

  it("melakukan pembulatan 2 desimal sesuai perhitungan RPC database", () => {
    // 10 BTG @ 100.000 + 7 BTG @ 105.000 = (1.000.000 + 735.000) / 17 = 102.058,8235... -> 102058.82
    const result = calculateMovingAverage(10, 100000, 7, 105000);
    expect(result).toBe(102058.82);
  });

  it("menangani kasus total kuantitas nol dengan aman", () => {
    const result = calculateMovingAverage(0, 0, 0, 120000);
    expect(result).toBe(120000);
  });
});

describe("calculateNetProfit", () => {
  it("menghitung laba positif saat pendapatan lebih besar dari HPP dan operasional", () => {
    const result = calculateNetProfit(10000000, 6000000, 1500000);
    expect(result.grossProfit).toBe(4000000);
    expect(result.netProfit).toBe(2500000);
  });

  it("menghitung titik impas tepat nol", () => {
    const result = calculateNetProfit(5000000, 4000000, 1000000);
    expect(result.grossProfit).toBe(1000000);
    expect(result.netProfit).toBe(0);
  });

  it("menghitung nilai negatif saat posisi usaha merugi", () => {
    const result = calculateNetProfit(5000000, 4000000, 2000000);
    expect(result.grossProfit).toBe(1000000);
    expect(result.netProfit).toBe(-1000000);
  });
});
