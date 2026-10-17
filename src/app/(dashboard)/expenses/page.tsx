"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/utils/currency";
import {
  getWibTodayDateString,
  getWibCurrentMonthString,
  calculateMonthRange,
} from "@/utils/date";
import {
  expenseSchema,
  EXPENSE_CATEGORIES,
  type ExpenseFormValues,
} from "@/schemas/expense.schema";
import type { Tables } from "@/types/database.types";

type Expense = Tables<"operational_expenses">;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>(() => getWibCurrentMonthString());

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* Form State */
  const [formValues, setFormValues] = useState<ExpenseFormValues>({
    expense_date: getWibTodayDateString(),
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Delete Confirmation State */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      let query = supabase
        .from("operational_expenses")
        .select("*")
        .order("expense_date", { ascending: false });

      if (monthFilter && monthFilter !== "all") {
        const range = calculateMonthRange(monthFilter);
        if (range) {
          query = query.gte("expense_date", range.startOfMonth).lt("expense_date", range.endOfMonth);
        }
      }

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      setExpenses(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat daftar biaya operasional";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, monthFilter]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const validation = expenseSchema.safeParse(formValues);
    if (!validation.success) {
      setFormError(validation.error.errors[0]?.message || "Input biaya tidak valid");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Pengguna tidak terautentikasi");

      const { error } = await supabase.from("operational_expenses").insert({
        expense_date: validation.data.expense_date,
        category: validation.data.category,
        amount: validation.data.amount,
        notes: validation.data.notes || null,
        created_by: user.id,
      });

      if (error) throw new Error(error.message);

      setFormSuccess("Biaya operasional berhasil dicatat ke sistem.");
      setFormValues({
        expense_date: getWibTodayDateString(),
        category: EXPENSE_CATEGORIES[0],
        amount: 0,
        notes: "",
      });
      await loadExpenses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan pengeluaran";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan pengeluaran ini?")) {
      return;
    }

    setDeletingId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("operational_expenses").delete().eq("id", id);
      if (error) throw new Error(error.message);

      await loadExpenses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus catatan pengeluaran";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const totalExpenseAmount = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-300 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Biaya Operasional Toko</h1>
        <p className="text-xs text-slate-700">
          Pencatatan pengeluaran harian toko yang secara langsung mengurangi laba kotor untuk menghitung laba bersih riil.
        </p>
      </div>

      {/* Input Form Section */}
      <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
          Catat Pengeluaran Operasional Baru
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

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="expense-date" className="block text-xs font-medium text-slate-900">
              Tanggal Pengeluaran
            </label>
            <input
              id="expense-date"
              type="date"
              required
              value={formValues.expense_date}
              onChange={(e) => setFormValues({ ...formValues, expense_date: e.target.value })}
              className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            />
          </div>

          <div>
            <label htmlFor="expense-category" className="block text-xs font-medium text-slate-900">
              Kategori Biaya
            </label>
            <select
              id="expense-category"
              value={formValues.category}
              onChange={(e) => setFormValues({ ...formValues, category: e.target.value })}
              className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="expense-amount" className="block text-xs font-medium text-slate-900">
              Nominal (Rp)
            </label>
            <input
              id="expense-amount"
              type="number"
              step="100"
              min="1"
              required
              placeholder="Contoh: 150000"
              value={formValues.amount || ""}
              onChange={(e) => setFormValues({ ...formValues, amount: parseFloat(e.target.value) || 0 })}
              className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            />
          </div>

          <div>
            <label htmlFor="expense-notes" className="block text-xs font-medium text-slate-900">
              Keterangan / Bukti
            </label>
            <input
              id="expense-notes"
              type="text"
              placeholder="Contoh: Bensin armada truk engkel"
              value={formValues.notes || ""}
              onChange={(e) => setFormValues({ ...formValues, notes: e.target.value })}
              className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            />
          </div>

          <div className="sm:col-span-4 flex justify-end pt-2 border-t border-slate-200">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 rounded bg-blue-900 px-6 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
            </button>
          </div>
        </form>
      </div>

      {/* Filter and Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-300 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="month-filter" className="text-xs font-semibold text-slate-900">Filter Bulan:</label>
            <input
              id="month-filter"
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-10 rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            />
            {monthFilter ? (
              <button
                type="button"
                onClick={() => setMonthFilter("")}
                className="h-10 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                Semua Bulan
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="category-filter" className="text-xs font-semibold text-slate-900">Kategori:</label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            >
              <option value="all">Semua Kategori</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-900">
          Total Pengeluaran: <span className="tabular-nums text-red-800 text-sm">{formatRupiah(totalExpenseAmount)}</span>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-100 p-4 text-xs text-red-800">
          <p className="font-semibold">Terjadi Kesalahan</p>
          <p className="mt-1">{errorMessage}</p>
          <button
            type="button"
            onClick={loadExpenses}
            className="mt-3 h-10 rounded bg-red-800 px-4 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-md border border-slate-300 bg-white p-8 text-center text-xs font-medium text-slate-900">
          Memuat riwayat biaya operasional...
        </div>
      )}

      {/* Expenses History Table & Cards */}
      {!isLoading && !errorMessage && (
        <div>
          {expenses.length === 0 ? (
            <div className="rounded-md border border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-700 shadow-sm">
              Belum ada catatan pengeluaran operasional pada periode ini.
            </div>
          ) : (
            <>
              {/* 1. Mobile Card List (Senior-Friendly, Clear, High Contrast) */}
              <div className="flex flex-col gap-3 md:hidden">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="rounded-lg border-2 border-slate-300 bg-white p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-700">{exp.expense_date}</span>
                      <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-300">
                        {exp.category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">Nominal:</span>
                      <span className="text-xl font-bold tabular-nums text-red-800">
                        {formatRupiah(Number(exp.amount))}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs text-slate-800">
                      <span className="font-semibold block text-slate-700 text-[11px] mb-0.5">Keterangan:</span>
                      {exp.notes || "Tanpa keterangan"}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(exp.id)}
                      disabled={deletingId === exp.id}
                      className="h-11 w-full rounded border-2 border-red-300 bg-white text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                    >
                      {deletingId === exp.id ? "Menghapus..." : "Hapus Pengeluaran"}
                    </button>
                  </div>
                ))}
              </div>

              {/* 2. Desktop Table View (>= md) */}
              <div className="hidden md:block rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-100 font-semibold text-slate-900">
                        <th className="p-3.5 whitespace-nowrap">Tanggal</th>
                        <th className="p-3.5 whitespace-nowrap">Kategori</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Nominal</th>
                        <th className="p-3.5">Keterangan</th>
                        <th className="p-3.5 text-center whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="p-3.5 text-slate-700 whitespace-nowrap">{exp.expense_date}</td>
                          <td className="p-3.5 font-medium text-slate-900 whitespace-nowrap">{exp.category}</td>
                          <td className="p-3.5 text-right font-bold tabular-nums text-red-800 whitespace-nowrap">
                            {formatRupiah(Number(exp.amount))}
                          </td>
                          <td className="p-3.5 text-slate-700">{exp.notes || "Tanpa keterangan"}</td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDelete(exp.id)}
                              disabled={deletingId === exp.id}
                              className="h-10 rounded border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                            >
                              {deletingId === exp.id ? "Menghapus..." : "Hapus"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                        <td colSpan={2} className="p-3.5 text-right uppercase tracking-wider text-xs">
                          Total Periode:
                        </td>
                        <td className="p-3.5 text-right tabular-nums text-red-800 text-base">
                          {formatRupiah(totalExpenseAmount)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
