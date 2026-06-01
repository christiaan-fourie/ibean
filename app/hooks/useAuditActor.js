'use client';

import { useDashboardSession } from '../components/DashboardSessionContext';

export function useAuditActor() {
  const { staffAuth } = useDashboardSession();

  const hasAuditActor = Boolean(staffAuth?.staffId && staffAuth?.staffName);

  const getAuditActor = (fallbackRole = 'staff') => ({
    id: staffAuth?.staffId || null,
    name: staffAuth?.staffName || null,
    role: staffAuth?.accountType || fallbackRole,
  });

  return { hasAuditActor, getAuditActor };
}
