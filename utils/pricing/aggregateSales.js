import { parseMoney, roundMoney } from './money';
import {
  getLineGross,
  getSaleItemsGross,
  getSaleNetTotal,
  getSaleSpecialsDiscount,
  getSaleTotalDiscount,
  getSaleVoucherDiscount,
} from './saleAmounts';

function paymentBucket(method) {
  const normalized = (method || 'unknown').toLowerCase();
  if (normalized === 'cash') return 'Cash';
  if (normalized === 'card') return 'Card';
  if (normalized === 'snapscan') return 'Snapscan';
  return 'Other';
}

/**
 * Gross revenue per product (sum of items[].subtotal in ZAR — same as Firestore line amounts).
 * Discounts are not spread across products; see aggregateSalesReconciliation + aggregateSpecialsBreakdown.
 */
export function aggregateProductPaymentTotals(salesData) {
  const productTotals = {};

  for (const sale of salesData || []) {
    const bucket = paymentBucket(sale.payment?.method);

    for (const item of sale.items || []) {
      const name = item.name || 'Unknown Product';
      const gross = getLineGross(item);
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
      productTotals[name][bucket] += gross;
      productTotals[name].Total += gross;
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

/** Sum of product table Total column — should match reconciliation gross for the same sale set. */
export function sumAggregateProductTotals(productTotals) {
  return roundMoney(
    Object.values(productTotals || {}).reduce((sum, row) => sum + parseMoney(row.Total), 0)
  );
}

/** Gross / promotions / net — matches Firestore sale header fields. */
export function aggregateSalesReconciliation(salesData) {
  let gross = 0;
  let promotions = 0;
  let net = 0;

  for (const sale of salesData || []) {
    const saleGross =
      parseMoney(sale?.subtotalBeforeDiscounts) > 0
        ? parseMoney(sale.subtotalBeforeDiscounts)
        : getSaleItemsGross(sale);
    gross += saleGross;
    promotions += getSaleTotalDiscount(sale);
    net += getSaleNetTotal(sale);
  }

  return {
    gross: roundMoney(gross),
    promotions: roundMoney(promotions),
    net: roundMoney(net),
    transactionCount: (salesData || []).length,
  };
}

/** Roll up appliedSpecials from all sales (e.g. "Brownies 4 for 3" × N, R total saved). */
export function aggregateSpecialsBreakdown(salesData) {
  const byKey = {};

  for (const sale of salesData || []) {
    for (const special of sale.appliedSpecials || []) {
      const name = special.name || special.id || 'Unknown special';
      const key = special.id || name;
      if (!byKey[key]) {
        byKey[key] = { id: key, name, timesApplied: 0, totalSaved: 0 };
      }
      byKey[key].timesApplied += 1;
      byKey[key].totalSaved += parseMoney(special.savedAmount);
    }
  }

  return Object.values(byKey)
    .map((row) => ({ ...row, totalSaved: roundMoney(row.totalSaved) }))
    .sort((a, b) => b.totalSaved - a.totalSaved);
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
