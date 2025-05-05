'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import db from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../utils/firebase';

export default function Refunds() {
    const [user] = useAuthState(auth);
    const [refunds, setRefunds] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [newRefund, setNewRefund] = useState({
        productName: '',
        amount: '',
        reason: '',
        refundMethod: 'cash', // cash, store_credit
        createdBy: null,
        storeId: null,
        createdAt: null
    });

    // Get staff authentication
    useEffect(() => {
        const auth = localStorage.getItem('staffAuth');
        if (auth) {
            setStaffAuth(JSON.parse(auth));
        }
    }, []);

    // Fetch existing refunds
    useEffect(() => {
        const fetchRefunds = async () => {
            try {
                const q = query(
                    collection(db, 'refunds'),
                    orderBy('createdAt', 'desc')
                );
                const querySnapshot = await getDocs(q);
                const refundsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setRefunds(refundsData);
            } catch (error) {
                console.error('Error fetching refunds:', error);
                setError('Failed to load refunds');
            }
        };

        fetchRefunds();
    }, []);

    
    // Process refund
    const handleSubmitRefund = async (e) => {
        e.preventDefault();
        if (!newRefund.productName || !newRefund.amount || !newRefund.reason) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const refundData = {
                ...newRefund,
                amount: parseFloat(newRefund.amount),
                createdAt: new Date().toISOString(),
                createdBy: {
                    id: staffAuth.staffId,
                    name: staffAuth.staffName,
                    role: staffAuth.accountType
                },
                storeId: user.uid,
                storeName: user.email
            };

            await addDoc(collection(db, 'refunds'), refundData);
            setSuccess('Refund processed successfully');
            
            // Reset form
            setNewRefund({
                productName: '',
                amount: '',
                reason: '',
                refundMethod: 'cash',
                createdBy: null,
                storeId: null,
                createdAt: null
            });
        } catch (error) {
            console.error('Error processing refund:', error);
            setError('Failed to process refund');
        } finally {
            setLoading(false);
        }
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="min-h-screen bg-neutral-900 p-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-8">Refund Management</h1>

                    {/* Add Refund Form */}
                    <div className="mb-8 p-4 bg-neutral-800 rounded-lg">
                        <h2 className="text-xl font-semibold text-white mb-4">Process New Refund</h2>
                        <form onSubmit={handleSubmitRefund} className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">
                                    Product Name
                                </label>
                                <input
                                    type="text"
                                    value={newRefund.productName}
                                    onChange={(e) => setNewRefund(prev => ({ 
                                        ...prev, 
                                        productName: e.target.value 
                                    }))}
                                    className="w-full p-2 bg-neutral-700 rounded text-white"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">
                                    Refund Amount (R)
                                </label>
                                <input
                                    type="number"
                                    value={newRefund.amount}
                                    onChange={(e) => setNewRefund(prev => ({ 
                                        ...prev, 
                                        amount: e.target.value 
                                    }))}
                                    step="0.01"
                                    min="0"
                                    className="w-full p-2 bg-neutral-700 rounded text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">
                                    Refund Method
                                </label>
                                <select
                                    value={newRefund.refundMethod}
                                    onChange={(e) => setNewRefund(prev => ({ 
                                        ...prev, 
                                        refundMethod: e.target.value 
                                    }))}
                                    className="w-full p-2 bg-neutral-700 rounded text-white"
                                    required
                                >
                                    <option value="cash">Cash</option>
                                    <option value="store_credit">Store Credit</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">
                                    Reason for Refund
                                </label>
                                <textarea
                                    value={newRefund.reason}
                                    onChange={(e) => setNewRefund(prev => ({ 
                                        ...prev, 
                                        reason: e.target.value 
                                    }))}
                                    className="w-full p-2 bg-neutral-700 rounded text-white"
                                    rows="3"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Process Refund'}
                            </button>
                        </form>
                    </div>

                    
                    {/* Messages */}
                    {error && <div className="mb-4 p-3 bg-red-600/20 border border-red-500 rounded text-white">{error}</div>}
                    {success && <div className="mb-4 p-3 bg-green-600/20 border border-green-500 rounded text-white">{success}</div>}

                    {/* Refunds List */}
                    <div className="mt-8">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            Recent Refunds 
                        </h2>
                        <div className="grid gap-4">
                            {refunds.length > 0 ? (
                                refunds.map(refund => (
                                    <div key={refund.id} className="p-4 bg-neutral-800 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-white font-medium">{refund.productName}</p>
                                                <p className="text-sm text-neutral-400">
                                                    Amount: R {typeof refund.amount === 'number' ? refund.amount.toFixed(2) : refund.amount}
                                                </p>
                                                <p className="text-sm text-neutral-400">
                                                    Method: {refund.refundMethod}
                                                </p>
                                            </div>
                                            <div className="text-right text-sm text-neutral-500">
                                                <p className="text-indigo-400">Processed by: {refund.createdBy.name}</p>
                                                <p>{new Date(refund.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <p className="mt-2 text-sm text-neutral-400">
                                            Reason: {refund.reason}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-neutral-400 text-center py-4">
                                    {searchQuery ? 'No refunds found matching your search' : 'No refunds recorded yet'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </RouteGuard>
    );
}