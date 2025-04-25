// /home/krist/dev/ibean/app/context/StoreContext.js
'use client';

import React, { createContext, useState, useContext, useMemo } from 'react';

// Define your stores here (or fetch from Firestore later if needed)
const AVAILABLE_STORES = ["Zevenwacht", "Westgate"];

const StoreContext = createContext();

export const StoreProvider = ({ children }) => {
  // Default to the first store or load from localStorage if previously selected
  const [selectedStore, setSelectedStore] = useState(() => {
     if (typeof window !== 'undefined') {
        const savedStore = localStorage.getItem('selectedStore');
        return AVAILABLE_STORES.includes(savedStore) ? savedStore : AVAILABLE_STORES[0];
     }
     return AVAILABLE_STORES[0]; // Default for server-side rendering
  });

  const handleSetSelectedStore = (storeName) => {
    if (AVAILABLE_STORES.includes(storeName)) {
      setSelectedStore(storeName);
      if (typeof window !== 'undefined') {
         localStorage.setItem('selectedStore', storeName); // Persist selection
      }
    } else {
        console.warn(`Attempted to select invalid store: ${storeName}`);
    }
  };

  // useMemo prevents unnecessary re-renders if context value object doesn't change identity
  const value = useMemo(() => ({
    availableStores: AVAILABLE_STORES,
    selectedStore,
    setSelectedStore: handleSetSelectedStore,
  }), [selectedStore]); // Only re-create value object when selectedStore changes

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

// Custom hook for easy consumption
export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
