'use client';

import React, { useEffect, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa'; // Keep if used, though not in provided JSX
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { auth } from '../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const ConfirmOrder = ({ orderDetails, totalPrice, appliedSpecials, onClose }) => {
    const db = getFirestore();
    const [user, loadingUser, errorUser] = useAuthState(auth); // Added loading/error states for user
    const [staffAuth, setStaffAuth] = useState(null);
    const [error, setError] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [cashReceived, setCashReceived] = useState('');
    const [voucherCode, setVoucherCode] = useState('');
    const [processing, setProcessing] = useState(false);

    const paymentMethods = [
        { id: 'card', name: 'Card', icon: '💳' },
        { id: 'cash', name: 'Cash', icon: '💵' },
        { id: 'snapscan', name: 'SnapScan', icon: '📱' },
        { id: 'voucher', name: 'Voucher', icon: '🎫' }
    ];

    useEffect(() => {
        const authData = localStorage.getItem('staffAuth');
        if (authData) {
            try {
                setStaffAuth(JSON.parse(authData));
            } catch (e) {
                console.error("Error parsing staffAuth from localStorage:", e);
                // setError("Failed to load staff details. Please try again."); // Optional: inform user
            }
        }
    }, []);

    if (!orderDetails || orderDetails.length === 0) {
        return null;
    }

    const validateVoucher = async (code) => {
        // Ensure db is initialized
        if (!db) {
            throw new Error('Firestore database is not initialized.');
        }
        const vouchersRef = collection(db, 'vouchers');
        // Vouchers should be active and not past their expirationDate (if expirationDate is a Timestamp)
        // If expirationDate is an ISO string, new Date() should be compared against new Date(doc.expirationDate)
        // For this example, assuming expirationDate is a Firestore Timestamp
        const q = query(vouchersRef,
            where('code', '==', code),
            where('active', '==', true)
            // where('expirationDate', '>', Timestamp.now()) // More robust way to check expiry with Firestore Timestamps
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error('Invalid or already used voucher code.');
        }
        
        const voucherDoc = snapshot.docs[0];
        const voucherData = voucherDoc.data();

        // Client-side check for expiration if stored as string or if further validation is needed
        if (voucherData.expirationDate) {
            const expiryDate = voucherData.expirationDate.toDate ? voucherData.expirationDate.toDate() : new Date(voucherData.expirationDate);
            if (expiryDate < new Date()) {
                throw new Error('Voucher code has expired.');
            }
        }
        
        return voucherDoc; // Return the document itself (id + data)
    };

    const handleConfirm = async () => {
        setError(''); // Clear previous errors

        if (loadingUser) {
            setError("Verifying store account... please wait.");
            return;
        }
        if (!user) {
            setError("Store account (Firebase User) must be logged in to complete the sale.");
            return;
        }
        if (!staffAuth || !staffAuth.staffId || !staffAuth.staffName) {
            setError("Staff member details are missing. Please ensure staff is logged in correctly via localStorage.");
            return;
        }
        if (!paymentMethod) {
            setError('Please select a payment method.');
            return;
        }

        setProcessing(true);

        // --- Store ID Determination (CRITICAL) ---
        // This ID must match the IDs used in your "Exports" page's store list (e.g., 'zeven@iclick.co.za')
        const determinedStoreId = staffAuth.storeId || user.email; 
        if (!determinedStoreId) {
            setError("Could not determine Store ID. Sale cannot be processed.");
            setProcessing(false);
            return;
        }
        // --- End Store ID Determination ---

        let saleDataPayload = {}; // Define outside try to access in voucher logic

        try {
            const numericTotalPrice = parseFloat(String(totalPrice).replace(/[^\d.-]/g, '')) || 0;

            if (paymentMethod === 'cash') {
                const numericCashReceived = parseFloat(cashReceived);
                if (isNaN(numericCashReceived) || numericCashReceived < numericTotalPrice) {
                    setError('Insufficient cash received or invalid amount.');
                    setProcessing(false);
                    return;
                }
            }

            saleDataPayload = {
                storeId: determinedStoreId,
                storeName: user.email, // For quick reference, if user.email is descriptive
                staffId: staffAuth.staffId,
                staffName: staffAuth.staffName,
                staffRole: staffAuth.accountType,
                date: serverTimestamp(), // PRIMARY DATE FIELD for filtering/sorting in reports
                items: orderDetails.map(item => {
                    const itemPrice = parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0;
                    const itemQuantity = parseInt(item.quantity) || 0;
                    return {
                        id: item.id,
                        name: item.name,
                        size: item.size || null,
                        quantity: itemQuantity,
                        price: itemPrice,
                        subtotal: parseFloat((itemPrice * itemQuantity).toFixed(2)) // Store as number
                    };
                }),
                appliedSpecials: appliedSpecials ? appliedSpecials.map(special => ({
                    id: special.id || '',
                    name: special.name || '',
                    triggerProduct: special.triggerProduct || '',
                    rewardProduct: special.rewardProduct || '',
                    discountType: special.discountType || 'free',
                    discountValue: parseFloat(special.discountValue) || 0,
                    savedAmount: parseFloat(special.savedAmount) || 0
                })) : [],
                subtotalBeforeDiscounts: parseFloat(orderDetails.reduce((sum, item) =>
                    sum + ((parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0) * (parseInt(item.quantity) || 0)), 0).toFixed(2)),
                totalDiscount: parseFloat(appliedSpecials ?
                    appliedSpecials.reduce((sum, special) => sum + (parseFloat(special.savedAmount) || 0), 0).toFixed(2) : "0.00"),
                total: numericTotalPrice, // ALIGNED: This is the sale.total for reports
                payment: {
                    method: paymentMethod,
                    cashReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) : null,
                    change: paymentMethod === 'cash' ? parseFloat((parseFloat(cashReceived) - numericTotalPrice).toFixed(2)) : null,
                    processedAt: serverTimestamp() // Use serverTimestamp for consistency
                },
                paymentStatus: 'completed',
                orderNumber: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, // Shortened random part
                source: 'pos_system'
            };

            if (paymentMethod === 'voucher') {
                if (!voucherCode) {
                    setError('Please enter a voucher code.');
                    setProcessing(false);
                    return;
                }
                const voucherDocRef = await validateVoucher(voucherCode); // Returns doc ref
                saleDataPayload.voucher = {
                    code: voucherCode,
                    id: voucherDocRef.id,
                    value: parseFloat(voucherDocRef.data().value) || numericTotalPrice // Assuming voucher covers full amount if not specified
                };
                // Mark voucher as used
                await updateDoc(doc(db, 'vouchers', voucherDocRef.id), {
                    active: false,
                    usedAt: serverTimestamp(),
                    usedBy: {
                        staffId: staffAuth.staffId,
                        staffName: staffAuth.staffName,
                        storeId: determinedStoreId
                    },
                    saleId: null // Will be updated after sale is recorded if needed, or store orderNumber
                });
                // If voucher has a specific value, it might adjust the total or act as full payment
                // For simplicity here, assuming voucher covers the total price if used.
                // Your specific voucher logic might differ (e.g. partial payment).
            }

            const salesCollectionRef = collection(db, 'sales');
            const docRef = await addDoc(salesCollectionRef, saleDataPayload);
            console.log("Sale recorded successfully with ID: ", docRef.id, saleDataPayload);
            
            // Optional: Update voucher with sale ID
            if (paymentMethod === 'voucher' && saleDataPayload.voucher) {
                 await updateDoc(doc(db, 'vouchers', saleDataPayload.voucher.id), { saleId: docRef.id });
            }

            localStorage.removeItem('orderDetails'); // Clear current order from local storage
            localStorage.removeItem('appliedSpecials'); // Clear applied specials
            
            // Instead of window.location.reload(), better to trigger a state update in parent to show success/clear form
            if (onClose) onClose(true); // Pass success status to parent if needed

        } catch (err) {
            console.error("Error recording sale: ", err);
            setError(`Error processing payment: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const getPaymentButtonText = () => {
        if (!staffAuth) return 'Staff Login Required';
        if (processing) return 'Processing...';
        switch (paymentMethod) {
            case 'card': return 'Process Card Payment';
            case 'cash': return 'Complete Cash Payment';
            case 'snapscan': return 'Confirm SnapScan Payment';
            case 'voucher': return 'Redeem Voucher & Complete';
            default: return 'Select Payment Method';
        }
    };
    
    const numericTotalPriceForDisplay = parseFloat(String(totalPrice).replace(/[^\d.-]/g, '')) || 0;


    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="border border-neutral-700 bg-neutral-800 p-6 rounded-lg shadow-xl w-full max-w-3xl text-white"> {/* Increased max-width */}
                <h2 className="text-2xl font-bold mb-6 text-center">Complete Sale</h2>
                
                {/* Error Display */}
                {error && (
                    <div className="w-full bg-red-600/20 border border-red-500 text-red-100 p-3 rounded-md mb-4 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                    {/* Order Summary Section */}
                    <div className="w-full md:w-1/2 bg-neutral-900/50 p-4 rounded-md border border-neutral-700">
                        <div className="bg-neutral-700 p-3 rounded-md mb-4 text-xs">
                            <p><span className="font-semibold">Store:</span> {user?.email || 'N/A'}</p>
                            <p><span className="font-semibold">Staff:</span> {staffAuth?.staffName || 'N/A'} ({staffAuth?.accountType || 'N/A'})</p>
                        </div>

                        <h3 className="text-lg font-semibold mb-2">Order Details:</h3>
                        <div className="max-h-48 overflow-y-auto text-sm space-y-1 pr-2"> {/* Added max-height and scroll */}
                            {orderDetails.map(item => (
                                <li key={item.id || item.name} className="flex justify-between list-none">
                                    <span>{item.quantity} x {item.name} {item.size && `(${item.size})`}</span>
                                    <span>R {( (parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0) * (item.quantity || 0) ).toFixed(2)}</span>
                                </li>
                            ))}
                        </div>

                        {appliedSpecials && appliedSpecials.length > 0 && (
                            <>
                                <hr className="my-2 border-neutral-600" />
                                <h4 className="text-sm font-semibold text-green-400">Applied Specials:</h4>
                                <ul className="text-xs space-y-1 max-h-20 overflow-y-auto pr-2"> {/* Added max-height and scroll */}
                                    {appliedSpecials.map((special, index) => (
                                        <li key={special.id || index} className="flex justify-between text-green-400">
                                            <span>{special.name}</span>
                                            <span>-R {(parseFloat(special.savedAmount) || 0).toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        <hr className="my-3 border-neutral-500" />
                        <div className="flex justify-between font-bold text-xl">
                            <span>Total:</span>
                            <span>R {numericTotalPriceForDisplay.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Payment Section */}
                    <div className="w-full md:w-1/2 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Select Payment Method:</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {paymentMethods.map((method) => (
                                    <button
                                        key={method.id}
                                        onClick={() => { setPaymentMethod(method.id); setError('');}} // Clear error on method change
                                        className={`p-3 rounded-md flex items-center justify-center gap-x-2 transition-colors text-sm font-medium
                                        ${paymentMethod === method.id
                                                ? 'bg-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-400 ring-offset-2 ring-offset-neutral-800'
                                                : 'bg-neutral-700 hover:bg-neutral-600'}`}
                                    >
                                        <span>{method.icon}</span>
                                        <span>{method.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {paymentMethod === 'cash' && (
                            <div className="p-3 bg-neutral-700/50 rounded-md border border-neutral-600">
                                <label htmlFor="cashReceived" className="block text-sm font-medium mb-1">Cash Received:</label>
                                <input
                                    type="number"
                                    id="cashReceived"
                                    value={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.value)}
                                    className="w-full p-2 bg-neutral-600 rounded text-white placeholder-neutral-400"
                                    placeholder="Enter amount received"
                                    step="0.01"
                                    min={numericTotalPriceForDisplay.toFixed(2)} // Ensure min is correctly set
                                />
                                {cashReceived && parseFloat(cashReceived) >= numericTotalPriceForDisplay && (
                                    <div className="mt-2 text-sm text-green-400">
                                        Change Due: R {(parseFloat(cashReceived) - numericTotalPriceForDisplay).toFixed(2)}
                                    </div>
                                )}
                            </div>
                        )}

                        {paymentMethod === 'voucher' && (
                            <div className="p-3 bg-neutral-700/50 rounded-md border border-neutral-600">
                                <label htmlFor="voucherCode" className="block text-sm font-medium mb-1">Voucher Code:</label>
                                <input
                                    type="text"
                                    id="voucherCode"
                                    value={voucherCode}
                                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                                    className="w-full p-2 bg-neutral-600 rounded text-white placeholder-neutral-400"
                                    placeholder="Enter 8-digit code"
                                    maxLength="8" // Common voucher length
                                />
                            </div>
                        )}
                        
                        <div className="pt-2 space-y-3">
                             <button
                                onClick={handleConfirm}
                                disabled={!staffAuth || !user || !paymentMethod || processing || loadingUser}
                                className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-green-700 
                                focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-neutral-800
                                disabled:opacity-60 disabled:cursor-not-allowed transition duration-150"
                            >
                                {getPaymentButtonText()}
                            </button>
                            
                            <button
                                onClick={() => onClose(false)} // Pass false for cancellation
                                disabled={processing}
                                className="w-full bg-red-600 text-white py-2 px-4 rounded-md font-medium hover:bg-red-700 
                                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-800
                                disabled:opacity-60 transition duration-150"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmOrder;