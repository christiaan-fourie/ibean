'use client';

import React, { useEffect, useState } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, Timestamp, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { auth } from '../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const ConfirmOrder = ({ orderDetails, totalPrice, appliedSpecials, onClose }) => {
    const db = getFirestore();
    const [user, loadingUser, errorUser] = useAuthState(auth); // Added loading/error states for user
    const [staffAuth, setStaffAuth] = useState(null);
    const [error, setError] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [secondaryPaymentMethod, setSecondaryPaymentMethod] = useState('');
    const [cashReceived, setCashReceived] = useState('');
    const [voucherCode, setVoucherCode] = useState('');
    const [processing, setProcessing] = useState(false);
    const [validatedVoucher, setValidatedVoucher] = useState(null);
    const [calculatedTotal, setCalculatedTotal] = useState(totalPrice);
    const [remainingAmount, setRemainingAmount] = useState(0);
    const [showSecondaryPayment, setShowSecondaryPayment] = useState(false);
    const [voucherDiscountedItems, setVoucherDiscountedItems] = useState([]);

    // FIX: Ensure totalPrice is always treated as a number
    const numericTotalPrice = parseFloat(totalPrice) || 0;

    const paymentMethods = [
        { id: 'card', name: 'Card', icon: '💳' },
        { id: 'cash', name: 'Cash', icon: '💵' },
        { id: 'snapscan', name: 'SnapScan', icon: '📱' },
        { id: 'voucher', name: 'Voucher', icon: '🎫' }
    ];

    const secondaryPaymentMethods = [
        { id: 'card', name: 'Card', icon: '💳' },
        { id: 'cash', name: 'Cash', icon: '💵' },
        { id: 'snapscan', name: 'SnapScan', icon: '📱' }
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

    // Reset calculated total when totalPrice changes
    useEffect(() => {
        setCalculatedTotal(numericTotalPrice);
        setValidatedVoucher(null);
        setRemainingAmount(0);
        setShowSecondaryPayment(false);
        setVoucherDiscountedItems([]);
    }, [numericTotalPrice]);

    if (!orderDetails || orderDetails.length === 0) {
        return null;
    }

    const validateVoucher = async (code) => {
        // Ensure db is initialized
        if (!db) {
            throw new Error('Firestore database is not initialized.');
        }
        
        if (!code || code.trim() === '') {
            throw new Error('Please enter a valid voucher code.');
        }
        
        const vouchersRef = collection(db, 'vouchers');
        
        // Query for active vouchers with the provided code
        // Note: Removed the redeemed=false condition to support reusable vouchers
        const q = query(vouchersRef,
            where('code', '==', code.trim()),
            where('active', '==', true)
        );
        
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error('Invalid, expired, or deactivated voucher code.');
        }
        
        const voucherDoc = snapshot.docs[0];
        const voucherData = { id: voucherDoc.id, ...voucherDoc.data() };

        // Check if the voucher has been marked as redeemed (happens only for one-time use vouchers)
        if (voucherData.redeemed) {
            throw new Error('This voucher has already been redeemed and cannot be used again.');
        }
        
        // Client-side check for expiration if stored as string or if further validation is needed
        if (voucherData.expirationDate) {
            const expiryDate = voucherData.expirationDate.toDate ? 
                voucherData.expirationDate.toDate() : 
                new Date(voucherData.expirationDate);
                
            if (expiryDate < new Date()) {
                throw new Error('This voucher expired on ' + expiryDate.toLocaleDateString() + '.');
            }
        }
        
        // Check for minimum purchase requirements
        if (voucherData.minimumPurchase && numericTotalPrice < parseFloat(voucherData.minimumPurchase)) {
            throw new Error(`This voucher requires a minimum purchase of R${parseFloat(voucherData.minimumPurchase).toFixed(2)}.`);
        }
        
        // Check for item-specific vouchers
        if (voucherData.applicableItems && voucherData.applicableItems.length > 0) {
            const orderItemIds = orderDetails.map(item => item.id);
            const hasMatchingItem = voucherData.applicableItems.some(itemId => 
                orderItemIds.includes(itemId)
            );
            
            if (!hasMatchingItem) {
                throw new Error('This voucher can only be applied to specific items not in your cart.');
            }
        }
        
        // Check for usage limits
        if (voucherData.maxRedemptions && voucherData.redemptionCount >= voucherData.maxRedemptions) {
            throw new Error('This voucher has reached its maximum number of uses.');
        }
        
        // Check for store-specific vouchers
        if (voucherData.restrictedToStores && voucherData.restrictedToStores.length > 0) {
            const currentStoreId = staffAuth?.storeId || user?.email;
            if (!voucherData.restrictedToStores.includes(currentStoreId)) {
                throw new Error('This voucher cannot be used at this location.');
            }
        }
        
        return voucherData;
    };

    // Apply voucher discount to total
    const applyVoucher = async () => {
        setError('');
        
        if (!voucherCode) {
            setError('Please enter a voucher code.');
            return;
        }

        try {
            const voucherData = await validateVoucher(voucherCode);
            setValidatedVoucher(voucherData);
            
            let newTotal = numericTotalPrice;
            let voucherDiscount = 0;
            let discountedItems = [];
            
            // Calculate discount based on voucher type
            if (voucherData.voucherType === 'discount') {
                if (voucherData.discountType === 'percentage') {
                    // Apply percentage discount
                    voucherDiscount = (newTotal * voucherData.discountValue) / 100;
                    newTotal = Math.max(0, newTotal - voucherDiscount);
                    
                    // Track discounted items if specified
                    if (voucherData.applicableItems && voucherData.applicableItems.length > 0) {
                        orderDetails.forEach(item => {
                            if (voucherData.applicableItems.includes(item.id)) {
                                const itemDiscount = parseFloat(item.price) * voucherData.discountValue / 100;
                                discountedItems.push({
                                    id: item.id,
                                    name: item.name,
                                    discount: itemDiscount
                                });
                            }
                        });
                    }
                } else if (voucherData.discountType === 'fixed') {
                    // Apply fixed amount discount
                    voucherDiscount = Math.min(newTotal, voucherData.discountValue);
                    newTotal = Math.max(0, newTotal - voucherDiscount);
                    
                    // For fixed discounts, track as a general discount
                    discountedItems.push({
                        id: 'fixed-discount',
                        name: 'Fixed Discount',
                        discount: voucherDiscount
                    });
                }
                
                setCalculatedTotal(newTotal.toFixed(2));
                
                // If voucher doesn't cover the full amount, enable secondary payment
                if (newTotal > 0) {
                    setRemainingAmount(newTotal);
                    setShowSecondaryPayment(true);
                } else {
                    setRemainingAmount(0);
                    setShowSecondaryPayment(false);
                }
            } else if (voucherData.voucherType === 'freeItem') {
                // For free item vouchers, identify the free item and calculate discount
                const freeItemId = typeof voucherData.freeItem === 'object' ? 
                    voucherData.freeItem.id : voucherData.freeItem;
                
                // Find the item in the order
                const freeItemInOrder = orderDetails.find(item => item.id === freeItemId);
                
                if (freeItemInOrder) {
                    // If the free item is in the order, apply the discount
                    const itemPrice = parseFloat(String(freeItemInOrder.price).replace(/[^\d.-]/g, '')) || 0;
                    voucherDiscount = itemPrice;
                    newTotal = Math.max(0, newTotal - voucherDiscount);
                    discountedItems.push({
                        id: freeItemInOrder.id,
                        name: freeItemInOrder.name,
                        discount: voucherDiscount
                    });
                }
                
                setCalculatedTotal(newTotal.toFixed(2));
                setRemainingAmount(newTotal);
                setShowSecondaryPayment(true);
            } else if (voucherData.voucherType === 'buyXGetY') {
                // Buy X Get Y free implementation
                const triggerItemId = voucherData.triggerItem;
                const freeItemId = voucherData.freeItem;
                
                // Check if both items are in the order
                const triggerItem = orderDetails.find(item => item.id === triggerItemId);
                const freeItem = orderDetails.find(item => item.id === freeItemId);
                
                if (triggerItem && freeItem) {
                    // Apply discount to the free item
                    const freeItemPrice = parseFloat(String(freeItem.price).replace(/[^\d.-]/g, '')) || 0;
                    voucherDiscount = freeItemPrice;
                    newTotal = Math.max(0, newTotal - voucherDiscount);
                    discountedItems.push({
                        id: freeItem.id,
                        name: freeItem.name,
                        discount: voucherDiscount
                    });
                }
                
                setCalculatedTotal(newTotal.toFixed(2));
                setRemainingAmount(newTotal);
                setShowSecondaryPayment(true);
            }
            
            // Store discounted items for reference
            setVoucherDiscountedItems(discountedItems);
        } catch (error) {
            setError(error.message);
            setValidatedVoucher(null);
            setCalculatedTotal(totalPrice);
            setRemainingAmount(0);
            setShowSecondaryPayment(false);
            setVoucherDiscountedItems([]);
        }
    };
    
    // Clear the applied voucher
    const clearVoucher = () => {
        setVoucherCode('');
        setValidatedVoucher(null);
        setCalculatedTotal(numericTotalPrice);
        setRemainingAmount(0);
        setShowSecondaryPayment(false);
        setVoucherDiscountedItems([]);
    };

    // Mark voucher as redeemed in database
    const markVoucherAsRedeemed = async (voucherId) => {
        if (!voucherId) return;
        
        try {
            const voucherRef = doc(db, 'vouchers', voucherId);
            
            // Get the current voucher data to check if it has been redeemed before
            const voucherDoc = await getDoc(voucherRef);
            if (!voucherDoc.exists()) {
                console.error('Voucher document not found');
                return;
            }
            
            const voucherData = voucherDoc.data();
            const currentRedemptionCount = voucherData.redemptionCount || 0;
            
            // Base update data - increment redemption count and add redemption details
            const updateData = {
                redemptionCount: increment(1),
                lastRedeemedAt: serverTimestamp(),
                lastRedeemedBy: {
                    staffId: staffAuth?.staffId,
                    staffName: staffAuth?.staffName,
                    role: staffAuth?.accountType,
                    storeId: staffAuth?.storeId || user?.email
                },
                // Store redemption history as an array
                redemptionHistory: arrayUnion({
                    timestamp: new Date().toISOString(),
                    staffId: staffAuth?.staffId,
                    staffName: staffAuth?.staffName,
                    storeId: staffAuth?.storeId || user?.email
                })
            };
            
            // If voucher should expire after redemption OR it has reached max redemptions,
            // mark it as redeemed and inactive
            if (validatedVoucher?.expireAfterRedemption) {
                updateData.redeemed = true;
                updateData.active = false;
            } else if (validatedVoucher?.maxRedemptions && 
                      (currentRedemptionCount + 1) >= validatedVoucher.maxRedemptions) {
                // If it has reached max redemptions, mark as inactive but not necessarily redeemed
                updateData.active = false;
            }
            
            await updateDoc(voucherRef, updateData);
            
        } catch (error) {
            console.error('Error marking voucher as redeemed:', error);
            // We continue with the order process even if updating the voucher fails
        }
    };

    const handleConfirm = async (paymentMethod) => {
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

        // Validate voucher payment
        if (paymentMethod === 'voucher' && !validatedVoucher) {
            setError('Please enter and validate a voucher code.');
            return;
        }

        // If voucher doesn't cover full amount, validate secondary payment
        if (paymentMethod === 'voucher' && showSecondaryPayment) {
            if (!secondaryPaymentMethod) {
                setError('Please select a secondary payment method for the remaining amount.');
                return;
            }
            
            // Validate cash received for secondary payment
            if (secondaryPaymentMethod === 'cash' && (
                !cashReceived || 
                parseFloat(cashReceived) < parseFloat(remainingAmount)
            )) {
                setError('Cash received must be greater than or equal to the remaining amount.');
                return;
            }
        } else if (paymentMethod === 'cash' && (
            !cashReceived || 
            parseFloat(cashReceived) < parseFloat(calculatedTotal)
        )) {
            setError('Cash received must be greater than or equal to the total amount.');
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
                    fixedDiscountAmount: parseFloat(special.fixedDiscountAmount) || 0, // Add this line
                    savedAmount: parseFloat(special.savedAmount) || 0
                })) : [],
                subtotalBeforeDiscounts: parseFloat(orderDetails.reduce((sum, item) =>
                    sum + ((parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0) * (parseInt(item.quantity) || 0)), 0).toFixed(2)),
                totalDiscount: parseFloat(appliedSpecials ?
                    appliedSpecials.reduce((sum, special) => sum + (parseFloat(special.savedAmount) || 0), 0).toFixed(2) : "0.00"),
                total: parseFloat(calculatedTotal), // ALIGNED: This is the sale.total for reports
                payment: {
                    method: paymentMethod,
                    // Extra payment details will be added conditionally below
                },
                paymentStatus: 'completed',
                orderNumber: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, // Shortened random part
                source: 'pos_system'
            };

            if (paymentMethod === 'cash') {
                const numericCashReceived = parseFloat(cashReceived);
                const numericTotal = parseFloat(calculatedTotal);
                saleDataPayload.payment.cashReceived = numericCashReceived;
                saleDataPayload.payment.change = numericCashReceived - numericTotal;
            }

            if (paymentMethod === 'voucher') {
                if (!voucherCode) {
                    setError('Please enter a voucher code.');
                    setProcessing(false);
                    return;
                }
                
                // We already have the validated voucher data, no need to fetch it again
                // Just use validatedVoucher instead of calling validateVoucher again
                if (!validatedVoucher) {
                    setError('Please validate the voucher code first.');
                    setProcessing(false);
                    return;
                }
                
                saleDataPayload.voucher = {
                    code: voucherCode,
                    id: validatedVoucher.id,
                    voucherType: validatedVoucher.voucherType,
                    discountType: validatedVoucher.discountType,
                    discountValue: validatedVoucher.discountValue,
                    value: parseFloat(totalPrice) - parseFloat(calculatedTotal) // The actual discount value applied
                };
                
                // Mark voucher as used - we'll use our dedicated function for this
                await markVoucherAsRedeemed(validatedVoucher.id);
                
                // If voucher has a specific value, it might adjust the total or act as full payment
                // For simplicity here, assuming voucher covers the total price if used.
                // Your specific voucher logic might differ (e.g. partial payment).
            }

            if (paymentMethod === 'voucher' && showSecondaryPayment) {
                saleDataPayload.payment.secondaryPayment = {
                    method: secondaryPaymentMethod,
                    amount: parseFloat(remainingAmount)
                };
                
                if (secondaryPaymentMethod === 'cash') {
                    saleDataPayload.payment.secondaryPayment.cashReceived = parseFloat(cashReceived);
                    saleDataPayload.payment.secondaryPayment.change = 
                        parseFloat(cashReceived) - parseFloat(remainingAmount);
                }
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
        if (processing) return 'Processing...';
        if (!staffAuth) return 'Staff Login Required';
        if (loadingUser) return 'Verifying...';
        if (!user) return 'Store Login Required';
        if (!paymentMethod) return 'Select Payment Method';

        if (paymentMethod === 'voucher') {
            if (!validatedVoucher) return 'Validate Voucher First';
            if (showSecondaryPayment && !secondaryPaymentMethod) return 'Select Secondary Payment';
            if (showSecondaryPayment) return `Pay R${remainingAmount} with ${secondaryPaymentMethod}`;
            return 'Complete with Voucher';
        }

        if (paymentMethod === 'cash') {
            if (!cashReceived || parseFloat(cashReceived) < parseFloat(calculatedTotal)) {
                return 'Enter Valid Cash Amount';
            }
        }

        return `Confirm Payment (R${calculatedTotal})`;
    };

    const subtotalBeforeDiscounts = orderDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const specialsDiscount = appliedSpecials.reduce((sum, special) => sum + special.savedAmount, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-neutral-800 text-neutral-50 rounded-lg shadow-lg p-6 max-w-lg w-full border border-neutral-700">
                <h2 className="text-2xl font-bold mb-4 text-white">Confirm Order</h2>
                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-neutral-200">Order Summary</h3>
                    <ul className="my-2 divide-y divide-neutral-700">
                        {orderDetails.map((item) => (
                            <li key={item.id} className="flex justify-between py-2 text-neutral-300">
                                <span>{item.name} {item.size && `(${item.size})`}</span>
                                <span>R{parseFloat(item.price).toFixed(2)} x {item.quantity}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="border-t border-neutral-700 pt-2 space-y-1">
                        <div className="flex justify-between font-semibold text-neutral-300">
                            <span>Subtotal</span>
                            <span>R{subtotalBeforeDiscounts.toFixed(2)}</span>
                        </div>
                        {specialsDiscount > 0 && (
                             <div className="flex justify-between text-sm text-green-400">
                                <span>Specials Discount</span>
                                <span>-R{specialsDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold mt-2 text-xl text-white">
                            <span>Total</span>
                            <span>R{numericTotalPrice.toFixed(2)}</span>
                        </div>
                    </div>
                    {validatedVoucher && (
                        <div className="mt-2">
                            <span className="text-green-400 text-sm">
                                Voucher Applied: {validatedVoucher.code} - 
                                {validatedVoucher.discountType === 'percentage' ? 
                                    ` ${validatedVoucher.discountValue}%` : 
                                    ` R${validatedVoucher.discountValue}`} off
                            </span>
                        </div>
                    )}
                </div>
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-neutral-200">Payment</h3>
                    <div className="flex gap-2 mt-2">
                        {paymentMethods.map(method => (
                            <button
                                key={method.id}
                                onClick={() => setPaymentMethod(method.id)}
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
                                ${paymentMethod === method.id ? 'bg-indigo-600 text-white' : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'}
                                `}
                            >
                                <span className="text-xl">{method.icon}</span>
                                {method.name}
                            </button>
                        ))}
                    </div>
                </div>
                {paymentMethod === 'cash' && !showSecondaryPayment && (
                     <div className="mb-4 p-4 bg-neutral-900/50 rounded-lg">
                        <label className="block text-sm font-medium text-neutral-400">
                            Cash Received
                        </label>
                        <input
                            type="number"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            className="mt-1 block w-full px-4 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter cash amount from customer"
                        />
                    </div>
                )}
                {paymentMethod === 'voucher' && (
                    <div className="mb-4 p-4 bg-neutral-900/50 rounded-lg">
                        <h3 className="text-lg font-semibold text-neutral-200">Voucher Code</h3>
                        <div className="flex gap-2 mt-2">
                            <input
                                type="text"
                                value={voucherCode}
                                onChange={(e) => setVoucherCode(e.target.value)}
                                className="flex-1 px-4 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Enter voucher code"
                            />
                            <button
                                onClick={applyVoucher}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold transition-all hover:bg-green-700"
                            >
                                Apply
                            </button>
                        </div>
                        {validatedVoucher && (
                            <div className="mt-2">
                                <button
                                    onClick={clearVoucher}
                                    className="text-red-400 text-sm underline"
                                >
                                    Clear Voucher
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {showSecondaryPayment && (
                    <div className="mb-4 p-4 bg-neutral-900/50 rounded-lg">
                        <h3 className="text-lg font-semibold text-neutral-200">Secondary Payment</h3>
                        <div className="flex gap-2 mt-2">
                            {secondaryPaymentMethods.map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => setSecondaryPaymentMethod(method.id)}
                                    className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
                                    ${secondaryPaymentMethod === method.id ? 'bg-indigo-600 text-white' : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'}
                                    `}
                                >
                                    <span className="text-xl">{method.icon}</span>
                                    {method.name}
                                </button>
                            ))}
                        </div>
                        {secondaryPaymentMethod === 'cash' && (
                            <div className="mt-2">
                                <label className="block text-sm font-medium text-neutral-400">
                                    Cash Received
                                </label>
                                <input
                                    type="number"
                                    value={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.value)}
                                    className="mt-1 block w-full px-4 py-2 border border-neutral-600 bg-neutral-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Enter cash received"
                                />
                            </div>
                        )}
                    </div>
                )}
                <div className="flex justify-between mt-6 border-t border-neutral-700 pt-4">
                    <button
                        onClick={() => onClose(false)}
                        className="px-6 py-2 bg-neutral-600 text-neutral-200 rounded-lg font-semibold transition-all hover:bg-neutral-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleConfirm(paymentMethod)}
                        className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
                        ${processing || !paymentMethod ? 'bg-indigo-800 text-neutral-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}
                        `}
                        disabled={processing || !paymentMethod}
                    >
                        {getPaymentButtonText()}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmOrder;