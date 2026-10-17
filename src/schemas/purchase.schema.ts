import { z } from "zod";

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid("ID produk tidak valid"),
  qty: z.coerce.number().int().positive("Jumlah batang harus lebih dari 0"),
  buy_price: z.coerce.number().min(0, "Harga beli tidak boleh negatif"),
});

export const purchaseSchema = z.object({
  invoice_number: z.string().trim().min(1, "Nomor nota kulakan wajib diisi"),
  supplier_id: z.string().uuid("Supplier wajib dipilih"),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  notes: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, "Minimal harus ada 1 barang kulakan"),
});

export type PurchaseFormValues = z.infer<typeof purchaseSchema>;
export type PurchaseItemFormValues = z.infer<typeof purchaseItemSchema>;

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Nama supplier minimal 2 karakter"),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;
