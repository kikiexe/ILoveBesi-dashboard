import { z } from "zod";

export const receivablePaymentSchema = z.object({
  sale_id: z.string().uuid("ID faktur penjualan tidak valid"),
  amount: z.coerce.number().positive("Nominal cicilan harus lebih besar dari 0"),
  payment_method: z.enum(["TUNAI", "TRANSFER"], {
    errorMap: () => ({ message: "Metode pembayaran harus TUNAI atau TRANSFER" }),
  }),
  notes: z.string().trim().optional().nullable(),
});

export type ReceivablePaymentFormValues = z.infer<typeof receivablePaymentSchema>;
