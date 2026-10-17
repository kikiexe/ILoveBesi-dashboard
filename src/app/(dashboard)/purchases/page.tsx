"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatThickness } from "@/utils/currency";
import { calculateMovingAverage } from "@/utils/calculation";
import { getWibTodayDateString } from "@/utils/date";
import {
  purchaseSchema,
  supplierSchema,
  type SupplierFormValues,
} from "@/schemas/purchase.schema";
import type { Tables } from "@/types/database.types";

type Product = Tables<"products">;
type Supplier = Tables<"suppliers">;

interface FormItem {
  product_id: string;
  qty: number;
  buy_price: number;
}

interface PurchaseRecord {
  id: string;
  invoice_number: string;
  purchase_date: string;
  total_amount: number;
  notes: string | null;
  supplier_name: string;
  items_count: number;
}

export default function PurchasesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* Purchase Form State */
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => getWibTodayDateString());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<FormItem[]>([
    { product_id: "", qty: 1, buy_price: 0 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Add Supplier Modal */
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState<SupplierFormValues>({
    name: "",
    phone: "",
    address: "",
  });
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      /* 1. Fetch active products */
      const { data: prodData, error: prodError } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sku", { ascending: true });

      if (prodError) throw new Error(prodError.message);
      setProducts(prodData || []);

      /* 2. Fetch suppliers */
      const { data: suppData, error: suppError } = await supabase
        .from("suppliers")
        .select("*")
        .order("name", { ascending: true });

      if (suppError) throw new Error(suppError.message);
      setSuppliers(suppData || []);
      if (suppData && suppData.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(suppData[0].id);
      }

      /* 3. Fetch purchase history */
      const { data: purchData, error: purchError } = await supabase
        .from("purchases")
        .select(`
          id,
          invoice_number,
          purchase_date,
          total_amount,
          notes,
          suppliers ( name ),
          purchase_items ( id )
        `)
        .order("purchase_date", { ascending: false })
        .limit(30);

      if (purchError) throw new Error(purchError.message);

      const mappedPurchases: PurchaseRecord[] = (purchData || []).map((p) => {
        const supp = p.suppliers as { name: string } | null;
        const pItems = p.purchase_items as { id: string }[] | null;
        return {
          id: p.id,
          invoice_number: p.invoice_number,
          purchase_date: p.purchase_date,
          total_amount: Number(p.total_amount || 0),
          notes: p.notes,
          supplier_name: supp?.name || "Tidak tercatat",
          items_count: pItems?.length || 0,
        };
      });

      setPurchases(mappedPurchases);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data kulakan";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSupplierId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Close modal on Escape */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSupplierModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAddItemRow = () => {
    setItems([...items, { product_id: "", qty: 1, buy_price: 0 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string | number) => {
    const updated = [...items];
    if (field === "product_id") {
      const prod = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        product_id: value as string,
        buy_price: prod ? Number(prod.avg_cost_price) : 0,
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }
    setItems(updated);
  };

  const calculateTotalKulakan = () => {
    return items.reduce((acc, curr) => acc + (curr.qty || 0) * (curr.buy_price || 0), 0);
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const validation = purchaseSchema.safeParse({
      invoice_number: invoiceNumber,
      supplier_id: selectedSupplierId,
      purchase_date: purchaseDate,
      notes: notes.trim() || null,
      items: items.map((it) => ({
        product_id: it.product_id,
        qty: it.qty,
        buy_price: it.buy_price,
      })),
    });

    if (!validation.success) {
      setFormError(validation.error.errors[0]?.message || "Input tidak valid");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("rpc_record_purchase", {
        p_invoice_number: validation.data.invoice_number,
        p_supplier_id: validation.data.supplier_id,
        p_purchase_date: validation.data.purchase_date,
        p_notes: validation.data.notes || undefined,
        p_items: validation.data.items,
      });

      if (error) throw new Error(error.message);

      setFormSuccess(`Kulakan berhasil dicatat dengan nomor nota ${invoiceNumber}. Stok & HPP Moving Average telah diperbarui.`);
      setInvoiceNumber("");
      setPurchaseDate(getWibTodayDateString());
      setNotes("");
      setItems([{ product_id: "", qty: 1, buy_price: 0 }]);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mencatat transaksi kulakan";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierError(null);

    const validation = supplierSchema.safeParse(newSupplier);
    if (!validation.success) {
      setSupplierError(validation.error.errors[0]?.message || "Input supplier tidak valid");
      return;
    }

    setIsSubmittingSupplier(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: validation.data.name,
          phone: validation.data.phone || null,
          address: validation.data.address || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      setShowSupplierModal(false);
      setNewSupplier({ name: "", phone: "", address: "" });
      await loadData();
      if (data) {
        setSelectedSupplierId(data.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mendaftarkan supplier baru";
      setSupplierError(msg);
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-300 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Kulakan Barang Masuk & Supplier</h1>
        <p className="text-xs text-slate-700">
          Pencatatan faktur kulakan dengan pratinjau kalkulasi HPP Moving Average secara instan per baris.
        </p>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-100 p-4 text-xs text-red-800">
          <p className="font-semibold">Terjadi Kesalahan</p>
          <p className="mt-1">{errorMessage}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 h-10 rounded bg-red-800 px-4 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Purchase Form Section */}
      <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
          Form Input Kulakan Multi-Item
        </h2>

        {formSuccess && (
          <div role="status" className="mb-4 rounded border border-green-300 bg-green-100 p-3 text-xs font-semibold text-green-800">
            {formSuccess}
          </div>
        )}

        {formError && (
          <div role="alert" className="mb-4 rounded border border-red-300 bg-red-100 p-3 text-xs text-red-800">
            {formError}
          </div>
        )}

        <form onSubmit={handlePurchaseSubmit} className="space-y-4">
          {/* Header Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="purchase-invoice" className="block text-xs font-medium text-slate-900">
                Nomor Nota Supplier
              </label>
              <input
                id="purchase-invoice"
                type="text"
                required
                placeholder="Contoh: KS-99218"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label htmlFor="purchase-supplier" className="block text-xs font-medium text-slate-900">
                  Supplier
                </label>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="text-[11px] font-semibold text-blue-900 hover:underline"
                >
                  + Tambah Supplier Baru
                </button>
              </div>
              <select
                id="purchase-supplier"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="purchase-date" className="block text-xs font-medium text-slate-900">
                Tanggal Kulakan
              </label>
              <input
                id="purchase-date"
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="purchase-notes" className="block text-xs font-medium text-slate-900">
              Catatan / Ekspedisi (Opsional)
            </label>
            <input
              id="purchase-notes"
              type="text"
              placeholder="Contoh: Pengiriman truk fuso muatan 6 ton"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            />
          </div>

          {/* Items Table */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-900">
              Daftar Barang yang Dibeli
            </h3>

            <div className="space-y-3">
              {items.map((item, index) => {
                const prod = products.find((p) => p.id === item.product_id);
                const oldStock = prod?.stock_qty || 0;
                const oldAvgCost = Number(prod?.avg_cost_price || 0);
                const newAvgCost = prod
                  ? calculateMovingAverage(oldStock, oldAvgCost, item.qty, item.buy_price)
                  : item.buy_price;

                const subtotal = (item.qty || 0) * (item.buy_price || 0);

                return (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12 sm:items-center"
                  >
                    <div className="sm:col-span-4">
                      <label htmlFor={`item-product-${index}`} className="block text-[11px] font-medium text-slate-700">
                        Produk
                      </label>
                      <select
                        id={`item-product-${index}`}
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, "product_id", e.target.value)}
                        className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                      >
                        <option value="">Pilih Produk</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} | {p.name} (Tebal: {formatThickness(Number(p.thickness_mm))})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor={`item-qty-${index}`} className="block text-[11px] font-medium text-slate-700">
                        Jumlah (BTG)
                      </label>
                      <input
                        id={`item-qty-${index}`}
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, "qty", parseInt(e.target.value) || 0)}
                        className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor={`item-price-${index}`} className="block text-[11px] font-medium text-slate-700">
                        Harga Beli / BTG (Rp)
                      </label>
                      <input
                        id={`item-price-${index}`}
                        type="number"
                        step="100"
                        min="0"
                        value={item.buy_price}
                        onChange={(e) => handleItemChange(index, "buy_price", parseFloat(e.target.value) || 0)}
                        className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                      />
                    </div>

                    {/* Live Moving Average Preview */}
                    <div className="sm:col-span-3 rounded border border-slate-200 bg-white p-2 text-xs">
                      <div className="text-[10px] uppercase font-bold text-slate-700">Pratinjau HPP Baru</div>
                      {prod ? (
                        <div className="font-mono text-xs">
                          <span className="text-slate-700">{formatRupiah(oldAvgCost)}</span>
                          {" -> "}
                          <span className="font-bold text-blue-900">{formatRupiah(newAvgCost)}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">Pilih produk dahulu</span>
                      )}
                      <div className="mt-1 text-[11px] text-slate-700">
                        Subtotal: <span className="font-bold tabular-nums text-slate-900">{formatRupiah(subtotal)}</span>
                      </div>
                    </div>

                    <div className="sm:col-span-1 flex items-center justify-end">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(index)}
                          className="h-10 rounded border border-red-300 bg-white px-2 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="h-10 rounded border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                + Tambah Baris Barang
              </button>

              <div className="text-sm font-bold text-slate-900">
                Total Kulakan: <span className="tabular-nums text-blue-950">{formatRupiah(calculateTotalKulakan())}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded bg-blue-900 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            >
              {isSubmitting ? "Menyimpan Kulakan..." : "Simpan & Mutasi Stok Kulakan"}
            </button>
          </div>
        </form>
      </div>

      {/* Purchase History Table & Cards */}
      <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-slate-900 border-b border-slate-200 pb-2">
          Riwayat Nota Kulakan Terakhir
        </h2>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-700">Memuat riwayat kulakan...</p>
        ) : purchases.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-700">
            Belum ada catatan kulakan pada sistem. Gunakan form di atas untuk mencatat kulakan perdana.
          </div>
        ) : (
          <>
            {/* 1. Mobile Card List (Senior-Friendly, High Contrast) */}
            <div className="flex flex-col gap-3 md:hidden">
              {purchases.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border-2 border-slate-300 bg-white p-4 shadow-sm space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-mono text-xs font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                      {p.invoice_number}
                    </span>
                    <span className="text-xs text-slate-700">{p.purchase_date}</span>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-700">Supplier:</span>
                    <span className="text-base font-bold text-slate-900">{p.supplier_name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded border border-slate-200">
                    <div>
                      <span className="block text-xs font-semibold text-slate-700">Variasi Barang</span>
                      <span className="text-sm font-bold text-slate-900">{p.items_count} Barang</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-slate-700">Total Tagihan</span>
                      <span className="text-base font-bold tabular-nums text-blue-950">
                        {formatRupiah(p.total_amount)}
                      </span>
                    </div>
                  </div>

                  {p.notes && (
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                      <span className="font-bold">Catatan:</span> {p.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* 2. Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 font-semibold text-slate-900">
                    <th className="p-3.5 whitespace-nowrap">No Nota</th>
                    <th className="p-3.5 whitespace-nowrap">Tanggal</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5 text-right whitespace-nowrap">Variasi Barang</th>
                    <th className="p-3.5 text-right whitespace-nowrap">Total Tagihan</th>
                    <th className="p-3.5">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-medium text-slate-900 whitespace-nowrap">{p.invoice_number}</td>
                      <td className="p-3.5 text-slate-700 whitespace-nowrap">{p.purchase_date}</td>
                      <td className="p-3.5 font-medium text-slate-900">{p.supplier_name}</td>
                      <td className="p-3.5 text-right tabular-nums text-slate-700 whitespace-nowrap">{p.items_count} Barang</td>
                      <td className="p-3.5 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(p.total_amount)}
                      </td>
                      <td className="p-3.5 text-slate-700">{p.notes || "Tidak ada catatan"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Add Supplier */}
      {showSupplierModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <div className="w-full max-w-md rounded-md border border-slate-300 bg-white p-6 shadow-md">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Tambah Supplier Baru</h3>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="h-10 rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                Tutup (Esc)
              </button>
            </div>

            {supplierError && (
              <div role="alert" className="mb-4 rounded border border-red-300 bg-red-100 p-3 text-xs text-red-800">
                {supplierError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label htmlFor="supplier-name" className="block text-xs font-medium text-slate-900">
                  Nama Supplier / Distributor
                </label>
                <input
                  id="supplier-name"
                  type="text"
                  required
                  placeholder="Contoh: PT Krakatau Steel"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                />
              </div>

              <div>
                <label htmlFor="supplier-phone" className="block text-xs font-medium text-slate-900">
                  Nomor Telepon
                </label>
                <input
                  id="supplier-phone"
                  type="text"
                  placeholder="Contoh: 021-5551234"
                  value={newSupplier.phone || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                />
              </div>

              <div>
                <label htmlFor="supplier-address" className="block text-xs font-medium text-slate-900">
                  Alamat Kantor / Gudang
                </label>
                <input
                  id="supplier-address"
                  type="text"
                  placeholder="Contoh: Kawasan Industri Cilegon"
                  value={newSupplier.address || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="h-10 rounded border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSupplier}
                  className="h-10 rounded bg-blue-900 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  {isSubmittingSupplier ? "Menyimpan..." : "Daftarkan Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
