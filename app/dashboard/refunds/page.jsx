'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import db from '../../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../utils/firebase';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

// Toast Notification Component for better UX
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000); // Auto-dismiss after 5 seconds
        return () => clearTimeout(timer);
    }, [onClose]);

    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'bg-green-600/30 border-green-500' : 'bg-red-600/30 border-red-500';
    const icon = isSuccess ? <FaCheckCircle className="text-green-400" /> : <FaExclamationCircle className="text-red-400" />;

    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-lg flex items-center gap-3 text-white border ${bgColor} animate-fade-in-up`}>
            {icon}
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 text-xl font-light">&times;</button>
        </div>
    );
};


export default function Refunds() {
    const [user, loadingAuth, errorAuth] = useAuthState(auth);
    const [refunds, setRefunds] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const [loading, setLoading] = useState(false); // For form submission
    const [pageLoading, setPageLoading] = useState(true); // For initial data load
    const [notification, setNotification] = useState({ message: '', type: '' });

    const initialRefundState = {
        productName: '',
        amount: '',
        reason: '',
        method: 'cash',
    };
    const [newRefund, setNewRefund] = useState(initialRefundState);

    // Get staff authentication from localStorage
    useEffect(() => {
        const authData = localStorage.getItem('staffAuth');
        if (authData) {
            try {
                setStaffAuth(JSON.parse(authData));
            } catch (e) {
                console.error("Failed to parse staffAuth:", e);
                setNotification({ message: "Error loading staff authentication.", type: 'error' });
            }
        } else if (!loadingAuth) {
            setNotification({ message: "Staff authentication not found. Please log in.", type: 'error' });
        }
    }, [loadingAuth]);

    // Fetch existing refunds in REAL-TIME
    useEffect(() => {
        if (!user) {
            if (!loadingAuth) {
                setPageLoading(false);
                setNotification({ message: "Please log in to manage refunds.", type: 'error' });
            }
            return;
        }

        setPageLoading(true);
        const q = query(collection(db, 'refunds'), orderBy('date', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const refundsData = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date(),
                };
            });
            setRefunds(refundsData);
            setPageLoading(false);
        }, (err) => {
            console.error('Error fetching refunds:', err);
            setNotification({ message: 'Failed to load refunds in real-time.', type: 'error' });
            setPageLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();

    }, [user, loadingAuth]);

    
    // Process refund
    const handleSubmitRefund = async (e) => {
        e.preventDefault();
        if (!newRefund.productName || !newRefund.amount || !newRefund.reason || !newRefund.method) {
            setNotification({ message: 'Please fill in all required fields.', type: 'error' });
            return;
        }
        if (!staffAuth || !staffAuth.staffId || !staffAuth.staffName) {
            setNotification({ message: 'Staff authentication is missing. Cannot process refund.', type: 'error' });
            return;
        }
        
        const storeIdentifier = staffAuth.storeId || user?.email; 
        if (!storeIdentifier) {
            setNotification({ message: 'Store identifier could not be determined.', type: 'error' });
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
            createdBy: {
                id: staffAuth.staffId,
                name: staffAuth.staffName,
                role: staffAuth.accountType || 'staff',
            },
        };

        try {
            await addDoc(collection(db, 'refunds'), refundDataToSave);
            setNotification({ message: 'Refund processed successfully!', type: 'success' });
            setNewRefund(initialRefundState); // Reset form
        } catch (err) {
            console.error('Error processing refund:', err);
            setNotification({ message: 'Failed to process refund. ' + err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewRefund(prev => ({ ...prev, [name]: value }));
    };

    if (pageLoading && !user && !errorAuth) {
         return <div className="min-h-screen bg-neutral-900 p-8 text-white text-center">Loading authentication...</div>;
    }

    return (
        <div className="min-h-screen bg-neutral-900 p-4 md:p-8 text-white">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
                
                {/* Left Column: Form */}
                <div className="bg-neutral-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-white mb-6">Process New Refund</h2>
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
                                className="w-full p-3 bg-neutral-700 rounded-md text-white placeholder-neutral-400 border border-transparent focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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
                                    className="w-full p-3 bg-neutral-700 rounded-md text-white placeholder-neutral-400 border border-transparent focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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
                                    className="w-full p-3 bg-neutral-700 rounded-md text-white border border-transparent focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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
                                className="w-full p-3 bg-neutral-700 rounded-md text-white placeholder-neutral-400 border border-transparent focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                rows="4"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !staffAuth || !user}
                            className="w-full p-3 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-all duration-200 ease-in-out"
                        >
                            {loading ? 'Processing...' : 'Process Refund'}
                        </button>
                    </form>
                </div>

                {/* Right Column: List */}
                <div className="bg-neutral-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-white mb-6">Recent Refunds</h2>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        {pageLoading ? (
                            <p className="text-neutral-400 text-center py-4">Loading recent refunds...</p>
                        ) : refunds.length > 0 ? (
                            refunds.map(refund => (
                                <div key={refund.id} className="p-4 bg-neutral-700/50 rounded-lg border border-neutral-700">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-grow">
                                            <p className="text-lg font-semibold text-white">{refund.productName}</p>
                                            <p className="text-sm text-indigo-300 font-medium">
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
                                            <p>{refund.date ? refund.date.toLocaleDateString() : 'No date'}</p>
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
                <Toast 
                    message={notification.message} 
                    type={notification.type} 
                    onClose={() => setNotification({ message: '', type: '' })} 
                />
            )}
        </div>
    );
}