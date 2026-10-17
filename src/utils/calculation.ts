export function calculateMovingAverage(
  oldStock: number,
  oldAvgCost: number,
  buyQty: number,
  buyPrice: number
): number {
  const safeOldStock = Math.max(0, Number(oldStock) || 0);
  const safeOldAvgCost = Math.max(0, Number(oldAvgCost) || 0);
  const safeBuyQty = Math.max(0, Number(buyQty) || 0);
  const safeBuyPrice = Math.max(0, Number(buyPrice) || 0);

  const totalQty = safeOldStock + safeBuyQty;
  if (totalQty <= 0) {
    return safeBuyPrice;
  }

  const totalValue = (safeOldStock * safeOldAvgCost) + (safeBuyQty * safeBuyPrice);
  return Math.round((totalValue / totalQty) * 100) / 100;
}

export interface NetProfitResult {
  grossProfit: number;
  netProfit: number;
}

export function calculateNetProfit(
  grossSales: number,
  totalCogs: number,
  totalExpenses: number
): NetProfitResult {
  const safeGrossSales = Number(grossSales) || 0;
  const safeTotalCogs = Number(totalCogs) || 0;
  const safeTotalExpenses = Number(totalExpenses) || 0;

  const grossProfit = Math.round((safeGrossSales - safeTotalCogs) * 100) / 100;
  const netProfit = Math.round((grossProfit - safeTotalExpenses) * 100) / 100;

  return {
    grossProfit,
    netProfit,
  };
}
