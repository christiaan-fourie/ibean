/**
 * Canonical storeId = Firebase Auth email (matches sales, refunds, reports).
 * Legacy documents may use auth.uid — include both in queries/filters during transition.
 */

export function getStoreId(user) {
  if (!user) return null;
  return user.email || null;
}

/** Values that identify the current store session (email + legacy uid). */
export function getStoreIdCandidates(user) {
  if (!user) return [];
  const ids = [];
  if (user.email) ids.push(user.email);
  if (user.uid && user.uid !== user.email) ids.push(user.uid);
  return ids;
}

/** True if a document belongs to this store (missing storeId = legacy global). */
export function documentBelongsToStore(docStoreId, user) {
  if (!docStoreId) return true;
  return getStoreIdCandidates(user).includes(docStoreId);
}

export function saleBelongsToSelectedStore(sale, selectedStore) {
  if (!selectedStore || selectedStore === 'All stores') return true;
  return sale?.storeId === selectedStore;
}
