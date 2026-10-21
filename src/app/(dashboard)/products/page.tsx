"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatThickness } from "@/utils/currency";
import {
  productSchema,
  productUpdateSchema,
  COMMON_PRODUCT_UNITS,
  type ProductFormValues,
  type ProductUpdateFormValues,
} from "@/schemas/product.schema";
import type { Tables } from "@/types/database.types";

type Product = Tables<"products">;

const initialAddFormValues: ProductFormValues = {
  sku: "",
  name: "",
  dimension: "",
  thickness_mm: 0,
  unit: "BTG",
  stock_qty: 0,
  avg_cost_price: 0,
  sell_price: 0,
  include_ppn: false,
  is_active: true,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dimensionFilter, setDimensionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* Form Add State */
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormValues, setAddFormValues] = useState<ProductFormValues>(initialAddFormValues);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  /* Modal Edit State */
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormValues, setEditFormValues] = useState<ProductUpdateFormValues>({
    name: "",
    dimension: "",
    thickness_mm: 0,
    unit: "BTG",
    stock_qty: 0,
    avg_cost_price: 0,
    sell_price: 0,
    include_ppn: false,
    is_active: true,
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sku", { ascending: true });

      if (error) throw new Error(error.message);
      setProducts(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat katalog produk";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  /* Close modal on Escape */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingProduct(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const dimensionsList = Array.from(
    new Set(products.map((p) => p.dimension).filter((d): d is string => Boolean(d && d.trim())))
  ).sort();

  const filteredProducts = products.filter((p) => {
    const currentDim = p.dimension ? p.dimension.trim() : "";
    const matchesDimension =
      dimensionFilter === "all" ||
      (dimensionFilter === "none" ? !currentDim : currentDim.toLowerCase() === dimensionFilter.toLowerCase());

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      p.sku.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      currentDim.toLowerCase().includes(query);

    return matchesDimension && matchesSearch;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);

    const parseResult = productSchema.safeParse(addFormValues);
    if (!parseResult.success) {
      setAddFormError(parseResult.error.errors[0]?.message || "Input tidak valid");
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("products").insert({
        sku: parseResult.data.sku,
        name: parseResult.data.name,
        dimension: parseResult.data.dimension || "",
        thickness_mm: parseResult.data.thickness_mm || 0,
        unit: parseResult.data.unit,
        stock_qty: parseResult.data.stock_qty,
        avg_cost_price: parseResult.data.avg_cost_price,
        sell_price: parseResult.data.sell_price,
        include_ppn: parseResult.data.include_ppn,
        is_active: parseResult.data.is_active,
      });

      if (error) throw new Error(error.message);

      setShowAddForm(false);
      setAddFormValues(initialAddFormValues);
      await loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan varian baru";
      setAddFormError(msg);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleStartEdit = (p: Product) => {
    setEditingProduct(p);
    setEditFormValues({
      name: p.name,
      dimension: p.dimension || "",
      thickness_mm: Number(p.thickness_mm) || 0,
      unit: p.unit || "BTG",
      stock_qty: Number(p.stock_qty) || 0,
      avg_cost_price: Number(p.avg_cost_price) || 0,
      sell_price: Number(p.sell_price) || 0,
      include_ppn: Boolean((p as { include_ppn?: boolean }).include_ppn),
      is_active: p.is_active,
    });
    setEditFormError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditFormError(null);

    const parseResult = productUpdateSchema.safeParse(editFormValues);
    if (!parseResult.success) {
      setEditFormError(parseResult.error.errors[0]?.message || "Input tidak valid");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({
          name: parseResult.data.name,
          dimension: parseResult.data.dimension || "",
          thickness_mm: parseResult.data.thickness_mm || 0,
          unit: parseResult.data.unit,
          stock_qty: parseResult.data.stock_qty,
          avg_cost_price: parseResult.data.avg_cost_price,
          sell_price: parseResult.data.sell_price,
          include_ppn: parseResult.data.include_ppn,
          is_active: parseResult.data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProduct.id);

      if (error) throw new Error(error.message);

      setEditingProduct(null);
      await loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui produk";
      setEditFormError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Katalog Stok & Harga</h1>
          <p className="text-sm text-slate-700">Manajemen ukuran, ketebalan, HPP rata-rata, PPN, dan stok barang.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-11 w-full sm:w-auto rounded bg-blue-900 px-5 text-sm font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
        >
          {showAddForm ? "Tutup Form Tambah" : "+ Tambah Produk Baru"}
        </button>
      </div>

      {/* Form Add Collapsible */}
      {showAddForm && (
        <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
            Tambah Produk Baru
          </h2>

          {addFormError && (
            <div role="alert" className="mb-4 rounded border border-red-300 bg-red-100 p-3 text-xs text-red-800">
              {addFormError}
            </div>
          )}

          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="add-sku" className="block text-xs font-medium text-slate-900">SKU (Kode Unik)</label>
              <input
                id="add-sku"
                type="text"
                required
                placeholder="Contoh: HG-40x40-1.2"
                value={addFormValues.sku}
                onChange={(e) => setAddFormValues({ ...addFormValues, sku: e.target.value })}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="add-name" className="block text-xs font-medium text-slate-900">Nama Produk</label>
              <input
                id="add-name"
                type="text"
                required
                placeholder="Contoh: Hollow Galvanis 40x40 atau Kawat Bendrat"
                value={addFormValues.name}
                onChange={(e) => setAddFormValues({ ...addFormValues, name: e.target.value })}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>

            <div>
              <label htmlFor="add-dimension" className="block text-xs font-medium text-slate-900">
                Dimensi Ukuran <span className="text-slate-500 font-normal">(Opsional)</span>
              </label>
              <input
                id="add-dimension"
                type="text"
                placeholder="Bisa dikosongkan jika non-profil"
                value={addFormValues.dimension}
                onChange={(e) => setAddFormValues({ ...addFormValues, dimension: e.target.value })}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>

            <div>
              <label htmlFor="add-thickness" className="block text-xs font-medium text-slate-900">
                Tebal mm <span className="text-slate-500 font-normal">(Opsional, isi 0 jika tidak ada)</span>
              </label>
              <input
                id="add-thickness"
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={addFormValues.thickness_mm || ""}
                onChange={(e) => setAddFormValues({ ...addFormValues, thickness_mm: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>

            <div>
              <label htmlFor="add-unit" className="block text-xs font-medium text-slate-900">Satuan Barang</label>
              <select
                id="add-unit"
                value={addFormValues.unit}
                onChange={(e) => setAddFormValues({ ...addFormValues, unit: e.target.value })}
                className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                {COMMON_PRODUCT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="add-stock" className="block text-xs font-medium text-slate-900">
                Stok Awal ({addFormValues.unit})
              </label>
              <input
                id="add-stock"
                type="number"
                min="0"
                required
                value={addFormValues.stock_qty}
                onChange={(e) => setAddFormValues({ ...addFormValues, stock_qty: parseInt(e.target.value) || 0 })}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>

            <div>
              <label htmlFor="add-cost" className="block text-xs font-medium text-slate-900">HPP Awal (Rp)</label>
              <input
                id="add-cost"
                type="number"
                step="any"
                min="0"
                required
                value={addFormValues.avg_cost_price}
                onChange={(e) => setAddFormValues({ ...addFormValues, avg_cost_price: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>

            <div>
              <label htmlFor="add-price" className="block text-xs font-medium text-slate-900">Harga Jual (Rp)</label>
              <input
                id="add-price"
                type="number"
                step="any"
                min="0"
                required
                value={addFormValues.sell_price}
                onChange={(e) => setAddFormValues({ ...addFormValues, sell_price: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-3 pt-2">
              <input
                id="add-include-ppn"
                type="checkbox"
                checked={addFormValues.include_ppn}
                onChange={(e) => setAddFormValues({ ...addFormValues, include_ppn: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
              />
              <label htmlFor="add-include-ppn" className="text-xs font-medium text-slate-900 select-none cursor-pointer">
                Harga Jual Sudah Termasuk PPN 11% (Include PPN)
              </label>
            </div>

            <div className="flex items-end sm:col-span-1">
              <button
                type="submit"
                disabled={isSubmittingAdd}
                className="h-10 w-full rounded bg-blue-900 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                {isSubmittingAdd ? "Menyimpan..." : "Simpan Produk"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-slate-300 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label htmlFor="dimension-filter" className="text-sm font-bold text-slate-900">Dimensi:</label>
          <select
            id="dimension-filter"
            value={dimensionFilter}
            onChange={(e) => setDimensionFilter(e.target.value)}
            className="h-11 w-full sm:w-auto rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
          >
            <option value="all">Semua Dimensi</option>
            <option value="none">Tanpa Dimensi (Non-Profil)</option>
            {dimensionsList.map((dim) => (
              <option key={dim} value={dim}>
                {dim}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2">
          <label htmlFor="search-input" className="text-sm font-bold text-slate-900">Cari:</label>
          <input
            id="search-input"
            type="text"
            placeholder="Ketik SKU atau nama produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
          />
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-100 p-4 text-xs text-red-800">
          <p className="font-semibold">Terjadi Kesalahan</p>
          <p className="mt-1">{errorMessage}</p>
          <button
            type="button"
            onClick={loadProducts}
            className="mt-3 h-10 rounded bg-red-800 px-4 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-md border border-slate-300 bg-white p-8 text-center text-xs font-medium text-slate-900">
          Memuat data stok...
        </div>
      )}

      {/* Table & Cards Container */}
      {!isLoading && !errorMessage && (
        <div>
          {filteredProducts.length === 0 ? (
            <div className="rounded-md border border-slate-300 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">
                Tidak ada data produk yang cocok dengan filter atau pencarian.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="flex flex-col gap-3 md:hidden">
                {filteredProducts.map((p) => {
                  const margin = Number(p.sell_price) - Number(p.avg_cost_price);
                  const isLowStock = p.stock_qty <= 20;
                  const itemUnit = p.unit || "BTG";
                  const hasThickness = Number(p.thickness_mm) > 0;
                  const hasDimension = Boolean(p.dimension && p.dimension.trim());
                  const isIncPpn = Boolean((p as { include_ppn?: boolean }).include_ppn);

                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border-2 border-slate-300 bg-white p-4 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 leading-snug">
                            {p.name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                              {p.sku}
                            </span>
                            {hasDimension && (
                              <span className="text-xs font-bold bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                                Dimensi: {p.dimension}
                              </span>
                            )}
                            {hasThickness && (
                              <span className="text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                                Tebal: {formatThickness(Number(p.thickness_mm))}
                              </span>
                            )}
                            <span className="text-xs font-bold bg-purple-50 text-purple-900 px-2 py-0.5 rounded border border-purple-200">
                              {itemUnit}
                            </span>
                            {isIncPpn && (
                              <span className="text-xs font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                                Inc. PPN
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          {p.is_active ? (
                            <span className="rounded border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                              Aktif
                            </span>
                          ) : (
                            <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              Nonaktif
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-md border border-slate-200">
                        <div>
                          <span className="block text-xs font-semibold text-slate-700">Stok Gudang</span>
                          <span className={`text-base font-bold tabular-nums ${isLowStock ? "text-red-800" : "text-slate-900"}`}>
                            {p.stock_qty} {itemUnit}
                          </span>
                          {isLowStock && (
                            <span className="block text-[11px] font-bold text-red-700">Stok Menipis</span>
                          )}
                        </div>
                        <div>
                          <span className="block text-xs font-semibold text-slate-700">Harga Jual</span>
                          <span className="text-base font-bold tabular-nums text-blue-950">
                            {formatRupiah(Number(p.sell_price))}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-semibold text-slate-700">HPP Rata-Rata</span>
                          <span className="text-sm font-semibold tabular-nums text-slate-800">
                            {formatRupiah(Number(p.avg_cost_price))}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-semibold text-slate-700">Margin Untung</span>
                          <span className="text-sm font-bold tabular-nums text-green-800">
                            +{formatRupiah(margin)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(p)}
                        className="h-11 w-full rounded border-2 border-blue-900 bg-blue-900 text-sm font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                      >
                        Ubah Stok, HPP & Harga Jual
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[950px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-100 font-semibold text-slate-900">
                        <th className="p-3.5 whitespace-nowrap">SKU</th>
                        <th className="p-3.5">Nama & Spesifikasi</th>
                        <th className="p-3.5 text-center whitespace-nowrap">Satuan</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Tebal</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Stok Gudang</th>
                        <th className="p-3.5 text-right whitespace-nowrap">HPP Rata-Rata</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Harga Jual</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Margin Untung</th>
                        <th className="p-3.5 text-center whitespace-nowrap">PPN</th>
                        <th className="p-3.5 text-center whitespace-nowrap">Status</th>
                        <th className="p-3.5 text-center whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredProducts.map((p) => {
                        const margin = Number(p.sell_price) - Number(p.avg_cost_price);
                        const isLowStock = p.stock_qty <= 20;
                        const itemUnit = p.unit || "BTG";
                        const hasThickness = Number(p.thickness_mm) > 0;
                        const hasDimension = Boolean(p.dimension && p.dimension.trim());
                        const isIncPpn = Boolean((p as { include_ppn?: boolean }).include_ppn);

                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-mono font-medium text-slate-900 whitespace-nowrap">{p.sku}</td>
                            <td className="p-3.5 text-slate-900 font-medium">
                              {p.name}
                              {hasDimension ? (
                                <span className="block text-xs text-slate-700 font-mono">
                                  Dimensi: {p.dimension}
                                </span>
                              ) : (
                                <span className="block text-xs text-slate-400 italic">
                                  Non-profil
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <span className="font-semibold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                                {itemUnit}
                              </span>
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-slate-900 whitespace-nowrap">
                              {hasThickness ? formatThickness(Number(p.thickness_mm)) : "-"}
                            </td>
                            <td className={`p-3.5 text-right tabular-nums font-bold whitespace-nowrap ${isLowStock ? "text-red-800" : "text-slate-900"}`}>
                              {p.stock_qty} {itemUnit}
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-slate-700 whitespace-nowrap">
                              {formatRupiah(Number(p.avg_cost_price))}
                            </td>
                            <td className="p-3.5 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {formatRupiah(Number(p.sell_price))}
                            </td>
                            <td className="p-3.5 text-right tabular-nums font-semibold text-green-800 whitespace-nowrap">
                              {formatRupiah(margin)}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              {isIncPpn ? (
                                <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900">
                                  Inc. PPN
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  Non-PPN
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              {p.is_active ? (
                                <span className="rounded border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                                  Aktif
                                </span>
                              ) : (
                                <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                  Nonaktif
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(p)}
                                className="h-10 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-blue-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                              >
                                Edit Data
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

      {/* Modal Edit Produk / Stok / HPP / PPN */}
      {editingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-md border border-slate-300 bg-white p-6 shadow-md max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Data Produk & Stok</h3>
                <p className="text-xs text-slate-700 font-mono">SKU: {editingProduct.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="h-10 rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                Tutup (Esc)
              </button>
            </div>

            {editFormError && (
              <div role="alert" className="mb-4 rounded border border-red-300 bg-red-100 p-3 text-xs text-red-800">
                {editFormError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-xs font-medium text-slate-900">Nama Produk</label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editFormValues.name}
                  onChange={(e) => setEditFormValues({ ...editFormValues, name: e.target.value })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-dimension" className="block text-xs font-medium text-slate-900">
                    Dimensi Ukuran <span className="text-slate-500 font-normal">(Opsional)</span>
                  </label>
                  <input
                    id="edit-dimension"
                    type="text"
                    placeholder="Bisa dikosongkan"
                    value={editFormValues.dimension}
                    onChange={(e) => setEditFormValues({ ...editFormValues, dimension: e.target.value })}
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                  />
                </div>

                <div>
                  <label htmlFor="edit-thickness" className="block text-xs font-medium text-slate-900">
                    Tebal mm <span className="text-slate-500 font-normal">(Opsional / 0)</span>
                  </label>
                  <input
                    id="edit-thickness"
                    type="number"
                    step="any"
                    min="0"
                    value={editFormValues.thickness_mm || ""}
                    onChange={(e) => setEditFormValues({ ...editFormValues, thickness_mm: parseFloat(e.target.value) || 0 })}
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-unit" className="block text-xs font-medium text-slate-900">Satuan Barang</label>
                <select
                  id="edit-unit"
                  value={editFormValues.unit}
                  onChange={(e) => setEditFormValues({ ...editFormValues, unit: e.target.value })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  {COMMON_PRODUCT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-stock" className="block text-xs font-medium text-slate-900">
                    Stok Gudang ({editFormValues.unit})
                  </label>
                  <input
                    id="edit-stock"
                    type="number"
                    min="0"
                    required
                    value={editFormValues.stock_qty}
                    onChange={(e) => setEditFormValues({ ...editFormValues, stock_qty: parseInt(e.target.value) || 0 })}
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                  />
                </div>

                <div>
                  <label htmlFor="edit-cost" className="block text-xs font-medium text-slate-900">HPP Rata-Rata (Rp)</label>
                  <input
                    id="edit-cost"
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editFormValues.avg_cost_price}
                    onChange={(e) => setEditFormValues({ ...editFormValues, avg_cost_price: parseFloat(e.target.value) || 0 })}
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-price" className="block text-xs font-medium text-slate-900">Harga Jual (Rp)</label>
                <input
                  id="edit-price"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={editFormValues.sell_price}
                  onChange={(e) => setEditFormValues({ ...editFormValues, sell_price: parseFloat(e.target.value) || 0 })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  id="edit-include-ppn"
                  type="checkbox"
                  checked={editFormValues.include_ppn}
                  onChange={(e) => setEditFormValues({ ...editFormValues, include_ppn: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <label htmlFor="edit-include-ppn" className="text-xs font-medium text-slate-900 select-none cursor-pointer">
                  Harga Jual Sudah Termasuk PPN 11% (Include PPN)
                </label>
              </div>

              <div>
                <label htmlFor="edit-status" className="block text-xs font-medium text-slate-900">Status Produk</label>
                <select
                  id="edit-status"
                  value={editFormValues.is_active ? "true" : "false"}
                  onChange={(e) => setEditFormValues({ ...editFormValues, is_active: e.target.value === "true" })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  <option value="true">Aktif (Tersedia untuk dijual)</option>
                  <option value="false">Nonaktif (Diarsipkan)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="h-10 rounded border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="h-10 rounded bg-blue-900 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  {isSubmittingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
