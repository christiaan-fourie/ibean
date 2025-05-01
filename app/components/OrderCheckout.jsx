'use client';

import React, { useState, useEffect } from 'react';
import { FaPlus, FaMinus } from 'react-icons/fa';
import { ImBin } from 'react-icons/im';
import ConfirmOrder from './ConfirmOrder';

export default function OrderCheckout() {
  // State to track order details
  const [orderDetails, setOrderDetails] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleCheckout = () => {
    console.log('Checkout button clicked');
    setShowConfirmation(true);
  };

  // Load order details from localStorage on mount
  useEffect(() => {
    const storedData = localStorage.getItem('orderDetails');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        // Ensure data is an array and items have numeric price
        if (Array.isArray(parsedData)) {
             const validatedData = parsedData.map(item => ({
                 ...item,
                 price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^\d.-]/g, '')),
                 quantity: typeof item.quantity === 'number' ? item.quantity : 1
             })).filter(item => !isNaN(item.price) && item.quantity > 0); // Filter out invalid items
             setOrderDetails(validatedData);
        } else {
            setOrderDetails([]); // Set empty if stored data is not array
            localStorage.removeItem('orderDetails'); // Clear invalid storage
        }
      } catch (e) {
        console.error("Failed to parse order details from localStorage", e);
        setOrderDetails([]); // Reset on error
        localStorage.removeItem('orderDetails'); // Clear invalid storage
      }
    }

    const handleStorageChange = (event) => {
       // Check if the change was for 'orderDetails' key specifically if needed
        if (event.key === 'orderDetails' || event.key === null) { // null check for direct localStorage.setItem calls
             const updatedData = localStorage.getItem('orderDetails');
            if (updatedData) {
                 try {
                     const parsedData = JSON.parse(updatedData);
                     if (Array.isArray(parsedData)) {
                        const validatedData = parsedData.map(item => ({
                            ...item,
                            price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^\d.-]/g, '')),
                            quantity: typeof item.quantity === 'number' ? item.quantity : 1
                         })).filter(item => !isNaN(item.price) && item.quantity > 0);
                         setOrderDetails(validatedData);
                     } else {
                         setOrderDetails([]);
                     }
                 } catch (e) {
                     console.error("Failed to parse updated order details", e);
                     setOrderDetails([]);
                 }
            } else {
                 setOrderDetails([]); // Clear state if item removed/empty
            }
        }
    };

    // Listen for both 'storage' event (cross-tab) and custom 'storage' dispatch (same-tab)
    window.addEventListener('storage', handleStorageChange);
    // No need for manual custom event listener if Products.jsx dispatches 'storage' directly

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // This useEffect only saves valid state to localStorage
  useEffect(() => {
      // Only save if orderDetails is a non-empty array
      if (orderDetails.length > 0) {
         localStorage.setItem('orderDetails', JSON.stringify(orderDetails));
      } else {
          // If orderDetails becomes empty, remove item from storage
          localStorage.removeItem('orderDetails');
      }
  }, [orderDetails]);

  // Calculate subtotal directly from numeric prices
  const subtotal = orderDetails.reduce((total, item) => {
    // Ensure price and quantity are numbers before calculation
    const price = typeof item.price === 'number' ? item.price : 0;
    const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
    return total + (price * quantity);
  }, 0);

  // Tax calculation remains the same logically, but based on numeric subtotal
  const taxRate = 0.155;
  const tax = (subtotal / (1 + taxRate)) * taxRate; // Calculate tax based on tax-inclusive subtotal
  const totalPrice = subtotal; // Total is the tax-inclusive subtotal

  // Handle quantity change
  const handleQuantityChange = (id, delta) => {
    setOrderDetails((prevDetails) =>
       prevDetails.map((item) =>
         item.id === id
           ? { ...item, quantity: Math.max(1, (item.quantity || 0) + delta) } // Ensure quantity is treated as number
           : item
       ).filter(item => item.quantity > 0) // Remove item if quantity becomes 0 or less
    );
  };

  // Handle item deletion
  const handleDeleteItem = (id) => {
    setOrderDetails((prevDetails) => prevDetails.filter((item) => item.id !== id));
  };

  // Function to handle the custom event
  const handleOrderUpdate = () => {
      // console.log('Custom order-updated event received'); // For debugging
      const updatedData = localStorage.getItem('orderDetails');
      // Use the same robust parsing logic as before
       if (updatedData) {
           try {
               const parsedData = JSON.parse(updatedData);
               if (Array.isArray(parsedData)) {
                  const validatedData = parsedData.map(item => ({
                      ...item,
                      price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^\d.-]/g, '')),
                      quantity: typeof item.quantity === 'number' ? item.quantity : 1
                   })).filter(item => !isNaN(item.price) && item.quantity > 0);
                   // Only update state if data actually changed
                   if (JSON.stringify(validatedData) !== JSON.stringify(orderDetails)) {
                       setOrderDetails(validatedData);
                   }
               } else {
                   // Clear state if data is invalid and state is not already empty
                   if (orderDetails.length > 0) setOrderDetails([]);
               }
           } catch (e) {
               console.error("Failed to parse updated order details", e);
               if (orderDetails.length > 0) setOrderDetails([]);
           }
      } else {
          // Clear state if item removed/empty and state is not already empty
          if (orderDetails.length > 0) setOrderDetails([]);
      }
  };

  // Listen for the custom event
  window.addEventListener('order-updated', handleOrderUpdate);

  // Still listen for 'storage' for potential cross-tab updates (optional but good practice)
  // window.addEventListener('storage', handleStorageChange); // You might keep the original storage listener too

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('order-updated', handleOrderUpdate);
      // window.removeEventListener('storage', handleStorageChange); // Cleanup original listener if kept
    };
  }, [orderDetails]); // Keep orderDetails dependency for comparing state before setting

  return (
    <div className="flex flex-col justify-between ml-4 p-4 bg-neutral-800 shadow-md min-w-[400px] max-w-[400px]">
      {/* Order Summary Section */}
      <div className="mt-4">
        <h2 className="text-lg font-semibold text-white">Order Summary</h2>
        <p className="text-sm text-gray-400">Adjust quantities as needed.</p>

        <ul className="mt-2 max-h-[55vh] overflow-y-auto pr-2">
          {orderDetails.map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-4 items-center text-gray-300 mb-2 py-4 border-b border-neutral-900"
            >
              <div className="flex items-center gap-2 flex-grow min-w-0">
                <button
                  onClick={() => handleQuantityChange(item.id, -1)}
                  className="p-1 bg-neutral-700 text-white rounded hover:bg-neutral-600 flex-shrink-0"
                >
                  <FaMinus />
                </button>
                <span className="w-4 text-center flex-shrink-0">{item.quantity}</span>
                <button
                  onClick={() => handleQuantityChange(item.id, 1)}
                  className="p-1 bg-neutral-700 text-white rounded hover:bg-neutral-600 flex-shrink-0"
                >
                  <FaPlus />
                </button>
                <span className="ml-2 flex-shrink min-w-0 break-words">{item.name}</span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right whitespace-nowrap">
                    R {((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                </div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1 bg-red-600 text-white rounded hover:bg-red-500"
                >
                  <ImBin />
                </button>
              </div>
            </li>
          ))}
          {orderDetails.length === 0 && (
              <p className="text-center text-neutral-500 py-4">Your order is empty.</p>
          )}
        </ul>
      </div>

      {/* Totals Section */}
      <div className="mt-auto pt-4">
        <hr className="my-4 border-neutral-700" />
        <div className="flex justify-between text-sm text-gray-400">
          <span>Subtotal (inc. Tax)</span>
          <span>R {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-400">
          <span>Tax included (15.5%)</span>
          <span>R {tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg text-white mt-2">
          <span>Total</span>
          <span>R {totalPrice.toFixed(2)}</span>
        </div>
        <button className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-neutral-600 disabled:cursor-not-allowed"
                onClick={handleCheckout}
                disabled={orderDetails.length === 0}
        >
          Checkout
        </button>
      </div>
      {showConfirmation && (
        <ConfirmOrder
          orderDetails={orderDetails}
          totalPrice={totalPrice.toFixed(2)}
          onClose={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
}