/** Known Chillzone store Firebase Auth accounts (canonical storeId = email). */
export const CHILLZONE_STORES = [
  { id: 'zeven@iclick.co.za', name: 'Zevenwacht Mall' },
  { id: 'westgate@iclick.co.za', name: 'Westgate Mall' },
];

export function getStoreDisplayName(storeId) {
  if (!storeId) return 'Unknown store';
  const match = CHILLZONE_STORES.find((s) => s.id === storeId);
  return match?.name || storeId;
}
