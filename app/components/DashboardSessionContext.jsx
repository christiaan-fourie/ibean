'use client';

import { createContext, useContext } from 'react';

const DashboardSessionContext = createContext({
  user: null,
  staffAuth: null,
  isSessionReady: false,
  endShift: () => {}
});

export function DashboardSessionProvider({ value, children }) {
  return (
    <DashboardSessionContext.Provider value={value}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}
