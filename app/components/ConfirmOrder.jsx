'use client';

import React, { useEffect, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { auth } from '../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const ConfirmOrder = ({ orderDetails, totalPrice, appliedSpecials, onClose }) => {
  const db = getFirestore();
  const [user] = useAuthState(auth);
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
    const auth = localStorage.getItem('staffAuth');
    if (auth) {
      setStaffAuth(JSON.parse(auth));
    }
  }, []);

  if (!orderDetails || orderDetails.length === 0) {
    return null;
  }

  const validateVoucher = async (code) => {
    try {
      const vouchersRef = collection(db, 'vouchers');
      const q = query(vouchersRef, 
        where('code', '==', code),
        where('active', '==', true),
        where('expirationDate', '>', new Date().toISOString())
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error('Invalid or expired voucher code');
      }
      
      return snapshot.docs[0];
    } catch (error) {
      throw new Error('Failed to validate voucher');
    }
  };

  const handleConfirm = async () => {
    if (!user) {
      setError("Store account must be logged in to complete the sale.");
      return;
    }

    if (!staffAuth) {
      setError("Staff member must be logged in to complete the sale.");
      return;
    }

    try {
      setProcessing(true);

      if (!paymentMethod) {
        setError('Please select a payment method');
        return;
      }

      if (paymentMethod === 'cash' && parseFloat(cashReceived) < parseFloat(totalPrice)) {
        setError('Insufficient cash received');
        return;
      }

      if (paymentMethod === 'voucher') {
        if (!voucherCode) {
          setError('Please enter a voucher code');
          return;
        }
        
        try {
          const voucher = await validateVoucher(voucherCode);
          saleData.voucher = {
            code: voucherCode,
            id: voucher.id
          };
          
          await updateDoc(doc(db, 'vouchers', voucher.id), {
            active: false,
            usedAt: new Date().toISOString(),
            usedBy: {
              staffId: staffAuth.staffId,
              staffName: staffAuth.staffName
            }
          });
        } catch (error) {
          setError(error.message);
          return;
        }
      }

      const subtotalBeforeDiscounts = orderDetails.reduce((sum, item) => 
        sum + (parseFloat(item.price) * item.quantity), 0);
      
      const totalDiscount = appliedSpecials ? 
        appliedSpecials.reduce((sum, special) => sum + (parseFloat(special.savedAmount) || 0), 0) : 0;

      const saleData = {
        storeId: user.uid,
        storeName: user.email,
        staffId: staffAuth.staffId,
        staffName: staffAuth.staffName,
        staffRole: staffAuth.accountType,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
        items: orderDetails.map(item => ({
          id: item.id,
          name: item.name,
          size: item.size || null,
          quantity: parseInt(item.quantity) || 0,
          price: parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0,
          subtotal: (parseFloat(item.price) * item.quantity).toFixed(2)
        })),
        appliedSpecials: appliedSpecials ? appliedSpecials.map(special => ({
          id: special.id || '',
          name: special.name || '',
          triggerProduct: special.triggerProduct || '',
          rewardProduct: special.rewardProduct || '',
          discountType: special.discountType || 'free',
          discountValue: parseFloat(special.discountValue) || 0,
          savedAmount: parseFloat(special.savedAmount) || 0
        })) : [],
        subtotalBeforeDiscounts: parseFloat(subtotalBeforeDiscounts.toFixed(2)),
        totalDiscount: parseFloat(totalDiscount.toFixed(2)),
        finalTotal: parseFloat(String(totalPrice).replace(/[^\d.-]/g, '')) || 0,
        payment: {
          method: paymentMethod,
          cashReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) : null,
          change: paymentMethod === 'cash' ? parseFloat(cashReceived) - parseFloat(totalPrice) : null,
          processedAt: new Date().toISOString()
        },
        paymentStatus: 'completed',
        orderNumber: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: 'pos_system'
      };

      const salesCollectionRef = collection(db, 'sales');
      await addDoc(salesCollectionRef, saleData);
      
      console.log("Sale recorded successfully!", saleData);
      localStorage.removeItem('orderDetails');
      window.location.reload();
      onClose();

    } catch (error) {
      console.error("Error recording sale: ", error);
      setError(`Error processing payment: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const getPaymentButtonText = () => {
    if (!staffAuth) return 'Staff Login Required';
    switch (paymentMethod) {
      case 'card': return 'Process Card Payment';
      case 'cash': return 'Complete Cash Payment';
      case 'snapscan': return 'Confirm SnapScan Payment';
      case 'voucher': return 'Redeem Voucher';
      default: return 'Select Payment Method';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="border bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-1/2 text-white">
        <h2 className="text-2xl font-bold mb-6">Complete Sale</h2>
        <div className="flex flex-row items-center justify-between mb-4 gap-4">          
          <div className="flex flex-col items-center text-center w-1/2">          
            
            <div className="w-full bg-neutral-900 p-2 rounded-md mb-4 text-sm">
              <p>Store: {user?.email}</p>
              <p>Staff: {staffAuth?.staffName} ({staffAuth?.accountType})</p>
            </div>

            <div className="w-full bg-neutral-700 p-4 rounded-md mb-4 overflow-y-auto">
              <h3 className="text-lg font-semibold mb-2 text-left">Your Order:</h3>
              <ul className="text-sm text-left space-y-1">
                {orderDetails.map(item => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.quantity} x {item.name} {item.size && `(${item.size})`}</span>
                    <span>R{(parseFloat(String(item.price).replace('R', '') || 0) * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              {appliedSpecials.length > 0 && (
                <>
                  <hr className="my-2 border-neutral-600"/>
                  <h4 className="text-sm font-semibold text-green-400">Applied Specials:</h4>
                  <ul className="text-sm text-left space-y-1">
                    {appliedSpecials.map((special, index) => (
                      <li key={index} className="flex justify-between text-green-400">
                        <span>{special.name}</span>
                        <span>-R {special.savedAmount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <hr className="my-2 border-neutral-600"/>
              <div className="flex justify-between font-bold text-base">
                <span>Total:</span>
                <span>R{totalPrice}</span>
              </div>
            </div>

          </div>
          <div className="flex flex-col items-center text-center w-1/2">

            <div className="w-full mb-4">
              <h3 className="text-lg font-semibold mb-2 text-left">Payment Method</h3>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3 rounded-md flex items-center justify-center gap-2 transition-colors
                      ${paymentMethod === method.id 
                        ? 'bg-indigo-600 hover:bg-indigo-700' 
                        : 'bg-neutral-700 hover:bg-neutral-600'}`}
                  >
                    <span>{method.icon}</span>
                    <span>{method.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Cash Received</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full p-2 bg-neutral-700 rounded"
                  placeholder="Enter amount"
                  step="0.01"
                  min={totalPrice}
                />
                {cashReceived && parseFloat(cashReceived) >= parseFloat(totalPrice) && (
                  <div className="mt-2 text-green-400">
                    Change: R {(parseFloat(cashReceived) - parseFloat(totalPrice)).toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'voucher' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Voucher Code</label>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="w-full p-2 bg-neutral-700 rounded"
                  placeholder="Enter voucher code"
                  maxLength="8"
                />
              </div>
            )}

            {error && (
              <div className="w-full bg-red-600/20 border border-red-500 text-red-100 p-3 rounded-md mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!staffAuth || !user || !paymentMethod || processing}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 mb-4
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : getPaymentButtonText()}
            </button>
            
            <button
              onClick={onClose}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Cancel
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmOrder;
