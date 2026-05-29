import { parseMoney, roundMoney } from './money';
import { allocateNetToLineItems, getSaleSpecialsDiscount, getSaleVoucherDiscount } from './saleAmounts';

function paymentBucket(method) {
  const normalized = (method || 'unknown').toLowerCase();
  if (normalized === 'cash') return 'Cash';
  if (normalized === 'card') return 'Card';
  if (normalized === 'snapscan') return 'Snapscan';
  return 'Other';
}

/**
 * Net revenue per product, split by payment method (same shape as legacy report table).
 */
export function aggregateProductPaymentTotals(salesData) {
  const productTotals = {};

  for (const sale of salesData || []) {
    const bucket = paymentBucket(sale.payment?.method);
    const allocations = allocateNetToLineItems(sale);

    for (const line of allocations) {
      const name = line.name;
      if (!productTotals[name]) {
        productTotals[name] = {
          Product: name,
          Cash: 0,
          Card: 0,
          Snapscan: 0,
          Other: 0,
          Total: 0,
        };
      }
      const net = roundMoney(line.net);
      productTotals[name][bucket] += net;
      productTotals[name].Total += net;
    }
  }

  for (const name of Object.keys(productTotals)) {
    const row = productTotals[name];
    row.Cash = roundMoney(row.Cash);
    row.Card = roundMoney(row.Card);
    row.Snapscan = roundMoney(row.Snapscan);
    row.Other = roundMoney(row.Other);
    row.Total = roundMoney(row.Total);
  }

  return productTotals;
}

/** Sum of product table Total column — should match total net sales for the same sale set. */
export function sumAggregateProductTotals(productTotals) {
  return roundMoney(
    Object.values(productTotals || {}).reduce((sum, row) => sum + parseMoney(row.Total), 0)
  );
}

export function aggregatePromotionsSummary(salesData) {
  let specialsDiscount = 0;
  let voucherDiscount = 0;
  let salesWithSpecials = 0;

  for (const sale of salesData || []) {
    const specials = getSaleSpecialsDiscount(sale);
    const voucher = getSaleVoucherDiscount(sale);
    if (specials > 0) salesWithSpecials += 1;
    specialsDiscount += specials;
    voucherDiscount += voucher;
  }

  return {
    specialsDiscount: roundMoney(specialsDiscount),
    voucherDiscount: roundMoney(voucherDiscount),
    totalPromotions: roundMoney(specialsDiscount + voucherDiscount),
    salesWithSpecials,
    transactionCount: (salesData || []).length,
  };
}
