'use client';

import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { auth } from '../../utils/firebase';
import db from '../../utils/firebase';
import { buildSaleDocument, parseMoney, roundMoney } from '../../utils/pricing';
import { getStoreId } from '../../utils/storeId';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const ConfirmOrder = ({ orderDetails, totalPrice, appliedSpecials, onClose }) => {
    const [user, loadingUser] = useAuthState(auth);
    const [staffAuth] = useState(() => {
        if (typeof window === 'undefined') return null;

        const authData = localStorage.getItem('staffAuth');
        if (!authData) return null;

        try {
            return JSON.parse(authData);
        } catch (e) {
            console.error('Error parsing staffAuth from localStorage:', e);
            return null;
        }
    });
    const [error, setError] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [secondaryPaymentMethod, setSecondaryPaymentMethod] = useState('');
    const [cashReceived, setCashReceived] = useState('');
    const [voucherCode, setVoucherCode] = useState('');
    const [processing, setProcessing] = useState(false);
    const [validatedVoucher, setValidatedVoucher] = useState(null);
    const [voucherDiscountAmount, setVoucherDiscountAmount] = useState(0);
    const [voucherDiscountedItems, setVoucherDiscountedItems] = useState([]);

    // FIX: Ensure totalPrice is always treated as a number
    const numericTotalPrice = parseFloat(totalPrice) || 0;
    const calculatedTotal = Math.max(0, numericTotalPrice - voucherDiscountAmount);
    const remainingAmount = calculatedTotal;
    const showSecondaryPayment = voucherDiscountAmount > 0 && calculatedTotal > 0;

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

    if (!orderDetails || orderDetails.length === 0) {
        return null;
    }

    const normalizeText = (value) => String(value || '').trim().toLowerCase();

    const getItemVariant = (item) => {
        if (!item) return '';
        if (item.size) return String(item.size);
        if (item.variety) return String(item.variety);
        if (item.selectedVariety) return String(item.selectedVariety);

        const itemId = String(item.id || '');
        if (itemId.includes('_')) {
            return itemId.split('_').slice(1).join('_');
        }

        return '';
    };

    const getFreeItemVoucherTarget = (voucherData, items) => {
        if (!voucherData?.freeItem || !Array.isArray(items)) {
            return null;
        }

        const freeItem =
            typeof voucherData.freeItem === 'object'
                ? voucherData.freeItem
                : { type: 'product', id: voucherData.freeItem, name: '', variety: '' };

        const requiredVariant = normalizeText(freeItem.variety || freeItem.variant || '');

        if (freeItem.type === 'category') {
            const categoryName = normalizeText(freeItem.name || freeItem.id);
            const matchingItems = items
                .filter((item) => normalizeText(item.category) === categoryName)
                .filter((item) => {
                    if (!requiredVariant) return true;
                    return normalizeText(getItemVariant(item)) === requiredVariant;
                })
                .sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));

            return matchingItems[0] || null;
        }

        const freeItemId = freeItem.id || '';
        return items.find((item) => {
            if (!item?.id) return false;
            const idMatches = item.id === freeItemId || item.id.startsWith(`${freeItemId}_`);
            if (!idMatches) return false;
            if (!requiredVariant) return true;
            return normalizeText(getItemVariant(item)) === requiredVariant;
        }) || null;
    };

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
            const currentStoreId = getStoreId(user) || staffAuth?.storeId;
            if (!voucherData.restrictedToStores.includes(currentStoreId)) {
                throw new Error('This voucher cannot be used at this location.');
            }
        }

        if (voucherData.voucherType === 'freeItem') {
            const freeItemTarget = getFreeItemVoucherTarget(voucherData, orderDetails);
            if (!freeItemTarget) {
                throw new Error('This voucher can only be applied to matching items in your cart.');
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

            let voucherDiscount = 0;
            let discountedItems = [];

            // Find applicable items in the order
            let applicableOrderItems = orderDetails;
            if (voucherData.applicableItems && voucherData.applicableItems.length > 0) {
                applicableOrderItems = orderDetails.filter(item =>
                    voucherData.applicableItems.includes(item.id)
                );
            }

            const applicableItemsTotal = applicableOrderItems.reduce(
                (sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0
            );

            if (voucherData.voucherType === 'discount') {
                if (voucherData.discountType === 'percentage') {
                    voucherDiscount = (applicableItemsTotal * voucherData.discountValue) / 100;
                    discountedItems = applicableOrderItems.map(item => ({
                        id: item.id,
                        name: item.name,
                        discount: (parseFloat(item.price) * parseInt(item.quantity)) * voucherData.discountValue / 100
                    }));
                } else if (voucherData.discountType === 'fixed') {
                    voucherDiscount = Math.min(applicableItemsTotal, voucherData.discountValue);
                    discountedItems = [{
                        id: 'fixed-discount',
                        name: 'Fixed Discount',
                        discount: voucherDiscount
                    }];
                }
            } else if (voucherData.voucherType === 'freeItem') {
                const freeItemInOrder = getFreeItemVoucherTarget(voucherData, orderDetails);
                if (freeItemInOrder) {
                    const itemPrice = parseFloat(freeItemInOrder.price) || 0;
                    voucherDiscount = itemPrice;
                    discountedItems = [{
                        id: freeItemInOrder.id,
                        name: freeItemInOrder.name,
                        discount: itemPrice
                    }];
                }
            } else if (voucherData.voucherType === 'value' || voucherData.voucherType === 'giftCard') {
                // Value voucher (gift card)
                const valueAvailable = parseFloat(voucherData.currentBalance || voucherData.initialValue || 0);
                voucherDiscount = Math.min(numericTotalPrice, valueAvailable);
                discountedItems = [{
                    id: 'value-voucher',
                    name: 'Voucher Value Used',
                    discount: voucherDiscount
                }];
                // Show remaining balance in UI if needed
            }
            // Add more voucher types as needed...

            setVoucherDiscountedItems(discountedItems);
            setVoucherDiscountAmount(voucherDiscount);

        } catch (error) {
            setError(error.message);
            setValidatedVoucher(null);
            setVoucherDiscountAmount(0);
            setVoucherDiscountedItems([]);
        }
    };
    
    // Clear the applied voucher
    const clearVoucher = () => {
        setVoucherCode('');
        setValidatedVoucher(null);
        setVoucherDiscountAmount(0);
        setVoucherDiscountedItems([]);
    };

    // Mark voucher as redeemed in database
    const markVoucherAsRedeemed = async (voucherId) => {
        if (!voucherId) return;

        try {
            const voucherRef = doc(db, 'vouchers', voucherId);
            const voucherDoc = await getDoc(voucherRef);
            if (!voucherDoc.exists()) {
                console.error('Voucher document not found');
                return;
            }

            const voucherData = voucherDoc.data();
            const currentRedemptionCount = voucherData.redemptionCount || 0;

            const updateData = {
                redemptionCount: increment(1),
                lastRedeemedAt: serverTimestamp(),
                lastRedeemedBy: {
                    staffId: staffAuth?.staffId,
                    staffName: staffAuth?.staffName,
                    role: staffAuth?.accountType,
                    storeId: getStoreId(user) || staffAuth?.storeId,
                },
                redemptionHistory: arrayUnion({
                    timestamp: new Date().toISOString(),
                    staffId: staffAuth?.staffId,
                    staffName: staffAuth?.staffName,
                    storeId: getStoreId(user) || staffAuth?.storeId,
                })
            };

            // Deduct value for value/giftCard vouchers
            if (
                validatedVoucher &&
                (validatedVoucher.voucherType === 'value' || validatedVoucher.voucherType === 'giftCard')
            ) {
                const usedValue = voucherDiscountedItems.reduce((sum, item) => sum + (item.discount || 0), 0);
                updateData.currentBalance = Math.max(0, (voucherData.currentBalance || voucherData.initialValue || 0) - usedValue);
                // If balance is now zero, mark as redeemed/inactive
                if (updateData.currentBalance <= 0) {
                    updateData.redeemed = true;
                    updateData.active = false;
                }
            }

            if (validatedVoucher?.expireAfterRedemption) {
                updateData.redeemed = true;
                updateData.active = false;
            } else if (validatedVoucher?.maxRedemptions && 
                      (currentRedemptionCount + 1) >= validatedVoucher.maxRedemptions) {
                updateData.active = false;
            }

            await updateDoc(voucherRef, updateData);

        } catch (error) {
            console.error('Error marking voucher as redeemed:', error);
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
        const determinedStoreId = getStoreId(user) || staffAuth?.storeId; 
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

            const paymentExtras = {};

            if (paymentMethod === 'cash') {
                const numericCashReceived = parseMoney(cashReceived);
                const numericTotal = parseMoney(calculatedTotal);
                paymentExtras.cashReceived = numericCashReceived;
                paymentExtras.change = roundMoney(numericCashReceived - numericTotal);
            }

            let voucherPayload = null;

            if (paymentMethod === 'voucher') {
                if (!voucherCode) {
                    setError('Please enter a voucher code.');
                    setProcessing(false);
                    return;
                }

                if (!validatedVoucher) {
                    setError('Please validate the voucher code first.');
                    setProcessing(false);
                    return;
                }

                voucherPayload = {
                    code: voucherCode,
                    id: validatedVoucher.id,
                    voucherType: validatedVoucher.voucherType,
                    ...(validatedVoucher.discountType !== undefined && {
                        discountType: validatedVoucher.discountType,
                    }),
                    ...(validatedVoucher.discountValue !== undefined && {
                        discountValue: validatedVoucher.discountValue,
                    }),
                    value: parseMoney(totalPrice) - parseMoney(calculatedTotal),
                };

                await markVoucherAsRedeemed(validatedVoucher.id);
            }

            if (paymentMethod === 'voucher' && showSecondaryPayment) {
                paymentExtras.secondaryPayment = {
                    method: secondaryPaymentMethod,
                    amount: parseMoney(remainingAmount),
                };

                if (secondaryPaymentMethod === 'cash') {
                    const numericCashReceived = parseMoney(cashReceived);
                    const numericRemaining = parseMoney(remainingAmount);
                    paymentExtras.secondaryPayment.cashReceived = numericCashReceived;
                    paymentExtras.secondaryPayment.change = roundMoney(
                        numericCashReceived - numericRemaining
                    );
                }
            }

            saleDataPayload = buildSaleDocument({
                storeId: determinedStoreId,
                storeName: user.email,
                staffAuth,
                orderDetails,
                appliedSpecials,
                netTotal: calculatedTotal,
                paymentMethod,
                payment: paymentExtras,
                voucher: voucherPayload,
            });
            saleDataPayload.date = serverTimestamp();

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

    if (typeof document === 'undefined') return null;

    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(false); }}>
        <DialogContent className="h-[95vh] w-[min(96vw,1200px)] max-w-none overflow-hidden border-white/10 bg-neutral-900 p-0 text-neutral-50">
          <div className="flex h-full min-h-0 flex-col bg-neutral-900/95 p-4 md:p-6">
            <DialogHeader className="mb-4 border-b border-white/10 pb-3 text-left">
              <DialogTitle className="text-2xl font-bold text-white">Checkout</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Review the order and complete payment.
              </DialogDescription>
            </DialogHeader>

            <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] md:gap-6">
              <div className="min-w-0 overflow-y-auto rounded-2xl border border-white/10 bg-neutral-800/70 p-4">
                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-neutral-200">Order Summary</h3>
                  <ul className="my-2 divide-y divide-neutral-700">
                    {orderDetails.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4 py-2.5 text-neutral-300">
                        <span className="min-w-0 break-words">
                          {item.name} {item.size && `(${item.size})`}
                        </span>
                        <span className="shrink-0 whitespace-nowrap">
                          R{parseFloat(item.price).toFixed(2)} x {item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-1 border-t border-neutral-700 pt-2">
                    <div className="flex justify-between font-semibold text-neutral-300">
                      <span>Subtotal</span>
                      <span>R{subtotalBeforeDiscounts.toFixed(2)}</span>
                    </div>
                    {appliedSpecials && appliedSpecials.length > 0 && (
                      <div className="text-sm text-green-400">
                        <div className="mb-1 flex justify-between font-semibold">
                          <span>Specials Applied:</span>
                          <span>-R{specialsDiscount.toFixed(2)}</span>
                        </div>
                        {appliedSpecials.map((special, index) => (
                          <div key={index} className="ml-2 flex justify-between text-xs text-green-300">
                            <span>
                              • {special.name}
                              {special.instanceNumber && special.totalInstances && (
                                <span className="text-neutral-400"> (#{special.instanceNumber})</span>
                              )}
                            </span>
                            <span>-R{parseFloat(special.savedAmount || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {validatedVoucher && voucherDiscountedItems.length > 0 && (
                      <div className="flex justify-between text-sm text-yellow-400">
                        <span>Voucher: {validatedVoucher.name || validatedVoucher.code}</span>
                        <span>
                          -R{voucherDiscountedItems.reduce((sum, item) => sum + (item.discount || 0), 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 flex justify-between text-xl font-bold text-white">
                      <span>Total</span>
                      <span>R{Number(calculatedTotal).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-col justify-between overflow-y-auto rounded-2xl border border-white/10 bg-neutral-800/70 p-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-200">Payment</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {paymentMethods.map((method) => (
                      <Button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        variant={paymentMethod === method.id ? 'default' : 'outline'}
                        className={`min-h-14 justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all ${
                          paymentMethod === method.id
                            ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                            : 'border-white/10 bg-white/10 text-neutral-300 hover:bg-white/15'
                        }`}
                      >
                        <span className="text-xl">{method.icon}</span>
                        {method.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'cash' && !showSecondaryPayment && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900/50 p-4">
                    <label className="block text-sm font-medium text-neutral-400">Cash Received</label>
                    <Input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="mt-1 block min-h-12 w-full border-white/10 bg-white/10 px-4 py-2 text-white focus-visible:border-cyan-300/50 focus-visible:ring-cyan-400/20"
                      placeholder="Enter cash amount from customer"
                    />
                  </div>
                )}

                {paymentMethod === 'voucher' && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900/50 p-4">
                    <h3 className="text-lg font-semibold text-neutral-200">Voucher Code</h3>
                    <div className="mt-2 flex gap-2">
                      <Input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value)}
                        className="flex-1 min-h-12 border-white/10 bg-white/10 px-4 py-2 text-white focus-visible:border-cyan-300/50 focus-visible:ring-cyan-400/20"
                        placeholder="Enter voucher code"
                      />
                      <Button
                        type="button"
                        onClick={applyVoucher}
                        className="min-h-12 rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-white transition-all hover:bg-cyan-600"
                      >
                        Apply
                      </Button>
                    </div>
                    {validatedVoucher && (
                      <div className="mt-2">
                        <button onClick={clearVoucher} className="text-sm text-red-400 underline">
                          Clear Voucher
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {showSecondaryPayment && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900/50 p-4">
                    <h3 className="text-lg font-semibold text-neutral-200">Secondary Payment</h3>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {secondaryPaymentMethods.map((method) => (
                        <Button
                          key={method.id}
                          type="button"
                          onClick={() => setSecondaryPaymentMethod(method.id)}
                          variant={secondaryPaymentMethod === method.id ? 'default' : 'outline'}
                          className={`min-h-12 justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all ${
                            secondaryPaymentMethod === method.id
                              ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                              : 'border-white/10 bg-white/10 text-neutral-300 hover:bg-white/15'
                          }`}
                        >
                          <span className="text-xl">{method.icon}</span>
                          {method.name}
                        </Button>
                      ))}
                    </div>
                    {secondaryPaymentMethod === 'cash' && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-neutral-400">Cash Received</label>
                        <Input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="mt-1 block min-h-12 w-full border-white/10 bg-white/10 px-4 py-2 text-white focus-visible:border-cyan-300/50 focus-visible:ring-cyan-400/20"
                          placeholder="Enter cash received"
                        />
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter className="mt-6 grid grid-cols-2 gap-2 border-t border-neutral-700 pt-4 sm:justify-stretch">
                  <Button
                    type="button"
                    onClick={() => onClose(false)}
                    variant="outline"
                    className="min-h-12 rounded-xl border-white/10 bg-white/10 px-6 py-2 font-semibold text-neutral-200 transition-all hover:bg-white/15"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleConfirm(paymentMethod)}
                    className={`min-h-12 justify-center gap-2 rounded-xl px-6 py-2 font-semibold transition-all ${
                      processing || !paymentMethod
                        ? 'cursor-not-allowed bg-blue-900/60 text-neutral-400'
                        : 'bg-cyan-500 text-white hover:bg-cyan-600'
                    }`}
                    disabled={processing || !paymentMethod}
                  >
                    {getPaymentButtonText()}
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
};

export default ConfirmOrder;
