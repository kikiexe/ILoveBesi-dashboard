import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "Bensin & Pengiriman",
  "Listrik & Air",
  "Gaji & Upah Bongkar",
  "Konsumsi",
  "Lainnya",
] as const;

export const expenseSchema = z.object({
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  category: z.string().min(1, "Kategori operasional wajib dipilih"),
  amount: z.coerce.number().positive("Nominal biaya harus lebih besar dari 0"),
  notes: z.string().trim().optional().nullable(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
