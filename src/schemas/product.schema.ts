import { z } from "zod";

export const productSchema = z.object({
  sku: z.string().trim().min(3, "SKU minimal 3 karakter"),
  name: z.string().trim().min(3, "Nama produk minimal 3 karakter"),
  dimension: z.string().trim().min(3, "Dimensi ukuran minimal 3 karakter"),
  thickness_mm: z.coerce.number().positive("Ketebalan harus lebih besar dari 0"),
  unit: z.string().default("BTG"),
  stock_qty: z.coerce.number().int().min(0, "Stok awal minimal 0"),
  avg_cost_price: z.coerce.number().min(0, "HPP tidak boleh bernilai negatif"),
  sell_price: z.coerce.number().min(0, "Harga jual tidak boleh bernilai negatif"),
  is_active: z.boolean().default(true),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const productUpdateSchema = z.object({
  name: z.string().trim().min(3, "Nama produk minimal 3 karakter"),
  dimension: z.string().trim().min(3, "Dimensi ukuran minimal 3 karakter"),
  thickness_mm: z.coerce.number().positive("Ketebalan harus lebih besar dari 0"),
  sell_price: z.coerce.number().min(0, "Harga jual tidak boleh bernilai negatif"),
  is_active: z.boolean(),
});

export type ProductUpdateFormValues = z.infer<typeof productUpdateSchema>;
