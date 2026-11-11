export function formatCurrency(amount: number, symbol: string = '₹'): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formatted}`;
}
