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
  const [vat, setVat] = useState(15/100);

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
      const processedSpecialIds = new Set();
      const mutuallyExclusiveGroups = new Map();
      const usedSpecials = new Set(); // Track used specials per order

      // Validate and sort specials by priority
      const validSpecials = specials
        .filter(special => {
          const today = new Date();
          const startDate = special.startDate ? new Date(special.startDate) : null;
          const endDate = special.endDate ? new Date(special.endDate) : null;
          
          // Validate trigger conditions
          if (!special.triggerType) return false;
          const hasValidTrigger = special.triggerType === 'product' 
            ? special.triggerProduct 
            : special.triggerCategory;
          if (!hasValidTrigger) return false;

          // Validate reward conditions
          if (!special.rewardType) return false;
          const hasValidReward = special.rewardType === 'product' 
            ? special.rewardProduct 
            : special.rewardCategory;
          if (!hasValidReward) return false;

          // Validate quantities
          if (special.triggerQuantity < 1 || special.rewardQuantity < 1) return false;

          // Validate discount
          if (special.discountType === 'percentage' && 
              (!special.discountValue || special.discountValue < 1 || special.discountValue > 100)) {
            return false;
          }

          return special.active && 
            (!startDate || today >= startDate) && 
            (!endDate || today <= endDate);
        })
        .sort((a, b) => {
          // Sort by:
          // 1. Mutually exclusive first
          // 2. Higher discounts
          // 3. Alphabetical name
          const exclusiveDiff = (b.mutuallyExclusive ? 1 : 0) - (a.mutuallyExclusive ? 1 : 0);
          if (exclusiveDiff !== 0) return exclusiveDiff;
          
          const discountDiff = (b.discountValue || 0) - (a.discountValue || 0);
          if (discountDiff !== 0) return discountDiff;
          
          return a.name.localeCompare(b.name);
        });

      validSpecials.forEach(special => {
        try {
          // Skip if we've already used this special in this order
          if (usedSpecials.has(special.id)) return;

          // For mutually exclusive specials, check if we've already applied a special
          // that conflicts with this one
          if (special.mutuallyExclusive) {
            const triggerKey = special.triggerType === 'product' 
              ? `${special.triggerProduct}_${special.triggerProductSize}`
              : `category_${special.triggerCategory}_${special.triggerCategorySize}`;
            
            const rewardKey = special.rewardType === 'product' 
              ? `${special.rewardProduct}_${special.rewardProductSize}`
              : `category_${special.rewardCategory}_${special.rewardCategorySize}`;
            
            if (mutuallyExclusiveGroups.has(triggerKey) || mutuallyExclusiveGroups.has(rewardKey)) {
              return;
            }
          }

          // Find trigger items
          let triggerItems = [];
          if (special.triggerType === 'product') {
            triggerItems = orderDetails.filter(item => {
              if (!item) return false;
              if (special.triggerProductSize) {
                const [baseId, size] = item.id.split('_');
                const itemSize = item.size || (size && size.charAt(0).toUpperCase() + size.slice(1));
                return baseId === special.triggerProduct && 
                      itemSize === special.triggerProductSize;
              }
              return item.id === special.triggerProduct;
            });
          } else if (special.triggerType === 'category') {
            triggerItems = orderDetails.filter(item => {
              if (!item) return false;
              if (special.triggerCategorySize) {
                const [baseId, size] = item.id.split('_');
                const itemSize = item.size || (size && size.charAt(0).toUpperCase() + size.slice(1));
                return item.category === special.triggerCategory && 
                      itemSize === special.triggerCategorySize;
              }
              return item.category === special.triggerCategory;
            });
          }

          // Check if we have enough trigger items
          const totalTriggerQuantity = triggerItems.reduce((total, item) => total + (item.quantity || 0), 0);
          if (totalTriggerQuantity < special.triggerQuantity) {
            return;
          }

          // Find reward items
          let rewardItems = [];
          if (special.rewardType === 'product') {
            rewardItems = orderDetails.filter(item => {
              if (special.rewardProductSize) {
                const [baseId, size] = item.id.split('_');
                const itemSize = item.size || (size && size.charAt(0).toUpperCase() + size.slice(1));
                return baseId === special.rewardProduct && 
                      itemSize === special.rewardProductSize;
              }
              return item.id === special.rewardProduct;
            });
          } else if (special.rewardType === 'category') {
            rewardItems = orderDetails.filter(item => {
              if (special.rewardCategorySize) {
                const [baseId, size] = item.id.split('_');
                const itemSize = item.size || (size && size.charAt(0).toUpperCase() + size.slice(1));
                return item.category === special.rewardCategory && 
                      itemSize === special.rewardCategorySize;
              }
              return item.category === special.rewardCategory;
            });
          }

          // Calculate how many times we can apply this special
          const specialApplications = Math.min(1, Math.floor(totalTriggerQuantity / special.triggerQuantity)); // Limit to 1 application per order
          
          // Calculate how many reward items we can apply to
          const availableRewardQuantity = rewardItems.reduce((total, item) => total + (item.quantity || 0), 0);
          const maxRewardApplications = Math.floor(availableRewardQuantity / special.rewardQuantity);

          const applications = Math.min(specialApplications, maxRewardApplications);

          if (applications > 0) {
            // Track which items have been used for rewards
            const usedRewardItems = new Set();
            let totalSavedAmount = 0;
            
            // Process each application
            for (let i = 0; i < applications; i++) {
              // Find reward items that haven't been used yet
              const availableRewardItems = rewardItems.filter(item => 
                !usedRewardItems.has(item.id) && (item.quantity || 0) >= special.rewardQuantity
              );
              
              if (availableRewardItems.length === 0) break;
              
              // Take the first available item
              const rewardItem = availableRewardItems[0];
              const savedAmount = special.discountType === 'free'
                ? rewardItem.price * special.rewardQuantity
                : rewardItem.price * special.rewardQuantity * (special.discountValue / 100);
              
              totalSavedAmount += savedAmount;
              usedRewardItems.add(rewardItem.id);
            }

            if (totalSavedAmount > 0) {
              usedSpecials.add(special.id); // Mark this special as used for this order
              processedSpecialIds.add(special.id);
              newAppliedSpecials.push({
                id: special.id,
                name: special.name,
                description: special.description,
                discountQuantity: applications * special.rewardQuantity,
                savedAmount: totalSavedAmount,
                triggerType: special.triggerType,
                triggerProduct: special.triggerProduct,
                triggerProductSize: special.triggerProductSize,
                triggerCategory: special.triggerCategory,
                triggerCategorySize: special.triggerCategorySize,
                rewardType: special.rewardType,
                rewardProduct: special.rewardProduct,
                rewardProductSize: special.rewardProductSize,
                rewardCategory: special.rewardCategory,
                rewardCategorySize: special.rewardCategorySize,
                discountType: special.discountType,
                discountValue: special.discountValue
              });

              // Track mutually exclusive specials
              if (special.mutuallyExclusive) {
                const triggerKey = special.triggerType === 'product' 
                  ? `${special.triggerProduct}_${special.triggerProductSize}`
                  : `category_${special.triggerCategory}_${special.triggerCategorySize}`;
                
                const rewardKey = special.rewardType === 'product' 
                  ? `${special.rewardProduct}_${special.rewardProductSize}`
                  : `category_${special.rewardCategory}_${special.rewardCategorySize}`;
                
                mutuallyExclusiveGroups.set(triggerKey, true);
                mutuallyExclusiveGroups.set(rewardKey, true);
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
    const taxRate = vat;
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
          <span>Tax included {vat * 100}% </span>
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