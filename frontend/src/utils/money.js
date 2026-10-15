// Amounts arrive as NUMERIC strings ("25000.00"). Formatting only --
// never converted between currencies or summed across them.
export function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === "") return "-";
  const value = Number(amount);
  const formatted = Number.isFinite(value)
    ? value.toLocaleString("tr-TR", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
      })
    : String(amount);
  return currency ? `${formatted} ${currency}` : formatted;
}
