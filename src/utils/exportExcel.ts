import * as XLSX from "xlsx";
import type { Tables } from "@/types/database.types";

type Sale = Tables<"sales">;

export interface SaleExportItem extends Sale {
  customer_name?: string;
}

export function exportSalesReportToExcel(sales: SaleExportItem[], title = "Laporan_Penjualan") {
  if (!sales || sales.length === 0) {
    alert("Tidak ada data penjualan untuk diekspor.");
    return;
  }

  const rows = sales.map((sale, index) => {
    const dateFormatted = new Date(sale.sale_date).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const dueDateFormatted = sale.due_date
      ? new Date(sale.due_date).toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "-";

    return {
      "No": index + 1,
      "No. Faktur": sale.invoice_number,
      "Tanggal (WIB)": dateFormatted,
      "Pelanggan": sale.customer_name || "Pelanggan Umum",
      "Kasir": sale.cashier_name || "-",
      "Metode Pembayaran": sale.payment_type,
      "Status": sale.payment_status === "LUNAS" ? "Lunas" : "Belum Lunas",
      "Subtotal (Rp)": Number(sale.subtotal_amount || 0),
      "Diskon (Rp)": Number(sale.discount_amount || 0),
      "PPN (Rp)": Number(sale.tax_amount || 0),
      "Grand Total (Rp)": Number(sale.grand_total || 0),
      "Terbayar (Rp)": Number(sale.paid_amount || 0),
      "Sisa Piutang (Rp)": Number(sale.remaining_debt || 0),
      "Jatuh Tempo": dueDateFormatted,
      "Catatan": sale.notes || "-",
    };
  });

  // Calculate totals
  const totalSubtotal = sales.reduce((sum, s) => sum + Number(s.subtotal_amount || 0), 0);
  const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0);
  const totalTax = sales.reduce((sum, s) => sum + Number(s.tax_amount || 0), 0);
  const totalGrand = sales.reduce((sum, s) => sum + Number(s.grand_total || 0), 0);
  const totalPaid = sales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
  const totalDebt = sales.reduce((sum, s) => sum + Number(s.remaining_debt || 0), 0);

  // Append summary row
  rows.push({
    "No": "" as unknown as number,
    "No. Faktur": "TOTAL AKUMULASI",
    "Tanggal (WIB)": "",
    "Pelanggan": "",
    "Kasir": "",
    "Metode Pembayaran": "",
    "Status": "",
    "Subtotal (Rp)": totalSubtotal,
    "Diskon (Rp)": totalDiscount,
    "PPN (Rp)": totalTax,
    "Grand Total (Rp)": totalGrand,
    "Terbayar (Rp)": totalPaid,
    "Sisa Piutang (Rp)": totalDebt,
    "Jatuh Tempo": "",
    "Catatan": "",
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set explicit column widths
  worksheet["!cols"] = [
    { wch: 6 },  // No
    { wch: 18 }, // No Faktur
    { wch: 18 }, // Tanggal
    { wch: 24 }, // Pelanggan
    { wch: 16 }, // Kasir
    { wch: 18 }, // Metode
    { wch: 14 }, // Status
    { wch: 16 }, // Subtotal
    { wch: 14 }, // Diskon
    { wch: 14 }, // PPN
    { wch: 18 }, // Grand Total
    { wch: 16 }, // Terbayar
    { wch: 16 }, // Sisa Piutang
    { wch: 14 }, // Jatuh Tempo
    { wch: 25 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Penjualan");

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, "");
  const filename = `${title}_${dateStr}_${timeStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
