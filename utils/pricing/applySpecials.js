import { parseMoney, roundMoney } from './money';
import { documentBelongsToStore } from '../storeId';

function isMutuallyExclusiveFlag(value) {
  return value === true || value === 'on';
}

/** Active specials for today, sorted (exclusive specials first). */
export function filterActiveSpecials(allSpecials, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  return (allSpecials || [])
    .filter((special) => {
      const startDate = special.startDate ? new Date(special.startDate) : null;
      const endDate = special.endDate ? new Date(special.endDate) : null;
      return (
        special.active &&
        (!startDate || today >= startDate) &&
        (!endDate || today <= endDate)
      );
    })
    .sort((a, b) => {
      const isBExclusive = isMutuallyExclusiveFlag(b.mutuallyExclusive);
      const isAExclusive = isMutuallyExclusiveFlag(a.mutuallyExclusive);
      return (isBExclusive ? 1 : 0) - (isAExclusive ? 1 : 0);
    });
}

/** Store-scoped active specials for POS. */
export function filterSpecialsForStore(allSpecials, user, referenceDate = new Date()) {
  return filterActiveSpecials(allSpecials, referenceDate).filter((special) =>
    documentBelongsToStore(special.storeId, user)
  );
}

/**
 * Compute applied specials for a cart (single source of truth for checkout).
 * @returns {Array} applied special instances with savedAmount
 */
export function applySpecialsToOrder(orderDetails, allSpecials, user = null) {
  const validSpecials = user
    ? filterSpecialsForStore(allSpecials, user)
    : filterActiveSpecials(allSpecials);

  const newAppliedSpecials = [];
  let hasAppliedMutuallyExclusiveSpecial = false;

  validSpecials.forEach((special) => {
    const isMutuallyExclusive = isMutuallyExclusiveFlag(special.mutuallyExclusive);
    if (
      hasAppliedMutuallyExclusiveSpecial ||
      (isMutuallyExclusive && newAppliedSpecials.length > 0)
    ) {
      return;
    }

    const findItems = (type, productOrCategory, requiredSize) =>
      (orderDetails || []).filter((item) => {
        if (!item) return false;
        const itemMatchesType =
          type === 'product'
            ? item.id.startsWith(productOrCategory)
            : item.category === productOrCategory;
        if (!itemMatchesType) return false;
        if (requiredSize) {
          const itemSize = item.size || item.id.split('_')[1];
          return itemSize && itemSize.toLowerCase() === requiredSize.toLowerCase();
        }
        return true;
      });

    const triggerItems = findItems(
      special.triggerType,
      special.triggerProduct || special.triggerCategory,
      special.triggerProductSize || special.triggerCategorySize
    );
    const rewardItems = findItems(
      special.rewardType,
      special.rewardProduct || special.rewardCategory,
      special.rewardProductSize || special.rewardCategorySize
    );

    const totalTriggerQuantity = triggerItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    if (totalTriggerQuantity < Number(special.triggerQuantity || 0)) return;

    const triggerAndRewardAreTheSame =
      special.triggerType === special.rewardType &&
      (special.triggerProduct || special.triggerCategory) ===
        (special.rewardProduct || special.rewardCategory) &&
      (special.triggerProductSize || special.triggerCategorySize) ===
        (special.rewardProductSize || special.rewardCategorySize);

    let applications = 0;
    if (triggerAndRewardAreTheSame) {
      const itemsPerApplication =
        Number(special.triggerQuantity || 0) + Number(special.rewardQuantity || 0);
      applications = Math.floor(totalTriggerQuantity / itemsPerApplication);
    } else {
      const triggerApplications = Math.floor(
        totalTriggerQuantity / Number(special.triggerQuantity || 1)
      );
      const totalRewardQuantity = rewardItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );
      const rewardApplications = Math.floor(
        totalRewardQuantity / Number(special.rewardQuantity || 1)
      );
      applications = Math.min(triggerApplications, rewardApplications);
    }

    if (applications <= 0) return;

    const expandItems = (items) => {
      const expanded = [];
      items.forEach((item) => {
        for (let i = 0; i < Number(item.quantity || 0); i++) {
          expanded.push({ ...item, quantity: 1 });
        }
      });
      return expanded;
    };

    const expandedRewardItems = expandItems(
      triggerAndRewardAreTheSame ? triggerItems : rewardItems
    );
    const rewardQuantityPerApp = Number(special.rewardQuantity || 0);

    for (let appIndex = 0; appIndex < applications; appIndex++) {
      const startIdx = appIndex * rewardQuantityPerApp;
      const instanceRewardItems = expandedRewardItems.slice(
        startIdx,
        startIdx + rewardQuantityPerApp
      );

      if (instanceRewardItems.length === 0) continue;

      let instanceSavedAmount = 0;

      instanceRewardItems.forEach((rewardItem) => {
        const linePrice = parseMoney(rewardItem.price);
        if (special.discountType === 'free') {
          instanceSavedAmount += linePrice;
        } else if (special.discountType === 'percentage') {
          const discountValue = parseMoney(special.discountValue);
          instanceSavedAmount += linePrice * (discountValue / 100);
        } else if (special.discountType === 'fixed') {
          const fixedPerItem =
            parseMoney(special.fixedDiscountAmount) / rewardQuantityPerApp;
          instanceSavedAmount += Math.min(linePrice, fixedPerItem);
        }
      });

      instanceSavedAmount = roundMoney(instanceSavedAmount);

      if (instanceSavedAmount > 0) {
        newAppliedSpecials.push({
          ...special,
          savedAmount: instanceSavedAmount,
          instanceNumber: applications > 1 ? appIndex + 1 : null,
          totalInstances: applications > 1 ? applications : null,
        });
      }
    }

    if (isMutuallyExclusive && newAppliedSpecials.length > 0) {
      hasAppliedMutuallyExclusiveSpecial = true;
    }
  });

  return newAppliedSpecials;
}

export function appliedSpecialsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].savedAmount !== b[i].savedAmount ||
      a[i].instanceNumber !== b[i].instanceNumber
    ) {
      return false;
    }
  }
  return true;
}
