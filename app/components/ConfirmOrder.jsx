'use client';

import React from 'react';
import { FaCheckCircle } from 'react-icons/fa';
// Firebase imports
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '../../utils/firebase'; // Adjust path if needed
import { useAuthState } from 'react-firebase-hooks/auth';
import { useStore } from '../context/StoreContext';

// Component receives order details, total price, and a close handler
const ConfirmOrder = ({ orderDetails, totalPrice, onClose }) => {
  const db = getFirestore(); // Get Firestore instance
  const [user] = useAuthState(auth); // Get current user
  const { selectedStore } = useStore(); // Get selected store from context

  if (!orderDetails || orderDetails.length === 0) {
    return null; // Don't render if there's no order
  }

  // Function to handle the confirmation and database write
  const handleConfirm = async () => {
    if (!user) {
      console.error("User not logged in");
      // Add user feedback (e.g., alert or message in the modal)
      alert("You must be logged in to complete the sale.");
      return;
    }

    const saleData = {
      timestamp: serverTimestamp(), // Use Firestore server timestamp
        userId: user.uid, // Store user ID
        username: user.displayName || user.email, // Store username or email
        items: orderDetails.map(item => ({ // Store relevant item details
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: parseFloat(String(item.price).replace('R', '') || 0) // Store price as number
        })),
      totalPrice: parseFloat(String(totalPrice).replace('R', '') || 0), // Store total price as number
      storeName: selectedStore, // *** Add the selected store name ***
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
      // Add user feedback for error
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
                  <span>{item.quantity} x {item.name}</span>
                  {/* Ensure price is handled correctly */}
                  <span>R{(parseFloat(String(item.price).replace('R', '') || 0) * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
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
