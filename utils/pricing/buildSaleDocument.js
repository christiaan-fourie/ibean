import { parseMoney, roundMoney } from './money';
import { sumCartGross, sumSpecialsDiscount } from './orderTotals';

export function mapCartToSaleItems(orderDetails) {
  return (orderDetails || []).map((item) => {
    const itemPrice = parseMoney(item.price);
    const itemQuantity = parseInt(item.quantity, 10) || 0;
    return {
      id: item.id,
      name: item.name,
      size: item.size || null,
      quantity: itemQuantity,
      price: itemPrice,
      subtotal: roundMoney(itemPrice * itemQuantity),
    };
  });
}

function mapAppliedSpecials(appliedSpecials) {
  return (appliedSpecials || []).map((special) => ({
    id: special.id || '',
    name: special.name || '',
    triggerProduct: special.triggerProduct || '',
    rewardProduct: special.rewardProduct || '',
    discountType: special.discountType || 'free',
    discountValue: parseMoney(special.discountValue),
    fixedDiscountAmount: parseMoney(special.fixedDiscountAmount),
    savedAmount: parseMoney(special.savedAmount),
    ...(special.instanceNumber && { instanceNumber: special.instanceNumber }),
    ...(special.totalInstances && { totalInstances: special.totalInstances }),
  }));
}

/**
 * Build Firestore-ready sale payload (without server timestamps).
 * Caller adds `date: serverTimestamp()` before write.
 */
export function buildSaleDocument({
  storeId,
  storeName,
  staffAuth,
  orderDetails,
  appliedSpecials,
  netTotal,
  paymentMethod,
  payment = {},
  voucher = null,
}) {
  const subtotalBeforeDiscounts = sumCartGross(orderDetails);
  const totalDiscount = sumSpecialsDiscount(appliedSpecials);

  const doc = {
    storeId,
    storeName,
    staffId: staffAuth.staffId,
    staffName: staffAuth.staffName,
    staffRole: staffAuth.accountType,
    items: mapCartToSaleItems(orderDetails),
    appliedSpecials: mapAppliedSpecials(appliedSpecials),
    subtotalBeforeDiscounts,
    totalDiscount,
    total: roundMoney(netTotal),
    payment: {
      method: paymentMethod,
      ...payment,
    },
    paymentStatus: 'completed',
    orderNumber: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: 'pos_system',
  };

  if (voucher) {
    doc.voucher = voucher;
  }

  return doc;
}
