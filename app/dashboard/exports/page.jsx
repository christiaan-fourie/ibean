import RouteGuard from '../../components/RouteGuard';

export default function Exports() {
    return (
        <RouteGuard requiredRoles={['manager']}>
            
        <div className="flex min-h-screen p-4 bg-neutral-900 text-neutral-50">
            <h1 className="text-2xl font-bold">Exports</h1>
        </div>
        </RouteGuard>
    );
}