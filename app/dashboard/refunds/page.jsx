'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import db from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../utils/firebase';

export default function Refunds() {
    const [user, loadingAuth, errorAuth] = useAuthState(auth);
    const [refunds, setRefunds] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const [loading, setLoading] = useState(false); // For form submission
    const [pageLoading, setPageLoading] = useState(true); // For initial data load
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const initialRefundState = {
        productName: '', // Will be 'item' in reports
        amount: '',
        reason: '',
        method: 'cash', // Default refund method (maps to 'method' in reports)
    };
    const [newRefund, setNewRefund] = useState(initialRefundState);

    // Get staff authentication from localStorage
    useEffect(() => {
        const authData = localStorage.getItem('staffAuth');
        if (authData) {
            try {
                const parsedAuth = JSON.parse(authData);
                setStaffAuth(parsedAuth);
                 // Pre-fill storeId if available in staffAuth for clarity, though it's re-confirmed on submit
                // This assumes staffAuth might have a storeId like 'zeven@iclick.co.za'
                // if (parsedAuth.storeId) { 
                //     // No direct field in newRefund state for this, it's added on submit
                // }
            } catch (e) {
                console.error("Failed to parse staffAuth:", e);
                setError("Error loading staff authentication details.");
            }
        } else {
            if (!loadingAuth) { // Only set error if not still loading Firebase auth
                 setError("Staff authentication details not found. Please log in again.");
            }
        }
    }, [loadingAuth]);

    // Fetch existing refunds
    const fetchRefunds = useCallback(async () => {
        setPageLoading(true);
        setError('');
        try {
            const q = query(
                collection(db, 'refunds'),
                orderBy('date', 'desc') // Order by the new 'date' field
            );
            const querySnapshot = await getDocs(q);
            const refundsData = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Ensure date is a JS Date object for display, if it's a Firestore Timestamp
                    date: data.date?.toDate ? data.date.toDate() : (data.date ? new Date(data.date) : new Date()),
                };
            });
            setRefunds(refundsData);
        } catch (err) {
            console.error('Error fetching refunds:', err);
            setError('Failed to load refunds. ' + err.message);
        } finally {
            setPageLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) { // Fetch refunds only if user is authenticated
            fetchRefunds();
        } else if (!loadingAuth && errorAuth) {
            setError("Authentication failed: " + errorAuth.message);
            setPageLoading(false);
        } else if (!loadingAuth && !user) {
            setError("Please log in to manage refunds.");
            setPageLoading(false);
        }
    }, [user, loadingAuth, errorAuth, fetchRefunds]);

    
    // Process refund
    const handleSubmitRefund = async (e) => {
        e.preventDefault();
        if (!newRefund.productName || !newRefund.amount || !newRefund.reason || !newRefund.method) {
            setError('Please fill in all required fields.');
            return;
        }
        if (!staffAuth || !staffAuth.staffId || !staffAuth.staffName) {
            setError('Staff authentication details are missing. Cannot process refund.');
            return;
        }
        
        // CRITICAL: Determine the correct storeId
        // Option 1: staffAuth has a specific storeId like 'zeven@iclick.co.za'
        const storeIdentifier = staffAuth.storeId || user?.email; 
        // Option 2: user.email is the store identifier e.g. 'zeven@iclick.co.za'
        // Option 3: A hardcoded value based on some other logic if needed

        if (!storeIdentifier) {
            setError('Store identifier could not be determined. Cannot process refund.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        const currentDate = new Date();
        const refundDataToSave = {
            productName: newRefund.productName, // Maps to 'item' in reports
            amount: parseFloat(newRefund.amount),
            reason: newRefund.reason,
            method: newRefund.method, // Maps to 'method' in reports

            staffName: staffAuth.staffName, // For direct use in reports
            date: Timestamp.fromDate(currentDate), // Primary date field for reports
            storeId: storeIdentifier, // Align with Exports page store IDs

            createdBy: { // Audit information
                id: staffAuth.staffId,
                name: staffAuth.staffName,
                role: staffAuth.accountType || 'staff', // staffAuth might have accountType
            },
            // You can add user.uid if you want to track the Firebase Auth user ID specifically
            // firebaseUserId: user.uid 
        };

        try {
            const docRef = await addDoc(collection(db, 'refunds'), refundDataToSave);
            setSuccess('Refund processed successfully!');
            
            // Add to local state for immediate UI update
            const newRefundEntry = {
                ...refundDataToSave,
                id: docRef.id,
                date: currentDate, // Use JS Date for local state
            };
            setRefunds(prevRefunds => [newRefundEntry, ...prevRefunds]);
            
            setNewRefund(initialRefundState); // Reset form
        } catch (err) {
            console.error('Error processing refund:', err);
            setError('Failed to process refund. ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewRefund(prev => ({ ...prev, [name]: value }));
    };

    if (pageLoading && !user && !errorAuth) { // Show auth loading if firebase auth is still loading
         return <div className="min-h-screen bg-neutral-900 p-8 text-white text-center">Loading authentication...</div>;
    }


    return (
        <RouteGuard requiredRoles={['manager', 'staff']} currentRole={staffAuth?.accountType}>
            <div className="min-h-screen bg-neutral-900 p-4 md:p-8">
                <div className="max-w-2xl mx-auto"> {/* Adjusted max-width for a more focused form */}
                    <h1 className="text-3xl font-bold text-white mb-8 text-center">Refund Management</h1>

                    {/* Add Refund Form */}
                    <div className="mb-8 p-6 bg-neutral-800 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-white mb-6">Process New Refund</h2>
                        <form onSubmit={handleSubmitRefund} className="space-y-6">
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
                                    className="w-full p-2.5 bg-neutral-700 rounded text-white placeholder-neutral-500 focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                            </div>
                            
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
                                    className="w-full p-2.5 bg-neutral-700 rounded text-white placeholder-neutral-500 focus:ring-indigo-500 focus:border-indigo-500"
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
                                    className="w-full p-2.5 bg-neutral-700 rounded text-white focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                >
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="snapscan">SnapScan</option>
                                    <option value="store_credit">Store Credit</option>
                                    <option value="other">Other</option>
                                </select>
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
                                    className="w-full p-2.5 bg-neutral-700 rounded text-white placeholder-neutral-500 focus:ring-indigo-500 focus:border-indigo-500"
                                    rows="3"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !staffAuth} // Disable if loading or staffAuth not loaded
                                className="w-full p-2.5 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700 disabled:opacity-50 transition duration-150"
                            >
                                {loading ? 'Processing...' : 'Process Refund'}
                            </button>
                        </form>
                    </div>
                    
                    {/* Messages */}
                    {error && <div className="my-4 p-3 bg-red-600/30 border border-red-500 rounded text-white text-sm">{error}</div>}
                    {success && <div className="my-4 p-3 bg-green-600/30 border border-green-500 rounded text-white text-sm">{success}</div>}

                    {/* Refunds List */}
                    <div className="mt-10">
                        <h2 className="text-xl font-semibold text-white mb-6">
                            Recent Refunds
                        </h2>
                        {pageLoading && !refunds.length ? (
                            <p className="text-neutral-400 text-center py-4">Loading recent refunds...</p>
                        ) : refunds.length > 0 ? (
                            <div className="space-y-4">
                                {refunds.map(refund => (
                                    <div key={refund.id} className="p-4 bg-neutral-800 rounded-lg shadow">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                            <div className="flex-grow">
                                                <p className="text-lg font-medium text-white">{refund.productName}</p>
                                                <p className="text-sm text-neutral-400">
                                                    Amount: R {typeof refund.amount === 'number' ? refund.amount.toFixed(2) : refund.amount}
                                                </p>
                                                <p className="text-sm text-neutral-400 capitalize"> 
                                                    Method: {refund.method?.replace('_', ' ') || 'N/A'}
                                                </p>
                                                <p className="mt-1 text-sm text-neutral-300">
                                                    Reason: {refund.reason}
                                                </p>
                                            </div>
                                            <div className="text-xs sm:text-sm text-neutral-500 sm:text-right flex-shrink-0 mt-2 sm:mt-0">
                                                <p className="font-semibold text-indigo-400">
                                                    By: {refund.staffName || refund.createdBy?.name || 'Unknown Staff'}
                                                </p>
                                                <p>Store: {refund.storeId || 'N/A'}</p>
                                                <p>{refund.date ? new Date(refund.date).toLocaleDateString() : 'No date'} {refund.date ? new Date(refund.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-neutral-400 text-center py-4">
                                No refunds recorded yet.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </RouteGuard>
    );
}