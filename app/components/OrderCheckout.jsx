'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FaPlus, FaMinus, FaGift } from 'react-icons/fa';
import { ImBin } from 'react-icons/im';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Button } from '@/components/ui/button';
import db from '../../utils/firebase';
import { auth } from '../../utils/firebase';
import ConfirmOrder from './ConfirmOrder';
import {
  calculateOrderTotals,
  applySpecialsToOrder,
} from '../../utils/pricing';

export default function OrderCheckout() {
  const [user] = useAuthState(auth);
  const [orderDetails, setOrderDetails] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [allSpecials, setAllSpecials] = useState([]);
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

  const appliedSpecials = useMemo(
    () => applySpecialsToOrder(orderDetails, allSpecials, user),
    [orderDetails, allSpecials, user]
  );

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
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-900/70 p-3 backdrop-blur-xl">
      <div className="flex-shrink-0">
        <h2 className="mt-1 text-base font-semibold text-white">Order Summary</h2>
        <p className="text-xs text-neutral-400">Adjust quantities as needed.</p>
        {specialsError && (
          <div className="my-1 rounded-xl border border-red-300/20 bg-red-600/80 p-1.5 text-[10px] text-white">{specialsError}</div>
        )}
      </div>

      <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1">
        <ul>
          {orderDetails.length > 0 ? (
            orderDetails.map((item) => (
              <li
                key={item.id}
                className="mb-1.5 flex items-center justify-between gap-2 border-b border-white/10 py-2.5 text-neutral-300"
              >
                <div className="flex items-center gap-2 flex-grow min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleQuantityChange(item.id, -1)}
                    className="flex-shrink-0 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    aria-label={`Decrease quantity of ${item.name}`}
                    title={`Decrease quantity of ${item.name}`}
                  >
                    <FaMinus />
                  </Button>
                  <span className="w-5 flex-shrink-0 text-center text-sm font-semibold text-white">{item.quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleQuantityChange(item.id, 1)}
                    className="flex-shrink-0 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    aria-label={`Increase quantity of ${item.name}`}
                    title={`Increase quantity of ${item.name}`}
                  >
                    <FaPlus />
                  </Button>
                  <span className="ml-1 min-w-0 flex-shrink break-words text-sm leading-tight">{item.name}</span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <div className="whitespace-nowrap text-right text-sm font-medium text-white">
                    R {((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleDeleteItem(item.id)}
                    className="flex-shrink-0 border-red-400/20 bg-red-500/90 text-white hover:bg-red-500"
                    aria-label={`Remove ${item.name} from order`}
                    title={`Remove ${item.name} from order`}
                  >
                    <ImBin />
                  </Button>
                </div>
              </li>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-neutral-500">Your order is empty.</p>
          )}
        </ul>
      </div>

      <div className="flex-shrink-0 border-t border-white/10 bg-neutral-900/85 pt-2 backdrop-blur-md">
        {appliedSpecials.length > 0 && (
          <div className="mt-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <FaGift className="text-green-500 text-xs" /> Applied Specials
            </h3>
            <ul className="mt-1.5 text-xs text-neutral-400">
              {appliedSpecials.map((special, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between border-b border-neutral-700 py-1.5"
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
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Subtotal</span>
            <span>R {totals.subtotalBeforeDiscount.toFixed(2)}</span>
          </div>
          {totals.specialsDiscount > 0 && (
            <div className="flex justify-between text-xs text-green-500">
              <span>Specials Discount</span>
              <span>-R {totals.specialsDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Tax included ({(vat * 100).toFixed(0)}%)</span>
            <span>R {totals.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-white mt-2">
            <span>Total</span>
            <span>R {totals.total.toFixed(2)}</span>
          </div>
          <Button
            type="button"
            className="mt-3 min-h-12 w-full rounded-xl bg-cyan-500 py-2 text-base font-semibold text-white hover:bg-cyan-600 disabled:bg-neutral-600"
            onClick={() => setShowConfirmation(true)}
            disabled={orderDetails.length === 0}
          >
            Checkout
          </Button>
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
