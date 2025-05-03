
import RouteGuard from '../../components/RouteGuard';

export default function Vouchers() { 
    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-neutral-100">
                <h1 className="text-2xl font-bold">Vouchers</h1>
            </div>
        </RouteGuard>
    );
}