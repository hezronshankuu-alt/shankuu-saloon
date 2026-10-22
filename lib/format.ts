export function tzs(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency", currency: "TZS", maximumFractionDigits: 0,
  }).format(amount);
}
