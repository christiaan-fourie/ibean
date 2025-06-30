'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FaPlus, FaMinus, FaGift } from 'react-icons/fa';
import { ImBin } from 'react-icons/im';
import { collection, getDocs } from 'firebase/firestore';
import db from '../../utils/firebase';
import ConfirmOrder from './ConfirmOrder';

export default function OrderCheckout() {
  const [orderDetails, setOrderDetails] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [allSpecials, setAllSpecials] = useState([]);
  const [appliedSpecials, setAppliedSpecials] = useState([]);
  const [vat] = useState(14 / 100);

  // Effect 1: Fetch all specials from Firestore only once on component mount.
  useEffect(() => {
    const fetchSpecials = async () => {
      try {
        const specialsSnapshot = await getDocs(collection(db, 'specials'));
        const specialsData = specialsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllSpecials(specialsData);
        console.log('Fetched specials:', specialsData);
      } catch (error) {
        console.error('Error fetching specials:', error);
      }
    };
    fetchSpecials();
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

    // Listen for changes from other tabs/windows
    window.addEventListener('storage', loadOrder);
    // Listen for changes from the product grid component
    window.addEventListener('order-updated', loadOrder);

    return () => {
      window.removeEventListener('storage', loadOrder);
      window.removeEventListener('order-updated', loadOrder);
    };
  }, []);

  // Effect 3: The main logic. Recalculate applied specials whenever the order or specials list changes.
  useEffect(() => {
    // Filter for currently valid specials
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
      
      const totalTriggerQuantity = triggerItems.reduce((sum, item) => sum + item.quantity, 0);
      if (totalTriggerQuantity < special.triggerQuantity) return;

      const triggerAndRewardAreTheSame = special.triggerType === special.rewardType &&
        (special.triggerProduct || special.triggerCategory) === (special.rewardProduct || special.rewardCategory) &&
        (special.triggerProductSize || special.triggerCategorySize) === (special.rewardProductSize || special.rewardCategorySize);

      let applications = 0;
      if (triggerAndRewardAreTheSame) {
        const itemsPerApplication = special.triggerQuantity + special.rewardQuantity;
        applications = Math.floor(totalTriggerQuantity / itemsPerApplication);
      } else {
        const triggerApplications = Math.floor(totalTriggerQuantity / special.triggerQuantity);
        const totalRewardQuantity = rewardItems.reduce((sum, item) => sum + item.quantity, 0);
        const rewardApplications = Math.floor(totalRewardQuantity / special.rewardQuantity);
        applications = Math.min(triggerApplications, rewardApplications);
      }

      if (applications > 0) {
        const rewardItemForPrice = (triggerAndRewardAreTheSame ? triggerItems : rewardItems)[0];
        if (!rewardItemForPrice) return;

        let savedAmountPerApplication = 0;
        if (special.discountType === 'free') {
          savedAmountPerApplication = rewardItemForPrice.price * special.rewardQuantity;
        } else if (special.discountType === 'percentage') {
          // FIX: Default discountValue to 0 if it's missing, preventing NaN errors.
          const discountValue = special.discountValue || 0;
          savedAmountPerApplication = rewardItemForPrice.price * special.rewardQuantity * (discountValue / 100);
        } else if (special.discountType === 'fixed') {
          savedAmountPerApplication = Math.min(rewardItemForPrice.price * special.rewardQuantity, special.fixedDiscountAmount || 0);
        }

        const totalSavedAmount = savedAmountPerApplication * applications;
        if (totalSavedAmount > 0) {
          newAppliedSpecials.push({ ...special, savedAmount: totalSavedAmount });
          if (isMutuallyExclusive) hasAppliedMutuallyExclusiveSpecial = true;
        }
      }
    });

    // Only update state if the specials have actually changed, preventing infinite loops
    if (JSON.stringify(newAppliedSpecials) !== JSON.stringify(appliedSpecials)) {
      setAppliedSpecials(newAppliedSpecials);
    }
  }, [orderDetails, allSpecials]); // This effect now correctly depends ONLY on its inputs.

  const handleQuantityChange = (id, delta) => {
    const newOrder = orderDetails.map(item =>
      item.id === id ? { ...item, quantity: Math.max(1, (item.quantity || 0) + delta) } : item
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
    const subtotalBeforeDiscount = orderDetails.reduce((total, item) => total + (item.price * item.quantity), 0);
    const specialsDiscount = appliedSpecials.reduce((total, special) => total + special.savedAmount, 0);
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
    <div className="flex flex-col justify-between ml-4 p-4 bg-neutral-800 shadow-md min-w-[400px] max-w-[400px] min-h-screen">
      <div className="mt-4">
        <h2 className="text-lg font-semibold text-white">Order Summary</h2>
        <p className="text-sm text-gray-400">Adjust quantities as needed.</p>
        <ul className="mt-2 max-h-[55vh] overflow-y-auto pr-2">
          {orderDetails.length > 0 ? orderDetails.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 items-center text-gray-300 mb-2 py-4 border-b border-neutral-900">
              <div className="flex items-center gap-2 flex-grow min-w-0">
                <button onClick={() => handleQuantityChange(item.id, -1)} className="p-1 bg-neutral-700 text-white rounded hover:bg-neutral-600 flex-shrink-0"><FaMinus /></button>
                <span className="w-4 text-center flex-shrink-0">{item.quantity}</span>
                <button onClick={() => handleQuantityChange(item.id, 1)} className="p-1 bg-neutral-700 text-white rounded hover:bg-neutral-600 flex-shrink-0"><FaPlus /></button>
                <span className="ml-2 flex-shrink min-w-0 break-words">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right whitespace-nowrap">R {((item.price || 0) * (item.quantity || 0)).toFixed(2)}</div>
                <button onClick={() => handleDeleteItem(item.id)} className="p-1 bg-red-600 text-white rounded hover:bg-red-500"><ImBin /></button>
              </div>
            </li>
          )) : <p className="text-center text-neutral-500 py-4">Your order is empty.</p>}
        </ul>
      </div>

      {appliedSpecials.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-semibold text-white flex items-center gap-2"><FaGift className="text-green-500" /> Applied Specials</h3>
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
          <span>Subtotal</span>
          <span>R {totals.subtotalBeforeDiscount.toFixed(2)}</span>
        </div>
        {totals.specialsDiscount > 0 && (
          <div className="flex justify-between text-sm text-green-500">
            <span>Specials Discount</span>
            <span>-R {totals.specialsDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-400">
          <span>Tax included ({(vat * 100).toFixed(0)}%)</span>
          <span>R {totals.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg text-white mt-2">
          <span>Total</span>
          <span>R {totals.total.toFixed(2)}</span>
        </div>
        <button
          className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-neutral-600 disabled:cursor-not-allowed"
          onClick={() => setShowConfirmation(true)}
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