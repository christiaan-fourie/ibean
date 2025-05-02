'use client';

import React, { useState, useEffect } from 'react';
import { FaPlus, FaMinus, FaGift } from 'react-icons/fa';
import { ImBin } from 'react-icons/im';
import { collection, getDocs } from 'firebase/firestore';
import db from '../../utils/firebase';
import ConfirmOrder from './ConfirmOrder';

export default function OrderCheckout() {
  const [orderDetails, setOrderDetails] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [specials, setSpecials] = useState([]);
  const [appliedSpecials, setAppliedSpecials] = useState([]);

  const handleCheckout = () => {
    console.log('Checkout button clicked');
    setShowConfirmation(true);
  };

  // Fetch specials on mount
  useEffect(() => {
    const fetchSpecials = async () => {
      try {
        const specialsSnapshot = await getDocs(collection(db, 'specials'));
        const specialsData = specialsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(special => {
            const today = new Date();
            const startDate = special.startDate ? new Date(special.startDate) : null;
            const endDate = special.endDate ? new Date(special.endDate) : null;
            return special.active && 
              (!startDate || today >= startDate) && 
              (!endDate || today <= endDate);
          });
        setSpecials(specialsData);
      } catch (error) {
        console.error('Error fetching specials:', error);
      }
    };
    fetchSpecials();
  }, []);

  // Load order details from localStorage on mount
  useEffect(() => {
    const storedData = localStorage.getItem('orderDetails');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        if (Array.isArray(parsedData)) {
          const validatedData = parsedData.map(item => ({
            ...item,
            price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^\d.-]/g, '')),
            quantity: typeof item.quantity === 'number' ? item.quantity : 1
          })).filter(item => !isNaN(item.price) && item.quantity > 0);
          setOrderDetails(validatedData);
        } else {
          setOrderDetails([]);
          localStorage.removeItem('orderDetails');
        }
      } catch (e) {
        console.error("Failed to parse order details from localStorage", e);
        setOrderDetails([]);
        localStorage.removeItem('orderDetails');
      }
    }

    const handleStorageChange = (event) => {
      if (event.key === 'orderDetails' || event.key === null) {
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
          setOrderDetails([]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (orderDetails.length > 0) {
      localStorage.setItem('orderDetails', JSON.stringify(orderDetails));
    } else {
      localStorage.removeItem('orderDetails');
    }
  }, [orderDetails]);

  useEffect(() => {   
    
    const checkSpecials = () => {
      const newAppliedSpecials = [];
      const processedSpecialIds = new Set(); // Track processed specials

      // Validate and sort specials by priority
      const validSpecials = specials
        .filter(special => {
          const today = new Date();
          const startDate = special.startDate ? new Date(special.startDate) : null;
          const endDate = special.endDate ? new Date(special.endDate) : null;
          
          return special.active && 
            (!startDate || today >= startDate) && 
            (!endDate || today <= endDate) &&
            special.triggerProduct && // Ensure required fields exist
            special.rewardProduct;
        })
        .sort((a, b) => (b.discountValue || 0) - (a.discountValue || 0)); // Higher discounts first

      validSpecials.forEach(special => {
        try {
          // Skip if we've already processed this special
          if (processedSpecialIds.has(special.name)) return;

          // Find trigger item with proper ID handling for sized products
          const triggerItem = orderDetails.find(item => {
            if (!item) return false; // Guard against null items
            
            // For coffee products with size
            if (special.triggerProductSize) {
              const [baseId, size] = item.id.split('_');
              const itemSize = item.size || (size && size.charAt(0).toUpperCase() + size.slice(1));

              return baseId === special.triggerProduct && 
                    itemSize === special.triggerProductSize;
            }
            // For regular products without size
            return item.id === special.triggerProduct;
          });
          
          if (triggerItem && triggerItem.quantity >= special.triggerQuantity) {
            const specialApplications = Math.floor(triggerItem.quantity / special.triggerQuantity);
            
            // Find reward item with same logic
            const rewardItem = orderDetails.find(item => {
              if (special.rewardProductSize) {
                const [baseId, size] = item.id.split('_');
                const itemSize = item.size || (size && size.charAt(0).toUpperCase() + size.slice(1));
                return baseId === special.rewardProduct && 
                      itemSize === special.rewardProductSize;
              }
              return item.id === special.rewardProduct;
            });

            if (rewardItem) {
              const discountQuantity = Math.min(
                specialApplications * special.rewardQuantity,
                rewardItem.quantity
              );

              if (discountQuantity > 0) {
                const savedAmount = special.discountType === 'free'
                  ? rewardItem.price * discountQuantity
                  : (rewardItem.price * discountQuantity * (special.discountValue / 100));

                processedSpecialIds.add(special.id);
                const existingIndex = newAppliedSpecials.findIndex(s => s.id === special.id);
                if (existingIndex !== -1) {
                  newAppliedSpecials.splice(existingIndex, 1);
                }
                newAppliedSpecials.push({
                  id: special.id,
                  name: special.name,
                  description: special.description,
                  discountQuantity,
                  savedAmount,
                  triggerProduct: triggerItem.name,
                  triggerSize: triggerItem.size,
                  rewardProduct: rewardItem.name,
                  rewardSize: rewardItem.size,
                  discountType: special.discountType,
                  discountValue: special.discountValue
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error processing special ${special.id}:`, error);
        }
      });

      const validAppliedSpecials = newAppliedSpecials.filter(special => 
        special && special.id && special.savedAmount > 0
      );

      console.log('Final applied specials:', validAppliedSpecials);
      setAppliedSpecials(validAppliedSpecials);
    };

    checkSpecials();

    

  }, [orderDetails, specials]);

  const calculateTotals = () => {
    let subtotal = orderDetails.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    const specialsDiscount = appliedSpecials.reduce((total, special) => {
      return total + special.savedAmount;
    }, 0);

    subtotal -= specialsDiscount;
    const taxRate = 0.155;
    const tax = (subtotal / (1 + taxRate)) * taxRate;
    
    return {
      subtotal,
      tax,
      total: subtotal,
      specialsDiscount
    };
  };

  const handleQuantityChange = (id, delta) => {
    setOrderDetails((prevDetails) =>
      prevDetails.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, (item.quantity || 0) + delta) }
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const handleDeleteItem = (id) => {
    setOrderDetails((prevDetails) => prevDetails.filter((item) => item.id !== id));
  };

  const handleOrderUpdate = () => {
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
          if (JSON.stringify(validatedData) !== JSON.stringify(orderDetails)) {
            setOrderDetails(validatedData);
          }
        } else {
          if (orderDetails.length > 0) setOrderDetails([]);
        }
      } catch (e) {
        console.error("Failed to parse updated order details", e);
        if (orderDetails.length > 0) setOrderDetails([]);
      }
    } else {
      if (orderDetails.length > 0) setOrderDetails([]);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('order-updated', handleOrderUpdate);

      return () => {
        window.removeEventListener('order-updated', handleOrderUpdate);
      };
    }
  }, [orderDetails]);

  const totals = calculateTotals();

  return (
    <div className="flex flex-col justify-between ml-4 p-4 bg-neutral-800 shadow-md min-w-[400px] max-w-[400px] min-h-screen">
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

      {appliedSpecials.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-semibold text-white flex items-center gap-2">
            <FaGift className="text-green-500" />
            Applied Specials
          </h3>
          <ul className="mt-2 text-sm text-gray-400">
            {appliedSpecials.map((special, index) => (
              <li key={index} className="flex justify-between items-center py-2 border-b border-neutral-700">
                <span>{special.name}</span>
                <span className="text-green-500">-R {special.savedAmount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-4">
        <hr className="my-4 border-neutral-700" />
        <div className="flex justify-between text-sm text-gray-400">
          <span>Subtotal (before specials)</span>
          <span>R {(totals.subtotal + totals.specialsDiscount).toFixed(2)}</span>
        </div>
        {totals.specialsDiscount > 0 && (
          <div className="flex justify-between text-sm text-green-500">
            <span>Specials Discount</span>
            <span>-R {totals.specialsDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-400">
          <span>Tax included (15.5%)</span>
          <span>R {totals.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg text-white mt-2">
          <span>Total</span>
          <span>R {totals.total.toFixed(2)}</span>
        </div>
        <button 
          className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-neutral-600 disabled:cursor-not-allowed"
          onClick={handleCheckout}
          disabled={orderDetails.length === 0}
        >
          Checkout
        </button>
      </div>

      {showConfirmation && (
        <ConfirmOrder
          orderDetails={orderDetails}
          totalPrice={totals.total.toFixed(2)}
          appliedSpecials={appliedSpecials}
          onClose={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
}