'use client';

import React, { useEffect, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const ConfirmOrder = ({ orderDetails, totalPrice, appliedSpecials, onClose }) => {
  const db = getFirestore();
  const [user] = useAuthState(auth);
  const [staffAuth, setStaffAuth] = useState(null);
  const [error, setError] = useState('');

  // Get staff authentication on component mount
  useEffect(() => {
    const auth = localStorage.getItem('staffAuth');
    if (auth) {
      setStaffAuth(JSON.parse(auth));
    }
  }, []);

  if (!orderDetails || orderDetails.length === 0) {
    return null;
  }

  const handleConfirm = async () => {
    // Validation checks
    if (!user) {
      setError("Store account must be logged in to complete the sale.");
      return;
    }

    if (!staffAuth) {
      setError("Staff member must be logged in to complete the sale.");
      return;
    }

    // Calculate various totals
    const subtotalBeforeDiscounts = orderDetails.reduce((sum, item) => 
      sum + (parseFloat(item.price) * item.quantity), 0);
    
    const totalDiscount = appliedSpecials ? 
      appliedSpecials.reduce((sum, special) => sum + (parseFloat(special.savedAmount) || 0), 0) : 0;

    // Prepare comprehensive sale data
    const saleData = {
      // Store Information
      storeId: user.uid,
      storeName: user.email,
      
      // Staff Information
      staffId: staffAuth.staffId,
      staffName: staffAuth.staffName,
      staffRole: staffAuth.accountType,

      // Timestamp Information
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      
      // Order Details
      items: orderDetails.map(item => ({
        id: item.id,
        name: item.name,
        size: item.size || null,
        quantity: parseInt(item.quantity) || 0,
        price: parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0,
        subtotal: (parseFloat(item.price) * item.quantity).toFixed(2)
      })),

      // Special Offers & Discounts
      appliedSpecials: appliedSpecials ? appliedSpecials.map(special => ({
        id: special.id || '',
        name: special.name || '',
        triggerProduct: special.triggerProduct || '',
        rewardProduct: special.rewardProduct || '',
        discountType: special.discountType || 'free',
        discountValue: parseFloat(special.discountValue) || 0,
        savedAmount: parseFloat(special.savedAmount) || 0
      })) : [],

      // Financial Totals
      subtotalBeforeDiscounts: parseFloat(subtotalBeforeDiscounts.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      finalTotal: parseFloat(String(totalPrice).replace(/[^\d.-]/g, '')) || 0,

      // Payment Details
      paymentMethod: 'card', // Add more payment methods if needed
      paymentStatus: 'completed',

      // Additional Tracking
      orderNumber: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: 'pos_system'
    };

    try {
      const salesCollectionRef = collection(db, 'sales');
      await addDoc(salesCollectionRef, saleData);
      
      console.log("Sale recorded successfully!", saleData);
      localStorage.removeItem('orderDetails');
      window.location.reload();
      onClose();

    } catch (error) {
      console.error("Error recording sale: ", error);
      setError(`Error recording sale: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="border bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-md text-white">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl font-bold mb-6">Complete Sale</h2>

          {/* Staff & Store Info */}
          <div className="w-full bg-neutral-900 p-2 rounded-md mb-4 text-sm">
            <p>Store: {user?.email}</p>
            <p>Staff: {staffAuth?.staffName} ({staffAuth?.accountType})</p>
          </div>

          {/* Order Summary */}
          <div className="w-full bg-neutral-700 p-4 rounded-md mb-4 max-h-48 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2 text-left">Your Order:</h3>
            <ul className="text-sm text-left space-y-1">
              {orderDetails.map(item => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.quantity} x {item.name} {item.size && `(${item.size})`}</span>
                  <span>R{(parseFloat(String(item.price).replace('R', '') || 0) * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            {/* Display Applied Specials */}
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

          {error && (
            <div className="w-full bg-red-600/20 border border-red-500 text-red-100 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={handleConfirm}
            disabled={!staffAuth || !user}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 mb-4
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!staffAuth ? 'Staff Login Required' : 'Charge Card'}
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
  );
};

export default ConfirmOrder;
