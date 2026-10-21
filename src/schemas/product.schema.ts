import { z } from "zod";

export const COMMON_PRODUCT_UNITS = [
  { value: "BTG", label: "BTG (Batang)" },
  { value: "KG", label: "KG (Kilogram - Satuan Berat)" },
  { value: "TON", label: "TON (Ton - Satuan Berat)" },
  { value: "GRAM", label: "GRAM (Gram - Satuan Berat)" },
  { value: "LBR", label: "LBR (Lembar)" },
  { value: "PCS", label: "PCS (Buah / Pieces)" },
  { value: "MTR", label: "MTR (Meter)" },
  { value: "ROLL", label: "ROLL (Roll / Gulung)" },
  { value: "DUS", label: "DUS (Dus / Kotak)" },
  { value: "IKAT", label: "IKAT (Ikat)" },
  { value: "SET", label: "SET (Set)" },
] as const;

export const productSchema = z.object({
  sku: z.string().trim().min(2, "SKU minimal 2 karakter"),
  name: z.string().trim().min(2, "Nama produk minimal 2 karakter"),
  dimension: z.string().trim().default(""),
  thickness_mm: z.coerce.number().min(0, "Ketebalan tidak boleh bernilai negatif").default(0),
  unit: z.string().trim().min(1, "Satuan wajib diisi").default("BTG"),
  stock_qty: z.coerce.number().min(0, "Stok awal minimal 0"),
  avg_cost_price: z.coerce.number().min(0, "HPP tidak boleh bernilai negatif"),
  sell_price: z.coerce.number().min(0, "Harga jual tidak boleh bernilai negatif"),
  include_ppn: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const productUpdateSchema = z.object({
  name: z.string().trim().min(2, "Nama produk minimal 2 karakter"),
  dimension: z.string().trim().default(""),
  thickness_mm: z.coerce.number().min(0, "Ketebalan tidak boleh bernilai negatif").default(0),
  unit: z.string().trim().min(1, "Satuan wajib diisi").default("BTG"),
  stock_qty: z.coerce.number().min(0, "Stok tidak boleh bernilai negatif"),
  avg_cost_price: z.coerce.number().min(0, "HPP tidak boleh bernilai negatif"),
  sell_price: z.coerce.number().min(0, "Harga jual tidak boleh bernilai negatif"),
  include_ppn: z.boolean().default(false),
  is_active: z.boolean(),
});

export type ProductUpdateFormValues = z.infer<typeof productUpdateSchema>;
