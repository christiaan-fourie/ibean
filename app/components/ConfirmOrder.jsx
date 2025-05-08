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
        setCalculatedTotal(totalPrice);
        setValidatedVoucher(null);
        setRemainingAmount(0);
        setShowSecondaryPayment(false);
        setSecondaryPaymentMethod('');
        setVoucherDiscountedItems([]);
    }, [totalPrice]);

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
        if (voucherData.minimumPurchase && parseFloat(totalPrice) < parseFloat(voucherData.minimumPurchase)) {
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
            
            let newTotal = parseFloat(totalPrice);
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
        setCalculatedTotal(totalPrice);
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
    
    const numericTotalPriceForDisplay = parseFloat(String(calculatedTotal).replace(/[^\d.-]/g, '')) || 0;

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

                        {validatedVoucher && validatedVoucher.voucherType === 'discount' && (
                            <>
                                <hr className="my-2 border-neutral-600" />
                                <div className="flex justify-between text-green-400 font-medium">
                                    <span>Voucher: {validatedVoucher.name}</span>
                                    <span>-R {(parseFloat(totalPrice) - parseFloat(calculatedTotal)).toFixed(2)}</span>
                                </div>
                            </>
                        )}

                        {validatedVoucher && validatedVoucher.voucherType === 'freeItem' && (
                            <>
                                <hr className="my-2 border-neutral-600" />
                                <div className="text-green-400 font-medium">
                                    <span>Free Item: {typeof validatedVoucher.freeItem === 'object' 
                                        ? validatedVoucher.freeItem.name 
                                        : validatedVoucher.freeItem}</span>
                                </div>
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
                                <div className="flex items-center gap-2 mb-3">
                                    <label htmlFor="voucherCode" className="block text-sm font-medium">Voucher Code:</label>
                                    <input
                                        type="text"
                                        id="voucherCode"
                                        value={voucherCode}
                                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                                        className="flex-1 w-full p-2 bg-neutral-600 rounded text-white placeholder-neutral-400"
                                        placeholder="Enter voucher code"
                                        maxLength="8"
                                        disabled={validatedVoucher !== null}
                                    />
                                    {!validatedVoucher ? (
                                        <button 
                                            onClick={applyVoucher}
                                            disabled={!voucherCode || voucherCode.length < 4}
                                            className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium
                                            hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Validate
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={clearVoucher}
                                            className="px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium
                                            hover:bg-red-700"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                
                                {validatedVoucher && (
                                    <div className="bg-neutral-800 p-3 rounded-md border border-neutral-700 mb-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-green-400">{validatedVoucher.name}</span>
                                            <span className="text-xs text-neutral-400">
                                                {validatedVoucher.expirationDate ? 
                                                    `Expires: ${new Date(validatedVoucher.expirationDate.seconds * 1000).toLocaleDateString()}` : 
                                                    'No expiration'}
                                            </span>
                                        </div>
                                        
                                        <div className="text-sm">
                                            {validatedVoucher.voucherType === 'discount' && validatedVoucher.discountType === 'percentage' && (
                                                <span className="text-green-400 font-medium">{validatedVoucher.discountValue}% discount applied</span>
                                            )}
                                            {validatedVoucher.voucherType === 'discount' && validatedVoucher.discountType === 'fixed' && (
                                                <span className="text-green-400 font-medium">R{validatedVoucher.discountValue.toFixed(2)} discount applied</span>
                                            )}
                                            {validatedVoucher.voucherType === 'freeItem' && (
                                                <span className="text-green-400 font-medium">
                                                    Free item: {typeof validatedVoucher.freeItem === 'object' ? 
                                                        validatedVoucher.freeItem.name : 
                                                        validatedVoucher.freeItem}
                                                </span>
                                            )}
                                            {validatedVoucher.voucherType === 'buyXGetY' && (
                                                <span className="text-green-400 font-medium">
                                                    Buy one, get one free deal applied
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="flex justify-between items-center mt-2 text-sm">
                                            <span className="text-white">Discount amount:</span>
                                            <span className="text-green-400 font-medium">-R {(parseFloat(totalPrice) - parseFloat(calculatedTotal)).toFixed(2)}</span>
                                        </div>

                                        {/* Display voucher usage info */}
                                        {validatedVoucher.redemptionCount > 0 && (
                                            <div className="mt-2 pt-2 border-t border-neutral-700 text-xs text-neutral-400">
                                                <span>Used {validatedVoucher.redemptionCount} {validatedVoucher.redemptionCount === 1 ? 'time' : 'times'} previously</span>
                                                {validatedVoucher.maxRedemptions && (
                                                    <span className="ml-1">
                                                        ({validatedVoucher.maxRedemptions - validatedVoucher.redemptionCount} uses remaining)
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {validatedVoucher.expireAfterRedemption && (
                                            <div className="mt-1 text-xs text-yellow-400">
                                                ⚠️ This voucher will expire after use
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {voucherDiscountedItems && voucherDiscountedItems.length > 0 && (
                                    <div className="mb-3 p-2 bg-neutral-800 rounded-md border border-neutral-700 text-sm">
                                        <div className="text-green-400 font-medium mb-1">Discounted items:</div>
                                        <ul className="list-disc pl-5 text-xs space-y-1">
                                            {voucherDiscountedItems.map((item, index) => (
                                                <li key={index} className="text-neutral-300">
                                                    {item.name}: <span className="text-green-400">-R{item.discount.toFixed(2)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                {showSecondaryPayment && (
                                    <div className="mt-4 pt-4 border-t border-neutral-600">
                                        <h4 className="text-sm font-medium text-white mb-2">
                                            Pay Remaining Amount (R{remainingAmount.toFixed(2)})
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            {secondaryPaymentMethods.map(method => (
                                                <button
                                                    key={method.id}
                                                    onClick={() => {
                                                        setSecondaryPaymentMethod(method.id);
                                                        setError('');
                                                    }}
                                                    className={`p-2 rounded-md flex items-center justify-center gap-1 text-sm
                                                    ${secondaryPaymentMethod === method.id
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                                    }`}
                                                >
                                                    <span>{method.icon}</span>
                                                    <span>{method.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                        
                                        {secondaryPaymentMethod === 'cash' && (
                                            <div className="p-2 bg-neutral-800 rounded">
                                                <label htmlFor="cashReceived" className="block text-xs font-medium mb-1">
                                                    Cash Received:
                                                </label>
                                                <input
                                                    type="number"
                                                    id="cashReceived"
                                                    value={cashReceived}
                                                    onChange={(e) => setCashReceived(e.target.value)}
                                                    className="w-full p-2 bg-neutral-600 rounded text-white placeholder-neutral-400 text-sm"
                                                    placeholder="Enter amount received"
                                                    step="0.01"
                                                    min={remainingAmount.toFixed(2)}
                                                />
                                                {cashReceived && parseFloat(cashReceived) >= remainingAmount && (
                                                    <div className="mt-1 text-xs text-green-400">
                                                        Change Due: R {(parseFloat(cashReceived) - remainingAmount).toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="pt-2 space-y-3">
                             <button
                                onClick={handleConfirm}
                                disabled={!staffAuth || !user || !paymentMethod || processing || loadingUser || 
                                    (paymentMethod === 'voucher' && !validatedVoucher) ||
                                    (paymentMethod === 'voucher' && showSecondaryPayment && !secondaryPaymentMethod) ||
                                    (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < numericTotalPriceForDisplay)) ||
                                    (paymentMethod === 'voucher' && showSecondaryPayment && secondaryPaymentMethod === 'cash' && 
                                        (!cashReceived || parseFloat(cashReceived) < remainingAmount))
                                }
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