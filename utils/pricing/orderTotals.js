import { parseMoney, roundMoney } from './money';

export function sumCartGross(orderDetails) {
  return roundMoney(
    (orderDetails || []).reduce(
      (sum, item) =>
        sum + parseMoney(item.price) * (parseInt(item.quantity, 10) || 0),
      0
    )
  );
}

export function sumSpecialsDiscount(appliedSpecials) {
  return roundMoney(
    (appliedSpecials || []).reduce(
      (sum, special) => sum + parseMoney(special.savedAmount),
      0
    )
  );
}

/**
 * POS cart totals (matches checkout UI).
 * @param {Array} orderDetails
 * @param {Array} appliedSpecials
 * @param {number} vatRate e.g. 0.14 for 14% VAT included in prices
 */
export function calculateOrderTotals(orderDetails, appliedSpecials, vatRate = 14 / 100) {
  const subtotalBeforeDiscount = sumCartGross(orderDetails);
  const specialsDiscount = sumSpecialsDiscount(appliedSpecials);
  const finalSubtotal = roundMoney(subtotalBeforeDiscount - specialsDiscount);
  const tax = roundMoney((finalSubtotal / (1 + vatRate)) * vatRate);

  return {
    subtotalBeforeDiscount,
    specialsDiscount,
    tax,
    total: finalSubtotal,
  };
}
