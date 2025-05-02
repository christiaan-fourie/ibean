'use client';

import React from 'react';
import { FaCheckCircle } from 'react-icons/fa';
// Firebase imports
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '../../utils/firebase'; // Adjust path if needed
import { useAuthState } from 'react-firebase-hooks/auth';
import { useStore } from '../context/StoreContext';

// Component receives order details, total price, applied specials, and a close handler
const ConfirmOrder = ({ orderDetails, totalPrice, appliedSpecials, onClose }) => {
  const db = getFirestore(); // Get Firestore instance
  const [user] = useAuthState(auth); // Get current user
  const { selectedStore } = useStore(); // Get selected store from context

  if (!orderDetails || orderDetails.length === 0) {
    return null; // Don't render if there's no order
  }

  // Function to handle the confirmation and database write
  const handleConfirm = async () => {
    if (!user) {
      alert("You must be logged in to complete the sale.");
      return;
    }

    const saleData = {
      timestamp: serverTimestamp(),
      userId: user.uid,
      username: user.displayName || user.email,
      items: orderDetails.map(item => ({
        id: item.id,
        name: item.name,
        size: item.size || null, // Provide default value
        quantity: parseInt(item.quantity) || 0, // Ensure number
        price: parseFloat(String(item.price).replace(/[^\d.-]/g, '')) || 0 // Better price parsing
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
      totalDiscount: appliedSpecials ? 
        appliedSpecials.reduce((sum, special) => sum + (parseFloat(special.savedAmount) || 0), 0) : 0,
      subtotalBeforeDiscounts: parseFloat(String(totalPrice).replace(/[^\d.-]/g, '')) + 
        (appliedSpecials ? 
          appliedSpecials.reduce((sum, special) => sum + (parseFloat(special.savedAmount) || 0), 0) : 0),
      totalPrice: parseFloat(String(totalPrice).replace(/[^\d.-]/g, '')) || 0,
      storeName: selectedStore || 'Unknown Store',
      createdAt: new Date().toISOString() // Add timestamp for tracking
    };

    try {
      const salesCollectionRef = collection(db, 'sales');

      await addDoc(salesCollectionRef, saleData);

      console.log("Sale recorded successfully!");
      localStorage.removeItem('orderDetails'); // Clear order details from local storage
      window.location.reload(); // Refresh the page to update the order list
      onClose(); // Close the modal after successful recording

    } catch (error) {
      console.error("Error recording sale: ", error);
      alert(`Error recording sale: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="border bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-md text-white">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl font-bold mb-6">Complete Sale</h2>

          {/* Order Summary in Modal */}
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

          {/* Charge Card Button */}
          <button
            onClick={handleConfirm} // Call handleConfirm on click
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 mb-4"
          >
            Charge Card
          </button>
          {/* Cancel Button */}
          <button
            onClick={onClose} // Keep onClose for the Cancel button
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmOrder;
