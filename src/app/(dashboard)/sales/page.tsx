"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/utils/currency";
import { receivablePaymentSchema } from "@/schemas/receivable.schema";
import { exportSalesReportToExcel } from "@/utils/exportExcel";
import { generateReceiptPdf, generateInvoicePdf } from "@/utils/pdfReceipt";
import type { Tables } from "@/types/database.types";

type Sale = Tables<"sales">;
type SaleItem = Tables<"sale_items">;
type ReceivablePayment = Tables<"receivable_payments">;

interface SaleWithCustomer extends Sale {
  customer_name?: string;
}

interface SaleDetail {
  sale: SaleWithCustomer;
  items: (SaleItem & { product_name?: string; sku?: string })[];
  payments: ReceivablePayment[];
}

export default function SalesPage() {
  const [sales, setSales] = useState<SaleWithCustomer[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "BELUM_LUNAS" | "LUNAS">("ALL");
  const [totalActiveReceivables, setTotalActiveReceivables] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* Modal Detail & Payment State */
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<"TUNAI" | "TRANSFER">("TUNAI");
  const [payNotes, setPayNotes] = useState<string>("");
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      let query = supabase
        .from("sales")
        .select(`
          *,
          customers ( name )
        `)
        .order("sale_date", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("payment_status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const mapped: SaleWithCustomer[] = (data || []).map((s) => {
        const cust = s.customers as { name: string } | null;
        return {
          ...s,
          customer_name: cust?.name || "Pelanggan Umum",
        };
      });

      setSales(mapped);

      /* Calculate total active receivables */
      const { data: debtData, error: debtError } = await supabase
        .from("sales")
        .select("remaining_debt")
        .eq("payment_status", "BELUM_LUNAS");

      if (debtError) throw new Error(debtError.message);

      const totalDebt = (debtData || []).reduce(
        (acc, curr) => acc + Number(curr.remaining_debt || 0),
        0
      );
      setTotalActiveReceivables(totalDebt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data penjualan & piutang";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  /* Close modal on Escape */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedSaleDetail(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpenDetail = async (sale: SaleWithCustomer) => {
    setIsLoadingDetail(true);
    setPayError(null);
    setPaySuccess(null);
    setPayAmount("");
    setPayNotes("");

    try {
      const supabase = createClient();

      /* 1. Fetch sale items with product names */
      const { data: itemsData, error: itemsError } = await supabase
        .from("sale_items")
        .select(`
          *,
          products ( name, sku )
        `)
        .eq("sale_id", sale.id);

      if (itemsError) throw new Error(itemsError.message);

      const mappedItems = (itemsData || []).map((it) => {
        const prod = it.products as { name: string; sku: string } | null;
        return {
          ...it,
          product_name: prod?.name || "Produk",
          sku: prod?.sku || "",
        };
      });

      /* 2. Fetch payment history */
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("receivable_payments")
        .select("*")
        .eq("sale_id", sale.id)
        .order("payment_date", { ascending: true });

      if (paymentsError) throw new Error(paymentsError.message);

      setSelectedSaleDetail({
        sale,
        items: mappedItems,
        payments: paymentsData || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat detail faktur";
      alert(msg);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handlePayReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleDetail) return;
    setPayError(null);
    setPaySuccess(null);

    const validation = receivablePaymentSchema.safeParse({
      sale_id: selectedSaleDetail.sale.id,
      amount: parseFloat(payAmount) || 0,
      payment_method: payMethod,
      notes: payNotes.trim() || null,
    });

    if (!validation.success) {
      setPayError(validation.error.errors[0]?.message || "Input cicilan tidak valid");
      return;
    }

    if (validation.data.amount > Number(selectedSaleDetail.sale.remaining_debt)) {
      setPayError(
        `Nominal pembayaran (${formatRupiah(validation.data.amount)}) melebihi sisa tagihan (${formatRupiah(Number(selectedSaleDetail.sale.remaining_debt))})`
      );
      return;
    }

    setIsSubmittingPay(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("rpc_pay_receivable", {
        p_sale_id: validation.data.sale_id,
        p_amount: validation.data.amount,
        p_payment_method: validation.data.payment_method,
        p_notes: validation.data.notes || undefined,
      });

      if (error) throw new Error(error.message);

      setPaySuccess("Pembayaran cicilan berhasil dicatat ke sistem.");
      setPayAmount("");
      setPayNotes("");

      /* Refresh list and detail */
      await loadSales();
      const { data: updatedSale } = await supabase
        .from("sales")
        .select(`*, customers ( name )`)
        .eq("id", selectedSaleDetail.sale.id)
        .single();

      if (updatedSale) {
        const cust = updatedSale.customers as { name: string } | null;
        await handleOpenDetail({
          ...updatedSale,
          customer_name: cust?.name || "Pelanggan Umum",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mencatat pembayaran cicilan";
      setPayError(msg);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleAutoFillRemaining = () => {
    if (selectedSaleDetail) {
      setPayAmount(String(selectedSaleDetail.sale.remaining_debt));
    }
  };

  const handlePrintReceiptPdf = () => {
    if (!selectedSaleDetail) return;
    const s = selectedSaleDetail.sale;
    generateReceiptPdf({
      invoice_number: s.invoice_number,
      sale_date: s.sale_date,
      customer_name: s.customer_name,
      cashier_name: s.cashier_name || "Kasir",
      payment_type: s.payment_type,
      payment_status: s.payment_status,
      subtotal_amount: Number(s.subtotal_amount),
      discount_amount: Number(s.discount_amount),
      tax_amount: Number(s.tax_amount || 0),
      grand_total: Number(s.grand_total),
      paid_amount: Number(s.paid_amount),
      remaining_debt: Number(s.remaining_debt),
      notes: s.notes,
      items: selectedSaleDetail.items.map((it) => ({
        name: it.product_name || "Barang",
        qty: it.qty,
        unit_price: Number(it.unit_price),
        discount_pct: Number(it.discount_pct || 0),
        subtotal: Number(it.subtotal),
      })),
    });
  };

  const handlePrintInvoicePdf = () => {
    if (!selectedSaleDetail) return;
    const s = selectedSaleDetail.sale;
    generateInvoicePdf({
      invoice_number: s.invoice_number,
      sale_date: s.sale_date,
      customer_name: s.customer_name,
      cashier_name: s.cashier_name || "Kasir",
      payment_type: s.payment_type,
      payment_status: s.payment_status,
      subtotal_amount: Number(s.subtotal_amount),
      discount_amount: Number(s.discount_amount),
      tax_amount: Number(s.tax_amount || 0),
      grand_total: Number(s.grand_total),
      paid_amount: Number(s.paid_amount),
      remaining_debt: Number(s.remaining_debt),
      notes: s.notes,
      items: selectedSaleDetail.items.map((it) => ({
        name: it.product_name || "Barang",
        qty: it.qty,
        unit_price: Number(it.unit_price),
        discount_pct: Number(it.discount_pct || 0),
        subtotal: Number(it.subtotal),
      })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Excel Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-300 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Piutang & Faktur Penjualan Kasir</h1>
          <p className="text-xs text-slate-700">
            Monitoring tagihan kredit pelanggan, histori pembayaran cicilan, dan status pelunasan nota penjualan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportSalesReportToExcel(sales, `Laporan_Penjualan_${statusFilter}`)}
          disabled={sales.length === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-green-800 px-4 text-xs font-bold text-white hover:bg-green-900 disabled:opacity-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-900"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
          Ekspor Laporan Excel (.xlsx)
        </button>
      </div>

      {/* Summary Box: Total Active Debt */}
      <div className="rounded-md border-2 border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Total Sisa Piutang Toko Berjalan
            </span>
            <span className="text-xs text-slate-700">
              Akumulasi dana penjualan kredit yang belum dilunasi oleh pelanggan.
            </span>
          </div>
          <div className="rounded border border-red-300 bg-red-50 px-4 py-2">
            <span className="text-lg sm:text-2xl font-black tabular-nums text-red-800">
              {formatRupiah(totalActiveReceivables)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-white p-3">
        <span className="text-xs font-semibold text-slate-900">Status Pembayaran:</span>
        {(
          [
            ["ALL", "Semua Transaksi"],
            ["BELUM_LUNAS", "Belum Lunas (Piutang)"],
            ["LUNAS", "Lunas"],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setStatusFilter(val)}
            className={`h-10 rounded px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 ${
              statusFilter === val
                ? "bg-blue-900 text-white font-semibold"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {errorMessage && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-100 p-4 text-xs text-red-800">
          <p className="font-semibold">Terjadi Kesalahan</p>
          <p className="mt-1">{errorMessage}</p>
          <button
            type="button"
            onClick={loadSales}
            className="mt-3 h-10 rounded bg-red-800 px-4 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-md border border-slate-300 bg-white p-8 text-center text-xs font-medium text-slate-900">
          Memuat data faktur penjualan & piutang...
        </div>
      )}

      {/* Sales Table & Cards */}
      {!isLoading && !errorMessage && (
        <div>
          {sales.length === 0 ? (
            <div className="rounded-md border border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-700 shadow-sm">
              Tidak ada data penjualan yang cocok dengan filter yang dipilih.
            </div>
          ) : (
            <>
              {/* 1. Mobile Card List (Senior-Friendly, Legible, High Contrast) */}
              <div className="flex flex-col gap-3 md:hidden">
                {sales.map((s) => {
                  const isUnpaid = s.payment_status === "BELUM_LUNAS";

                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border-2 border-slate-300 bg-white p-4 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                              {s.invoice_number}
                            </span>
                            <span className="text-xs text-slate-700">
                              {new Date(s.sale_date).toLocaleDateString("id-ID")}
                            </span>
                          </div>
                          <h3 className="mt-1 text-base font-bold text-slate-900">
                            {s.customer_name}
                          </h3>
                        </div>
                        <div>
                          {isUnpaid ? (
                            <span className="rounded border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                              BELUM LUNAS
                            </span>
                          ) : (
                            <span className="rounded border border-green-300 bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                              LUNAS
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-md border border-slate-200">
                        <div>
                          <span className="block text-xs font-semibold text-slate-700">Total Faktur</span>
                          <span className="text-base font-bold tabular-nums text-slate-900">
                            {formatRupiah(Number(s.grand_total))}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-semibold text-slate-700">Sisa Piutang</span>
                          <span className={`text-base font-bold tabular-nums ${isUnpaid ? "text-red-800" : "text-green-800"}`}>
                            {formatRupiah(Number(s.remaining_debt))}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-semibold text-slate-700">Metode</span>
                          <span className="text-xs font-bold text-slate-800">
                            {s.payment_type}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-semibold text-slate-700">Jatuh Tempo</span>
                          <span className="text-xs font-medium text-slate-800">
                            {s.due_date || "Langsung Lunas"}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenDetail(s)}
                        className="h-11 w-full rounded border-2 border-blue-900 bg-blue-900 text-sm font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                      >
                        Lihat Rincian / Catat Cicilan
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 2. Desktop Table (>= md) */}
              <div className="hidden md:block rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[850px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-100 font-semibold text-slate-900">
                        <th className="p-3.5 whitespace-nowrap">No Faktur</th>
                        <th className="p-3.5 whitespace-nowrap">Tanggal</th>
                        <th className="p-3.5">Pelanggan</th>
                        <th className="p-3.5 whitespace-nowrap">Tipe</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Total Nota</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Sudah Dibayar</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Sisa Piutang</th>
                        <th className="p-3.5 whitespace-nowrap">Jatuh Tempo</th>
                        <th className="p-3.5 text-center whitespace-nowrap">Status</th>
                        <th className="p-3.5 text-center whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sales.map((s) => {
                        const isUnpaid = s.payment_status === "BELUM_LUNAS";

                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-mono font-medium text-slate-900 whitespace-nowrap">{s.invoice_number}</td>
                            <td className="p-3.5 text-slate-700 whitespace-nowrap">{new Date(s.sale_date).toLocaleDateString("id-ID")}</td>
                            <td className="p-3.5 font-medium text-slate-900">{s.customer_name}</td>
                            <td className="p-3.5 text-slate-700 font-mono text-xs whitespace-nowrap">{s.payment_type}</td>
                            <td className="p-3.5 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                              {formatRupiah(Number(s.grand_total))}
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-slate-700 whitespace-nowrap">
                              {formatRupiah(Number(s.paid_amount))}
                            </td>
                            <td className={`p-3.5 text-right tabular-nums font-bold whitespace-nowrap ${isUnpaid ? "text-red-800" : "text-slate-900"}`}>
                              {formatRupiah(Number(s.remaining_debt))}
                            </td>
                            <td className="p-3.5 text-slate-700 whitespace-nowrap">{s.due_date || "N/A"}</td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              {isUnpaid ? (
                                <span className="rounded border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                                  BELUM LUNAS
                                </span>
                              ) : (
                                <span className="rounded border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                                  LUNAS
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(s)}
                                className="h-10 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-blue-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                              >
                                Detail / Cicilan
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Detail Faktur & Form Bayar Cicilan */}
      {selectedSaleDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-md border border-slate-300 bg-white p-6 shadow-md my-8">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Rincian Faktur: {selectedSaleDetail.sale.invoice_number}
                </h3>
                <p className="text-xs text-slate-700">
                  Pelanggan: {selectedSaleDetail.sale.customer_name} | Tanggal:{" "}
                  {new Date(selectedSaleDetail.sale.sale_date).toLocaleDateString("id-ID")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="h-10 rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                Tutup (Esc)
              </button>
            </div>

            {/* Opsi Cetak Struk & Faktur PDF */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 p-2.5">
              <span className="text-xs font-bold text-slate-700">Cetak Dokumen:</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceiptPdf}
                  className="h-9 rounded bg-blue-900 px-3.5 text-xs font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  Unduh Struk Kasir (PDF)
                </button>
                <button
                  type="button"
                  onClick={handlePrintInvoicePdf}
                  className="h-9 rounded border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  Unduh Faktur A4 (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-9 rounded border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  Cetak (Printer)
                </button>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-700">Subtotal</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatRupiah(Number(selectedSaleDetail.sale.subtotal_amount))}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-700">PPN (11%)</span>
                <span className="font-bold tabular-nums text-blue-900">
                  {formatRupiah(Number(selectedSaleDetail.sale.tax_amount || 0))}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-700">Total Tagihan</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatRupiah(Number(selectedSaleDetail.sale.grand_total))}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-700">Sudah Dibayar</span>
                <span className="font-bold tabular-nums text-green-800">
                  {formatRupiah(Number(selectedSaleDetail.sale.paid_amount))}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-700">Sisa Piutang</span>
                <span className="font-bold tabular-nums text-red-800">
                  {formatRupiah(Number(selectedSaleDetail.sale.remaining_debt))}
                </span>
              </div>
            </div>

            {/* Purchased Items Table */}
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-900">
                Item Barang Terjual & Snapshot Modal (HPP)
              </h4>
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-slate-900 font-semibold">
                      <th className="p-2">Produk</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Harga Jual</th>
                      <th className="p-2 text-right">HPP Saat Jual</th>
                      <th className="p-2 text-right">Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedSaleDetail.items.map((it) => {
                      const itemSubtotal = Number(it.subtotal);
                      const itemCogs = Number(it.qty) * Number(it.cost_price_at_sale);
                      const itemProfit = itemSubtotal - itemCogs;

                      return (
                        <tr key={it.id}>
                          <td className="p-2 font-medium text-slate-900">
                            {it.product_name}
                            <span className="block text-[10px] font-mono text-slate-700">{it.sku}</span>
                          </td>
                          <td className="p-2 text-right tabular-nums text-slate-900">{it.qty} BTG</td>
                          <td className="p-2 text-right tabular-nums text-slate-900">{formatRupiah(Number(it.unit_price))}</td>
                          <td className="p-2 text-right tabular-nums text-slate-700">{formatRupiah(Number(it.cost_price_at_sale))}</td>
                          <td className="p-2 text-right tabular-nums font-semibold text-green-800">
                            {formatRupiah(itemProfit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment History */}
            <div className="mb-6">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-900">
                Riwayat Pembayaran DP & Cicilan
              </h4>
              {selectedSaleDetail.payments.length === 0 ? (
                <p className="text-xs text-slate-700 py-2">Belum ada catatan pembayaran.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-slate-900 font-semibold">
                        <th className="p-2">Tanggal Bayar</th>
                        <th className="p-2 text-right">Nominal</th>
                        <th className="p-2">Metode</th>
                        <th className="p-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedSaleDetail.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2 text-slate-700">{new Date(p.payment_date).toLocaleString("id-ID")}</td>
                          <td className="p-2 text-right font-bold tabular-nums text-slate-900">
                            {formatRupiah(Number(p.amount))}
                          </td>
                          <td className="p-2 text-slate-900 font-mono text-[11px]">{p.payment_method}</td>
                          <td className="p-2 text-slate-700">{p.notes || "Tanpa catatan"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pay Receivable Form (Only if remaining debt > 0) */}
            {Number(selectedSaleDetail.sale.remaining_debt) > 0 ? (
              <div className="rounded border border-blue-900 bg-blue-50/50 p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-blue-950">
                  Catat Pembayaran Cicilan Baru
                </h4>

                {paySuccess && (
                  <div role="status" className="mb-3 rounded border border-green-300 bg-green-100 p-2 text-xs font-semibold text-green-800">
                    {paySuccess}
                  </div>
                )}

                {payError && (
                  <div role="alert" className="mb-3 rounded border border-red-300 bg-red-100 p-2 text-xs text-red-800">
                    {payError}
                  </div>
                )}

                <form onSubmit={handlePayReceivable} className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="pay-amount" className="block text-xs font-medium text-slate-900">
                        Nominal Bayar (Rp)
                      </label>
                      <button
                        type="button"
                        onClick={handleAutoFillRemaining}
                        className="text-[11px] font-bold text-blue-900 hover:underline"
                      >
                        Isi Sisa Tagihan ({formatRupiah(Number(selectedSaleDetail.sale.remaining_debt))})
                      </button>
                    </div>
                    <input
                      id="pay-amount"
                      type="number"
                      step="any"
                      min="1"
                      required
                      placeholder="Masukkan jumlah yang dibayarkan"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="pay-method" className="block text-xs font-medium text-slate-900">
                        Metode Pembayaran
                      </label>
                      <select
                        id="pay-method"
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as "TUNAI" | "TRANSFER")}
                        className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                      >
                        <option value="TUNAI">TUNAI</option>
                        <option value="TRANSFER">TRANSFER BANK</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="pay-notes" className="block text-xs font-medium text-slate-900">
                        Catatan Cicilan (Opsional)
                      </label>
                      <input
                        id="pay-notes"
                        type="text"
                        placeholder="Contoh: Cicilan ke-2 transfer BCA"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingPay}
                      className="h-10 rounded bg-blue-900 px-5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                    >
                      {isSubmittingPay ? "Menyimpan Cicilan..." : "Simpan Pembayaran Cicilan"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="rounded border border-green-300 bg-green-50 p-3 text-center text-xs font-semibold text-green-800">
                Faktur ini telah berstatus LUNAS. Seluruh piutang telah dilunasi oleh pelanggan.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
