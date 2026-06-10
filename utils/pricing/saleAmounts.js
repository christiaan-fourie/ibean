import { fromCents, parseMoney, roundMoney, toCents } from './money';

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
 * Net revenue per line item.
 * Starts from actual line subtotal and only subtracts discounts that can be
 * tied back to a matching reward product. Generic sale-level discounts are
 * kept out of product rows so product prices are not distorted.
 */
export function allocateNetToLineItems(sale) {
  const items = sale?.items || [];
  if (items.length === 0) return [];

  const lines = items.map((item, index) => {
    const quantity = parseInt(item?.quantity, 10);
    const gross = getLineGross(item);
    return {
      index,
      id: item.id || '',
      name: item.name || 'Unknown Product',
      category: item.category || '',
      size: item.size || '',
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      gross,
      grossCents: toCents(gross),
      netCents: toCents(gross),
    };
  });

  for (const special of sale?.appliedSpecials || []) {
    const discountCents = toCents(special?.savedAmount);
    if (discountCents <= 0) continue;

    const productId = special.rewardProduct || special.triggerProduct || '';
    const category = special.rewardCategory || special.triggerCategory || '';
    const requiredSize = special.rewardProductSize ||
      special.rewardCategorySize ||
      special.triggerProductSize ||
      special.triggerCategorySize ||
      '';
    if (!productId && !category) continue;

    const matchingLines = lines.filter((line) => {
      const itemProductId = String(line.id).split('_')[0];
      const productMatches = productId && (itemProductId === productId || line.id === productId);
      const categoryMatches = category && line.category === category;
      const sizeMatches =
        !requiredSize ||
        String(line.size).toLowerCase() === String(requiredSize).toLowerCase();
      return (productMatches || categoryMatches) && sizeMatches;
    });

    if (matchingLines.length === 0) continue;

    let remainingDiscountCents = Math.min(
      discountCents,
      matchingLines.reduce((sum, line) => sum + line.netCents, 0)
    );

    for (const line of matchingLines) {
      if (remainingDiscountCents <= 0) break;
      const lineDiscountCents = Math.min(line.netCents, remainingDiscountCents);
      line.netCents -= lineDiscountCents;
      remainingDiscountCents -= lineDiscountCents;
    }
  }

  return lines.map(({ grossCents, ...line }) => ({ ...line, net: fromCents(line.netCents) }));
}
