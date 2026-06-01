'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import db from '../../../utils/firebase';
import { getStoreId } from '../../../utils/storeId';
import { useDashboardSession } from '../../components/DashboardSessionContext';
import { useCollectionLive } from '../../hooks/useCollectionLive';
import { useAuditActor } from '../../hooks/useAuditActor';
import { useToastNotification } from '../../hooks/useToastNotification';
import ToastNotification from '../../components/ToastNotification';


export default function Refunds() {
    const { user, staffAuth, isSessionReady } = useDashboardSession();
    const { hasAuditActor, getAuditActor } = useAuditActor();
    const { data: liveRefunds, isLoading: liveRefundsLoading, error: liveRefundsError } = useCollectionLive('refunds');
    const [loading, setLoading] = useState(false); // For form submission
    const { notification, notify, clearNotification } = useToastNotification();

    const initialRefundState = {
        productName: '',
        amount: '',
        reason: '',
        method: 'cash',
    };
    const [newRefund, setNewRefund] = useState(initialRefundState);

    const refunds = [...liveRefunds]
        .map((item) => ({
            ...item,
            date: item.date?.toDate ? item.date.toDate() : new Date(),
        }))
        .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

    useEffect(() => {
        if (!isSessionReady) return;

        if (!user) {
            notify("Please log in to manage refunds.", 'error');
            return;
        }

        if (liveRefundsError) {
            console.error('Error fetching refunds:', liveRefundsError);
            notify('Failed to load refunds in real-time.', 'error');
        }
    }, [user, isSessionReady, liveRefundsError, notify]);

    const pageLoading = isSessionReady && !!user && liveRefundsLoading;

    
    // Process refund
    const handleSubmitRefund = async (e) => {
        e.preventDefault();
        if (!newRefund.productName || !newRefund.amount || !newRefund.reason || !newRefund.method) {
            notify('Please fill in all required fields.', 'error');
            return;
        }
        if (!hasAuditActor) {
            notify('Staff authentication is missing. Cannot process refund.', 'error');
            return;
        }
        
        const storeIdentifier = getStoreId(user) || staffAuth?.storeId; 
        if (!storeIdentifier) {
            notify('Store identifier could not be determined.', 'error');
            return;
        }

        setLoading(true);

        const refundDataToSave = {
            productName: newRefund.productName,
            amount: parseFloat(newRefund.amount),
            reason: newRefund.reason,
            method: newRefund.method,
            staffName: staffAuth.staffName,
            date: Timestamp.fromDate(new Date()),
            storeId: storeIdentifier,
            createdBy: getAuditActor(),
        };

        try {
            await addDoc(collection(db, 'refunds'), refundDataToSave);
            notify('Refund processed successfully!', 'success');
            setNewRefund(initialRefundState); // Reset form
        } catch (err) {
            console.error('Error processing refund:', err);
            notify('Failed to process refund. ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewRefund(prev => ({ ...prev, [name]: value }));
    };

    const pageSkeleton = (
        <div className="h-full min-h-0 bg-neutral-900/40 p-3 text-neutral-50 md:p-4">
            <div className="mx-auto grid h-full min-h-0 max-w-7xl grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
                    <div className="mb-4 h-6 w-40 animate-pulse rounded bg-white/15" />
                    <div className="space-y-3">
                        <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
                            <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
                        </div>
                        <div className="h-28 animate-pulse rounded-2xl bg-white/10" />
                        <div className="h-12 animate-pulse rounded-2xl bg-blue-500/50" />
                    </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
                    <div className="mb-4 h-6 w-36 animate-pulse rounded bg-white/15" />
                    <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={`refund-row-skeleton-${index}`} className="h-20 animate-pulse rounded-2xl bg-white/10" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    if (!isSessionReady) {
         return pageSkeleton;
    }

    if (pageLoading && !user) {
         return pageSkeleton;
    }

    return (
        <div className="h-full min-h-0 bg-neutral-900/40 p-3 text-white md:p-4">
            <div className="mx-auto grid h-full min-h-0 max-w-7xl grid-cols-1 gap-3 lg:grid-cols-2">
                
                {/* Left Column: Form */}
                <div className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
                    <h2 className="mb-1 text-xl font-semibold text-white">Process New Refund</h2>
                    <p className="mb-5 text-sm text-neutral-400">Capture the item, method, and reason before submitting.</p>
                    <form onSubmit={handleSubmitRefund} className="space-y-5">
                        <div>
                            <label htmlFor="productName" className="block text-sm font-medium text-neutral-300 mb-1">
                                Product Name / Item
                            </label>
                            <input
                                type="text"
                                name="productName"
                                id="productName"
                                value={newRefund.productName}
                                onChange={handleInputChange}
                                placeholder="e.g. Cappuccino (Large)"
                                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-neutral-500 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                                required
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="amount" className="block text-sm font-medium text-neutral-300 mb-1">
                                    Refund Amount (R)
                                </label>
                                <input
                                    type="number"
                                    name="amount"
                                    id="amount"
                                    value={newRefund.amount}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0.00"
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-neutral-500 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="method" className="block text-sm font-medium text-neutral-300 mb-1">
                                    Refund Method
                                </label>
                                <select
                                    name="method"
                                    id="method"
                                    value={newRefund.method}
                                    onChange={handleInputChange}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                                    required
                                >
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="snapscan">SnapScan</option>
                                    <option value="store_credit">Store Credit</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="reason" className="block text-sm font-medium text-neutral-300 mb-1">
                                Reason for Refund
                            </label>
                            <textarea
                                name="reason"
                                id="reason"
                                value={newRefund.reason}
                                onChange={handleInputChange}
                                placeholder="Describe what happened..."
                                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-neutral-500 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                                rows="4"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !staffAuth || !user}
                            className="min-h-12 w-full rounded-2xl bg-blue-500 p-3 text-base font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-neutral-600"
                        >
                            {loading ? 'Processing...' : 'Process Refund'}
                        </button>
                    </form>
                </div>

                {/* Right Column: List */}
                <div className="flex min-h-0 flex-col rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
                    <h2 className="mb-1 text-xl font-semibold text-white">Recent Refunds</h2>
                    <p className="mb-4 text-sm text-neutral-400">Newest records appear first.</p>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                        {pageLoading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <div key={`recent-refund-skeleton-${index}`} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                            ))
                        ) : refunds.length > 0 ? (
                            refunds.map(refund => (
                                <div key={refund.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-grow">
                                            <p className="text-base font-semibold text-white">{refund.productName}</p>
                                            <p className="mt-1 text-sm font-medium text-blue-300">
                                                R {typeof refund.amount === 'number' ? refund.amount.toFixed(2) : refund.amount}
                                            </p>
                                            <p className="mt-2 text-sm text-neutral-300">
                                                {refund.reason}
                                            </p>
                                        </div>
                                        <div className="text-xs text-neutral-400 text-right flex-shrink-0">
                                            <p className="font-medium text-white">
                                                {refund.staffName || 'Unknown'}
                                            </p>
                                            <p className="capitalize">
                                                {refund.method?.replace('_', ' ') || 'N/A'}
                                            </p>
                                            <p>{refund.date ? refund.date.toLocaleDateString('en-ZA') : 'No date'}</p>
                                            <p>{refund.date ? refund.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-neutral-400">No refunds have been recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Toast Notification Area */}
            {notification.message && (
                <ToastNotification 
                    message={notification.message} 
                    type={notification.type} 
                    onClose={clearNotification}
                    duration={5000}
                    showCloseButton
                    containerClassName="fixed bottom-5 right-5 p-4 rounded-lg shadow-lg flex items-center gap-3 text-white border animate-fade-in-up"
                />
            )}
        </div>
    );
}
