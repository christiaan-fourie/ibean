import { parseMoney, roundMoney } from './money';

/** Gross line amount from stored item (prefers subtotal, else price × qty). */
export function getLineGross(item) {
  const subtotal = parseMoney(item?.subtotal);
  if (subtotal > 0) return subtotal;
  const price = parseMoney(item?.price);
  const qty = parseInt(item?.quantity, 10) || 0;
  return roundMoney(price * qty);
}

export function getSaleItemsGross(sale) {
  const items = sale?.items || [];
  return roundMoney(items.reduce((sum, item) => sum + getLineGross(item), 0));
}

export function getSaleSpecialsDiscount(sale) {
  const fromField = parseMoney(sale?.totalDiscount);
  if (fromField > 0) return fromField;
  const specials = sale?.appliedSpecials || [];
  return roundMoney(specials.reduce((sum, s) => sum + parseMoney(s?.savedAmount), 0));
}

export function getSaleVoucherDiscount(sale) {
  return roundMoney(parseMoney(sale?.voucher?.value));
}

/** Net amount paid — authoritative for reporting (uses sale.total when present). */
export function getSaleNetTotal(sale) {
  const stored = sale?.total;
  if (stored !== undefined && stored !== null && stored !== '') {
    return roundMoney(parseMoney(stored));
  }
  const gross =
    parseMoney(sale?.subtotalBeforeDiscounts) > 0
      ? parseMoney(sale.subtotalBeforeDiscounts)
      : getSaleItemsGross(sale);
  return roundMoney(
    gross - getSaleSpecialsDiscount(sale) - getSaleVoucherDiscount(sale)
  );
}

/** Total discount implied by gross − net (covers specials + vouchers). */
export function getSaleTotalDiscount(sale) {
  const gross =
    parseMoney(sale?.subtotalBeforeDiscounts) > 0
      ? parseMoney(sale.subtotalBeforeDiscounts)
      : getSaleItemsGross(sale);
  const net = getSaleNetTotal(sale);
  const implied = roundMoney(gross - net);
  if (implied > 0) return implied;
  return roundMoney(getSaleSpecialsDiscount(sale) + getSaleVoucherDiscount(sale));
}

/**
 * Allocate sale net revenue across line items pro-rata by gross subtotal.
 * Sum of returned nets matches getSaleNetTotal(sale) (within rounding).
 */
export function allocateNetToLineItems(sale) {
  const items = sale?.items || [];
  if (items.length === 0) return [];

  const lines = items.map((item, index) => ({
    index,
    name: item.name || 'Unknown Product',
    gross: getLineGross(item),
  }));

  const grossTotal = roundMoney(lines.reduce((sum, line) => sum + line.gross, 0));
  const netTotal = getSaleNetTotal(sale);

  if (grossTotal <= 0) {
    return lines.map((line) => ({ ...line, net: 0 }));
  }

  const roundedNets = lines.map((line) =>
    roundMoney((line.gross / grossTotal) * netTotal)
  );
  let sum = roundMoney(roundedNets.reduce((a, b) => a + b, 0));
  const diff = roundMoney(netTotal - sum);

  if (diff !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].gross > lines[maxIdx].gross) maxIdx = i;
    }
    roundedNets[maxIdx] = roundMoney(roundedNets[maxIdx] + diff);
  }

  return lines.map((line, i) => ({ ...line, net: roundedNets[i] }));
}
