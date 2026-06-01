'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FaPlus, FaMinus, FaGift } from 'react-icons/fa';
import { ImBin } from 'react-icons/im';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import db from '../../utils/firebase';
import { auth } from '../../utils/firebase';
import ConfirmOrder from './ConfirmOrder';
import {
  calculateOrderTotals,
  applySpecialsToOrder,
  appliedSpecialsEqual,
} from '../../utils/pricing';

export default function OrderCheckout() {
  const [user] = useAuthState(auth);
  const [orderDetails, setOrderDetails] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [allSpecials, setAllSpecials] = useState([]);
  const [appliedSpecials, setAppliedSpecials] = useState([]);
  const [vat] = useState(14 / 100);
  const [specialsError, setSpecialsError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'specials'),
      (snapshot) => {
        setSpecialsError('');
        const specialsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllSpecials(specialsData);
      },
      (error) => {
        setSpecialsError('Failed to load specials. Please try again or contact a manager.');
        console.error('Error fetching specials:', error);
      }
    );
    return () => unsubscribe();
  }, []);

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

    loadOrder();
    window.addEventListener('storage', loadOrder);
    window.addEventListener('order-updated', loadOrder);

    return () => {
      window.removeEventListener('storage', loadOrder);
      window.removeEventListener('order-updated', loadOrder);
    };
  }, []);

  useEffect(() => {
    const newAppliedSpecials = applySpecialsToOrder(orderDetails, allSpecials, user);
    setAppliedSpecials((prev) =>
      appliedSpecialsEqual(newAppliedSpecials, prev) ? prev : newAppliedSpecials
    );
  }, [orderDetails, allSpecials, user]);

  const handleQuantityChange = (id, delta) => {
    const newOrder = orderDetails
      .map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, Number(item.quantity || 0) + delta) }
          : item
      )
      .filter((item) => item.quantity > 0);
    setOrderDetails(newOrder);
    localStorage.setItem('orderDetails', JSON.stringify(newOrder));
    window.dispatchEvent(new CustomEvent('order-updated'));
  };

  const handleDeleteItem = (id) => {
    const newOrder = orderDetails.filter((item) => item.id !== id);
    setOrderDetails(newOrder);
    localStorage.setItem('orderDetails', JSON.stringify(newOrder));
    window.dispatchEvent(new CustomEvent('order-updated'));
  };

  const totals = useMemo(
    () => calculateOrderTotals(orderDetails, appliedSpecials, vat),
    [orderDetails, appliedSpecials, vat]
  );

  return (
    <div className="flex flex-col p-2.5 bg-neutral-900/70 backdrop-blur-xl shadow-md border-l border-white/10 min-w-full sm:min-w-[260px] sm:max-w-[260px] h-full">
      <div className="flex-shrink-0">
        <h2 className="text-sm font-semibold text-white mt-2">Order Summary</h2>
        <p className="text-xs text-gray-400">Adjust quantities as needed.</p>
        {specialsError && (
          <div className="my-1 p-1.5 bg-red-600/80 border border-red-300/20 text-white text-[10px] rounded-xl">{specialsError}</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 mt-1.5">
        <ul>
          {orderDetails.length > 0 ? (
            orderDetails.map((item) => (
              <li
                key={item.id}
                className="flex justify-between gap-2 items-center text-gray-300 mb-1 py-2 border-b border-neutral-900"
              >
                <div className="flex items-center gap-1.5 flex-grow min-w-0">
                  <button
                    onClick={() => handleQuantityChange(item.id, -1)}
                    className="p-0.5 bg-white/10 border border-white/10 text-white rounded-lg hover:bg-white/15 flex-shrink-0 text-xs"
                    aria-label={`Decrease quantity of ${item.name}`}
                    title={`Decrease quantity of ${item.name}`}
                  >
                    <FaMinus />
                  </button>
                  <span className="w-3 text-center flex-shrink-0 text-xs">{item.quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(item.id, 1)}
                    className="p-0.5 bg-white/10 border border-white/10 text-white rounded-lg hover:bg-white/15 flex-shrink-0 text-xs"
                    aria-label={`Increase quantity of ${item.name}`}
                    title={`Increase quantity of ${item.name}`}
                  >
                    <FaPlus />
                  </button>
                  <span className="ml-1 flex-shrink min-w-0 break-words text-xs">{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="text-right whitespace-nowrap text-xs">
                    R {((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                  </div>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-0.5 bg-red-500/90 text-white rounded-lg hover:bg-red-500 text-xs"
                    aria-label={`Remove ${item.name} from order`}
                    title={`Remove ${item.name} from order`}
                  >
                    <ImBin />
                  </button>
                </div>
              </li>
            ))
          ) : (
            <p className="text-center text-neutral-500 py-2 text-xs">Your order is empty.</p>
          )}
        </ul>
      </div>

      <div className="flex-shrink-0">
        {appliedSpecials.length > 0 && (
          <div className="mt-2">
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <FaGift className="text-green-500 text-xs" /> Applied Specials
            </h3>
            <ul className="mt-1.5 text-xs text-gray-400">
              {appliedSpecials.map((special, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center py-1.5 border-b border-neutral-700"
                >
                  <span className="text-xs">
                    {special.name}
                    {special.instanceNumber && special.totalInstances && (
                      <span className="text-[10px] text-neutral-500 ml-1">
                        (#{special.instanceNumber})
                      </span>
                    )}
                  </span>
                  <span className="text-green-500 text-xs">
                    -R {Number(special.savedAmount).toFixed(2)}
                  </span>
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
            className="mt-2 w-full bg-blue-500 text-white py-1.5 text-sm rounded-xl hover:bg-blue-600 transition-colors disabled:bg-neutral-600 disabled:cursor-not-allowed"
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
