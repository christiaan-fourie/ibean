'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardSession } from './DashboardSessionContext';

export default function RouteGuard({ children, requiredRoles }) {
    const router = useRouter();
    const { staffAuth, isSessionReady } = useDashboardSession();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (!isSessionReady) return;
        if (!staffAuth?.accountType) {
            setAuthorized(false);
            router.replace('/dashboard');
            return;
        }

        if (!requiredRoles.includes(staffAuth.accountType)) {
            setAuthorized(false);
            router.replace('/dashboard');
            return;
        }

        setAuthorized(true);
    }, [isSessionReady, staffAuth, requiredRoles, router]);

    if (!isSessionReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-neutral-100">
                Loading...
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-neutral-100">
                Access Denied
            </div>
        );
    }

    return children;
}
