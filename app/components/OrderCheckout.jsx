'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FaPlus, FaMinus, FaGift } from 'react-icons/fa';
import { ImBin } from 'react-icons/im';
import { collection, onSnapshot } from 'firebase/firestore';
import db from '../../utils/firebase';
import ConfirmOrder from './ConfirmOrder';

export default function OrderCheckout() {
  const [orderDetails, setOrderDetails] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [allSpecials, setAllSpecials] = useState([]);
  const [appliedSpecials, setAppliedSpecials] = useState([]);
  const [vat] = useState(14 / 100);
  const [specialsError, setSpecialsError] = useState('');

  // Effect 1: Fetch all specials from Firestore in real-time.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'specials'),
      (snapshot) => {
        setSpecialsError('');
        const specialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllSpecials(specialsData);
      },
      (error) => {
        setSpecialsError('Failed to load specials. Please try again or contact a manager.');
        console.error('Error fetching specials:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Effect 2: Load order from localStorage on mount and listen for external changes.
  useEffect(() => {
    const loadOrder = () => {
      const storedData = localStorage.getItem('orderDetails');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          setOrderDetails(Array.isArray(parsedData) ? parsedData : []);
        } catch {
          setOrderDetails([]);
        }
      }
    };

    loadOrder(); // Load initial order

    window.addEventListener('storage', loadOrder);
    window.addEventListener('order-updated', loadOrder);

    return () => {
      window.removeEventListener('storage', loadOrder);
      window.removeEventListener('order-updated', loadOrder);
    };
  }, []);

  // Effect 3: Recalculate applied specials whenever the order or specials list changes.
  useEffect(() => {
    const validSpecials = allSpecials
      .filter(special => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = special.startDate ? new Date(special.startDate) : null;
        const endDate = special.endDate ? new Date(special.endDate) : null;
        return special.active &&
          (!startDate || today >= startDate) &&
          (!endDate || today <= endDate);
      })
      .sort((a, b) => {
        const isBExclusive = b.mutuallyExclusive === true || b.mutuallyExclusive === 'on';
        const isAExclusive = a.mutuallyExclusive === true || a.mutuallyExclusive === 'on';
        return (isBExclusive ? 1 : 0) - (isAExclusive ? 1 : 0);
      });

    const newAppliedSpecials = [];
    let hasAppliedMutuallyExclusiveSpecial = false;

    validSpecials.forEach(special => {
      const isMutuallyExclusive = special.mutuallyExclusive === true || special.mutuallyExclusive === 'on';
      if (hasAppliedMutuallyExclusiveSpecial || (isMutuallyExclusive && newAppliedSpecials.length > 0)) {
        return;
      }

      const findItems = (type, productOrCategory, requiredSize) => {
        return orderDetails.filter(item => {
          if (!item) return false;
          const itemMatchesType = type === 'product' ? item.id.startsWith(productOrCategory) : item.category === productOrCategory;
          if (!itemMatchesType) return false;
          if (requiredSize) {
            const itemSize = item.size || item.id.split('_')[1];
            return itemSize && itemSize.toLowerCase() === requiredSize.toLowerCase();
          }
          return true;
        });
      };

      const triggerItems = findItems(special.triggerType, special.triggerProduct || special.triggerCategory, special.triggerProductSize || special.triggerCategorySize);
      const rewardItems = findItems(special.rewardType, special.rewardProduct || special.rewardCategory, special.rewardProductSize || special.rewardCategorySize);

      const totalTriggerQuantity = triggerItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      if (totalTriggerQuantity < Number(special.triggerQuantity || 0)) return;

      const triggerAndRewardAreTheSame = special.triggerType === special.rewardType &&
        (special.triggerProduct || special.triggerCategory) === (special.rewardProduct || special.rewardCategory) &&
        (special.triggerProductSize || special.triggerCategorySize) === (special.rewardProductSize || special.rewardCategorySize);

      let applications = 0;
      if (triggerAndRewardAreTheSame) {
        const itemsPerApplication = Number(special.triggerQuantity || 0) + Number(special.rewardQuantity || 0);
        applications = Math.floor(totalTriggerQuantity / itemsPerApplication);
      } else {
        const triggerApplications = Math.floor(totalTriggerQuantity / Number(special.triggerQuantity || 1));
        const totalRewardQuantity = rewardItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const rewardApplications = Math.floor(totalRewardQuantity / Number(special.rewardQuantity || 1));
        applications = Math.min(triggerApplications, rewardApplications);
      }

      if (applications > 0) {
        // Create a flat array of individual items (expanding quantities)
        const expandItems = (items) => {
          const expanded = [];
          items.forEach(item => {
            for (let i = 0; i < Number(item.quantity || 0); i++) {
              expanded.push({ ...item, quantity: 1 });
            }
          });
          return expanded;
        };

        const expandedRewardItems = expandItems(triggerAndRewardAreTheSame ? triggerItems : rewardItems);
        const rewardQuantityPerApp = Number(special.rewardQuantity || 0);
        
        // Create individual special instances
        for (let appIndex = 0; appIndex < applications; appIndex++) {
          const startIdx = appIndex * rewardQuantityPerApp;
          const instanceRewardItems = expandedRewardItems.slice(startIdx, startIdx + rewardQuantityPerApp);
          
          if (instanceRewardItems.length === 0) continue;

          let instanceSavedAmount = 0;
          
          // Calculate discount for each item in this instance
          instanceRewardItems.forEach(rewardItem => {
            if (special.discountType === 'free') {
              instanceSavedAmount += Number(rewardItem.price || 0);
            } else if (special.discountType === 'percentage') {
              const discountValue = Number(special.discountValue || 0);
              instanceSavedAmount += Number(rewardItem.price || 0) * (discountValue / 100);
            } else if (special.discountType === 'fixed') {
              // For fixed discount, distribute it evenly across reward items
              const fixedPerItem = Number(special.fixedDiscountAmount || 0) / rewardQuantityPerApp;
              instanceSavedAmount += Math.min(Number(rewardItem.price || 0), fixedPerItem);
            }
          });

          if (instanceSavedAmount > 0) {
            newAppliedSpecials.push({ 
              ...special, 
              savedAmount: instanceSavedAmount,
              instanceNumber: applications > 1 ? appIndex + 1 : null,
              totalInstances: applications > 1 ? applications : null
            });
          }
        }

        if (isMutuallyExclusive && newAppliedSpecials.length > 0) {
          hasAppliedMutuallyExclusiveSpecial = true;
        }
      }
    });

    // Shallow compare for performance (faster than JSON.stringify for large arrays)
    const shallowCompare = (a, b) => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || 
            a[i].savedAmount !== b[i].savedAmount ||
            a[i].instanceNumber !== b[i].instanceNumber) return false;
      }
      return true;
    };

    if (!shallowCompare(newAppliedSpecials, appliedSpecials)) {
      setAppliedSpecials(newAppliedSpecials);
    }
  }, [orderDetails, allSpecials]);

  const handleQuantityChange = (id, delta) => {
    const newOrder = orderDetails.map(item =>
      item.id === id ? { ...item, quantity: Math.max(1, Number(item.quantity || 0) + delta) } : item
    ).filter(item => item.quantity > 0);
    setOrderDetails(newOrder);
    localStorage.setItem('orderDetails', JSON.stringify(newOrder));
  };

  const handleDeleteItem = (id) => {
    const newOrder = orderDetails.filter((item) => item.id !== id);
    setOrderDetails(newOrder);
    localStorage.setItem('orderDetails', JSON.stringify(newOrder));
  };

  const totals = useMemo(() => {
    const subtotalBeforeDiscount = orderDetails.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const specialsDiscount = appliedSpecials.reduce((total, special) => total + Number(special.savedAmount || 0), 0);
    const finalSubtotal = subtotalBeforeDiscount - specialsDiscount;
    const tax = (finalSubtotal / (1 + vat)) * vat;
    return {
      subtotalBeforeDiscount,
      specialsDiscount,
      tax,
      total: finalSubtotal,
    };
  }, [orderDetails, appliedSpecials, vat]);

  return (
    <div className="flex flex-col p-2.5 bg-neutral-800 shadow-md border-l border-neutral-700 min-w-full sm:min-w-[260px] sm:max-w-[260px] h-full">
      <div className="flex-shrink-0">
        <h2 className="text-sm font-semibold text-white mt-2">Order Summary</h2>
        <p className="text-xs text-gray-400">Adjust quantities as needed.</p>
        {specialsError && (
          <div className="my-1 p-1.5 bg-red-700 text-white text-[10px] rounded">{specialsError}</div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto pr-1 mt-1.5">
        <ul>
          {orderDetails.length > 0 ? orderDetails.map((item) => (
            <li key={item.id} className="flex justify-between gap-2 items-center text-gray-300 mb-1 py-2 border-b border-neutral-900">
              <div className="flex items-center gap-1.5 flex-grow min-w-0">
                <button
                  onClick={() => handleQuantityChange(item.id, -1)}
                  className="p-0.5 bg-neutral-700 text-white rounded hover:bg-neutral-600 flex-shrink-0 text-xs"
                  aria-label={`Decrease quantity of ${item.name}`}
                  title={`Decrease quantity of ${item.name}`}
                >
                  <FaMinus />
                </button>
                <span className="w-3 text-center flex-shrink-0 text-xs">{item.quantity}</span>
                <button
                  onClick={() => handleQuantityChange(item.id, 1)}
                  className="p-0.5 bg-neutral-700 text-white rounded hover:bg-neutral-600 flex-shrink-0 text-xs"
                  aria-label={`Increase quantity of ${item.name}`}
                  title={`Increase quantity of ${item.name}`}
                >
                  <FaPlus />
                </button>
                <span className="ml-1 flex-shrink min-w-0 break-words text-xs">{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="text-right whitespace-nowrap text-xs">R {((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}</div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-0.5 bg-red-600 text-white rounded hover:bg-red-500 text-xs"
                  aria-label={`Remove ${item.name} from order`}
                  title={`Remove ${item.name} from order`}
                >
                  <ImBin />
                </button>
              </div>
            </li>
          )) : <p className="text-center text-neutral-500 py-2 text-xs">Your order is empty.</p>}
        </ul>
      </div>

      <div className="flex-shrink-0">
        {appliedSpecials.length > 0 && (
          <div className="mt-2">
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5"><FaGift className="text-green-500 text-xs" /> Applied Specials</h3>
            <ul className="mt-1.5 text-xs text-gray-400">
              {appliedSpecials.map((special, index) => (
                <li key={index} className="flex justify-between items-center py-1.5 border-b border-neutral-700">
                  <span className="text-xs">
                    {special.name}
                    {special.instanceNumber && special.totalInstances && (
                      <span className="text-[10px] text-neutral-500 ml-1">
                        (#{special.instanceNumber})
                      </span>
                    )}
                  </span>
                  <span className="text-green-500 text-xs">-R {Number(special.savedAmount).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2">
        <hr className="my-2 border-neutral-700" />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Subtotal</span>
          <span>R {totals.subtotalBeforeDiscount.toFixed(2)}</span>
        </div>
        {totals.specialsDiscount > 0 && (
          <div className="flex justify-between text-xs text-green-500">
            <span>Specials Discount</span>
            <span>-R {totals.specialsDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-400">
          <span>Tax included ({(vat * 100).toFixed(0)}%)</span>
          <span>R {totals.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm text-white mt-1">
          <span>Total</span>
          <span>R {totals.total.toFixed(2)}</span>
        </div>
          <button
            className="mt-2 w-full bg-indigo-600 text-white py-1.5 text-sm rounded-md hover:bg-indigo-700 transition-colors disabled:bg-neutral-600 disabled:cursor-not-allowed"
            onClick={() => setShowConfirmation(true)}
            disabled={orderDetails.length === 0}
          >
            Checkout
          </button>
        </div>
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