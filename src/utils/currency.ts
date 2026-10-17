export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "Rp 0";
  }

  const isWhole = Number.isInteger(amount);
  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  });

  return formatter.format(amount).replace(/\s+/g, " ");
}

export function formatThickness(mm: number): string {
  if (isNaN(mm) || mm === null || mm === undefined) {
    return "0.00 mm";
  }
  return `${mm.toFixed(2)} mm`;
}
