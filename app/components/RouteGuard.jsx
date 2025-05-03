'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RouteGuard({ children, requiredRoles }) {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        checkAuthorization();
    }, []);

    const checkAuthorization = () => {
        const staffAuth = localStorage.getItem('staffAuth');
        if (!staffAuth) {
            setAuthorized(false);
            router.push('/dashboard');
            return;
        }

        const { accountType } = JSON.parse(staffAuth);
        if (!requiredRoles.includes(accountType)) {
            setAuthorized(false);
            router.push('/dashboard');
            return;
        }

        setAuthorized(true);
    };

    if (!authorized) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-neutral-100">
                Access Denied
            </div>
        );
    }

    return children;
}