"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatThickness } from "@/utils/currency";
import { calculateNetProfit } from "@/utils/calculation";
import { getWibDateRange } from "@/utils/date";

type PeriodFilter = "today" | "7days" | "this_month" | "all" | "custom";

interface SummaryMetrics {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
}

interface UnpaidSale {
  id: string;
  invoice_number: string;
  customer_name: string;
  due_date: string | null;
  remaining_debt: number;
}

interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  dimension: string;
  thickness_mm: number;
  stock_qty: number;
}

export default function SummaryPage() {
  const [period, setPeriod] = useState<PeriodFilter>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [metrics, setMetrics] = useState<SummaryMetrics>({
    totalRevenue: 0,
    totalCogs: 0,
    grossProfit: 0,
    totalExpenses: 0,
    netProfit: 0,
  });

  const [unpaidSales, setUnpaidSales] = useState<UnpaidSale[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getDateRange = useCallback(() => {
    return getWibDateRange(period, startDate, endDate);
  }, [period, startDate, endDate]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { startIso, endIso, startDate: wibStartDate, endDate: wibEndDate } = getDateRange();

      /* 1. Fetch sales and calculate Total Revenue */
      let salesQuery = supabase
        .from("sales")
        .select("id, grand_total, sale_date");

      if (startIso) salesQuery = salesQuery.gte("sale_date", startIso);
      if (endIso) salesQuery = salesQuery.lte("sale_date", endIso);

      const { data: salesData, error: salesError } = await salesQuery;
      if (salesError) throw new Error(salesError.message);

      const saleIds = (salesData || []).map((s) => s.id);
      const totalRevenue = (salesData || []).reduce((acc, curr) => acc + Number(curr.grand_total || 0), 0);

      /* 2. Fetch sale_items for those sales to calculate Total COGS */
      let totalCogs = 0;
      if (saleIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("sale_items")
          .select("qty, cost_price_at_sale")
          .in("sale_id", saleIds);

        if (itemsError) throw new Error(itemsError.message);

        totalCogs = (itemsData || []).reduce(
          (acc, item) => acc + Number(item.qty || 0) * Number(item.cost_price_at_sale || 0),
          0
        );
      }

      /* 3. Fetch operational expenses */
      let expensesQuery = supabase
        .from("operational_expenses")
        .select("amount, expense_date");

      if (wibStartDate) expensesQuery = expensesQuery.gte("expense_date", wibStartDate);
      if (wibEndDate) expensesQuery = expensesQuery.lte("expense_date", wibEndDate);

      const { data: expensesData, error: expensesError } = await expensesQuery;
      if (expensesError) throw new Error(expensesError.message);

      const totalExpenses = (expensesData || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

      /* Calculate profit metrics using utility */
      const { grossProfit, netProfit } = calculateNetProfit(totalRevenue, totalCogs, totalExpenses);

      setMetrics({
        totalRevenue,
        totalCogs,
        grossProfit,
        totalExpenses,
        netProfit,
      });

      /* 4. Fetch unpaid sales (BELUM_LUNAS) with customer name */
      const { data: unpaidData, error: unpaidError } = await supabase
        .from("sales")
        .select(`
          id,
          invoice_number,
          due_date,
          remaining_debt,
          customers ( name )
        `)
        .eq("payment_status", "BELUM_LUNAS")
        .order("sale_date", { ascending: false })
        .limit(10);

      if (unpaidError) throw new Error(unpaidError.message);

      const mappedUnpaid: UnpaidSale[] = (unpaidData || []).map((u) => {
        const cust = u.customers as { name: string } | null;
        return {
          id: u.id,
          invoice_number: u.invoice_number,
          customer_name: cust?.name || "Umum",
          due_date: u.due_date,
          remaining_debt: Number(u.remaining_debt || 0),
        };
      });
      setUnpaidSales(mappedUnpaid);

      /* 5. Fetch low stock products (<= 20 BTG) */
      const { data: stockData, error: stockError } = await supabase
        .from("products")
        .select("id, sku, name, dimension, thickness_mm, stock_qty")
        .eq("is_active", true)
        .lte("stock_qty", 20)
        .order("stock_qty", { ascending: true })
        .limit(10);

      if (stockError) throw new Error(stockError.message);

      setLowStockProducts(
        (stockData || []).map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          dimension: p.dimension,
          thickness_mm: Number(p.thickness_mm),
          stock_qty: p.stock_qty,
        }))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data dari database";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-300 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Ringkasan Laba Bersih & Arus Keuangan</h1>
        <p className="text-xs text-slate-700">Laporan operasional dan kesehatan finansial toko berdasarkan data transaksi riil.</p>
      </div>

      {/* Filter Bar */}
      <div className="rounded-md border border-slate-300 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-900">Periode:</span>
          {(
            [
              ["today", "Hari Ini"],
              ["7days", "7 Hari Terakhir"],
              ["this_month", "Bulan Ini"],
              ["all", "Semua Waktu"],
              ["custom", "Kustom"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setPeriod(val)}
              className={`h-10 rounded px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 ${
                period === val
                  ? "bg-blue-900 text-white font-semibold"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}

          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
              <label htmlFor="start-date" className="text-xs text-slate-700">Dari:</label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
              <label htmlFor="end-date" className="text-xs text-slate-700">Sampai:</label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-100 p-4 text-sm text-red-800"
        >
          <p className="font-semibold">Terjadi Kesalahan Pengambilan Data</p>
          <p className="mt-1 text-xs">{errorMessage}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 h-10 rounded bg-red-800 px-4 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-md border border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-900">Memuat data ringkasan laba dan stok...</p>
        </div>
      )}

      {!isLoading && !errorMessage && (
        <>
          {/* Sequential Profit Calculation Ledger */}
          <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              Buku Perhitungan Laba Periode Terpilih
            </h2>

            <div className="space-y-3 font-mono text-xs sm:text-sm">
              {/* Row 1: Omzet */}
              <div className="flex items-center justify-between border-b border-slate-100 py-2">
                <span className="font-sans font-medium text-slate-900">1. Total Omzet Penjualan</span>
                <span className="tabular-nums font-bold text-slate-900">{formatRupiah(metrics.totalRevenue)}</span>
              </div>

              {/* Row 2: COGS */}
              <div className="flex items-center justify-between border-b border-slate-100 py-2">
                <span className="font-sans font-medium text-slate-700 pl-4">Dikurangi: Total HPP Barang Terjual</span>
                <span className="tabular-nums text-slate-700">({formatRupiah(metrics.totalCogs)})</span>
              </div>

              {/* Row 3: Gross Profit */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-2">
                <span className="font-sans font-semibold text-slate-900">= Laba Kotor Penjualan</span>
                <span className="tabular-nums font-bold text-slate-900">{formatRupiah(metrics.grossProfit)}</span>
              </div>

              {/* Row 4: Expenses */}
              <div className="flex items-center justify-between border-b border-slate-100 py-2">
                <span className="font-sans font-medium text-slate-700 pl-4">Dikurangi: Total Biaya Operasional Toko</span>
                <span className="tabular-nums text-slate-700">({formatRupiah(metrics.totalExpenses)})</span>
              </div>

              {/* Row 5: Net Profit Focal Point */}
              <div className="flex items-center justify-between rounded border-2 border-blue-900 bg-blue-50 px-4 py-3 mt-4">
                <div>
                  <span className="block font-sans text-sm sm:text-base font-extrabold uppercase text-blue-950">
                    = LABA BERSIH TOKO
                  </span>
                  <span className="font-sans text-xs text-blue-900">Hasil bersih setelah seluruh beban modal & operasional</span>
                </div>
                <span className={`text-base sm:text-xl font-extrabold tabular-nums ${metrics.netProfit >= 0 ? "text-blue-950" : "text-red-700"}`}>
                  {formatRupiah(metrics.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Tables: 2 Columns Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: Unpaid Receivables */}
            <div className="rounded-md border border-slate-300 bg-white p-4 sm:p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Tagihan Kredit Belum Lunas</h3>
                <Link
                  href="/sales"
                  className="text-xs font-bold text-blue-900 hover:underline"
                >
                  Buka Menu Piutang &gt;
                </Link>
              </div>

              {unpaidSales.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-700">Semua transaksi kredit telah lunas atau belum ada penjualan kredit.</p>
                </div>
              ) : (
                <>
                  {/* Mobile Card List */}
                  <div className="flex flex-col gap-2.5 sm:hidden">
                    {unpaidSales.map((u) => (
                      <div key={u.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-300">
                            {u.invoice_number}
                          </span>
                          <span className="text-xs text-slate-700">{u.due_date ? `Jatuh tempo: ${u.due_date}` : "Kredit"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900">{u.customer_name}</span>
                          <span className="text-sm font-bold text-red-800 tabular-nums">
                            {formatRupiah(u.remaining_debt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100 font-semibold text-slate-900">
                          <th className="p-2.5">No Faktur</th>
                          <th className="p-2.5">Pelanggan</th>
                          <th className="p-2.5">Jatuh Tempo</th>
                          <th className="p-2.5 text-right">Sisa Piutang</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {unpaidSales.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-medium text-slate-900">{u.invoice_number}</td>
                            <td className="p-2.5 text-slate-700 font-medium">{u.customer_name}</td>
                            <td className="p-2.5 text-slate-700">{u.due_date || "Tidak ditentukan"}</td>
                            <td className="p-2.5 text-right font-bold text-red-800 tabular-nums">
                              {formatRupiah(u.remaining_debt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Right: Low Stock Alert */}
            <div className="rounded-md border border-slate-300 bg-white p-4 sm:p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Peringatan Stok Menipis (&lt;= 20 BTG)</h3>
                <Link
                  href="/purchases"
                  className="text-xs font-bold text-blue-900 hover:underline"
                >
                  Catat Kulakan &gt;
                </Link>
              </div>

              {lowStockProducts.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-700">Seluruh stok produk berada dalam tingkat aman (&gt; 20 BTG).</p>
                </div>
              ) : (
                <>
                  {/* Mobile Card List */}
                  <div className="flex flex-col gap-2.5 sm:hidden">
                    {lowStockProducts.map((p) => (
                      <div key={p.id} className="rounded-md border border-red-200 bg-red-50/50 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-300">
                            {p.sku}
                          </span>
                          <span className="rounded border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                            Stok Kritis
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900">{p.name} ({p.dimension})</span>
                          <span className="text-base font-bold text-red-800 tabular-nums">
                            {p.stock_qty} BTG
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100 font-semibold text-slate-900">
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Ukuran & Tebal</th>
                          <th className="p-2.5 text-right">Sisa Stok</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {lowStockProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-medium text-slate-900">{p.sku}</td>
                            <td className="p-2.5 text-slate-700 font-medium">
                              {p.dimension} ({formatThickness(p.thickness_mm)})
                            </td>
                            <td className="p-2.5 text-right font-bold text-red-800 tabular-nums">
                              {p.stock_qty} BTG
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="rounded border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                                KRITIS
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
