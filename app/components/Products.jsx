'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { FaCheck, FaSearch, FaShoppingCart } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import db from '../../utils/firebase';
import { auth } from '../../utils/firebase';

const ADD_DEBOUNCE_MS = 400;
const PRODUCT_SKELETON_COUNT = 24;

/** Collapse duplicate line ids (e.g. from rapid double-tap race on localStorage). */
function normalizeOrderLines(lines) {
  const byId = new Map();
  for (const item of lines) {
    if (!item?.id) continue;
    const qty = Number(item.quantity) || 1;
    const existing = byId.get(item.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      byId.set(item.id, { ...item, quantity: qty });
    }
  }
  return Array.from(byId.values());
}


const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed right-3 top-3 z-50 animate-slide-in">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-emerald-500/90 px-4 py-2 text-white shadow-lg backdrop-blur-xl">
        <FaCheck className="text-sm" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
};

const VarietySelectionModal = ({ product, onOpenChange, onSelectVariety }) => {
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  if (!product || !product.varietyPrices) return null;

  const varieties = Object.entries(product.varietyPrices).sort((a, b) => a[1] - b[1]);

  const safeFormatPrice = (priceValue) => {
    const numericPrice = typeof priceValue === 'number'
      ? priceValue
      : parseFloat(String(priceValue).replace(/[^\d.-]/g, '') || 0);
    return numericPrice.toFixed(2);
  };

  const handleSelect = () => {
    if (!selectedVariety || isAdding) return;
    setIsAdding(true);
    onSelectVariety(selectedVariety.name, selectedVariety.price);
    onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(product)} onOpenChange={onOpenChange}>
      <DialogContent key={product.id} className="max-w-md border-white/10 bg-neutral-900 text-white">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
          <DialogDescription className="text-neutral-400">Select your size</DialogDescription>
        </DialogHeader>

        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {varieties.map(([varietyName, price]) => {
            const isSelected = selectedVariety?.name === varietyName;

            return (
              <button
                key={varietyName}
                onClick={() => setSelectedVariety({ name: varietyName, price })}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-cyan-300/40 bg-cyan-400/15 shadow-lg shadow-cyan-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      isSelected ? 'border-white bg-white' : 'border-neutral-400'
                    }`}
                  >
                    {isSelected && <FaCheck className="text-xs text-neutral-900" />}
                  </div>
                  <span className="text-base font-medium">{varietyName}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-300">R {safeFormatPrice(price)}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2 bg-cyan-500 text-white hover:bg-cyan-600"
            disabled={!selectedVariety || isAdding}
            onClick={handleSelect}
          >
            <FaShoppingCart />
            Add to Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Products = () => {
  const [user] = useAuthState(auth);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCoffee, setSelectedCoffee] = useState(null); // State for the product needing variety selection
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false); // State for modal visibility
  const [selectedCategory, setSelectedCategory] = useState('All'); // State for category filter
  const [searchQuery, setSearchQuery] = useState(''); // State for search query
  const [toast, setToast] = useState(null); // State for toast notifications
  const [loading, setLoading] = useState(true); // Loading state
  const [addedProductId, setAddedProductId] = useState(null); // Track recently added product
  const lastAddAtRef = useRef({});

  // Function to check if a product matches the search query
  const matchesSearch = (product) => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      (product.description && product.description.toLowerCase().includes(searchLower))
    );
  };

  // Add new useEffect for fetching categories
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const categoryList = snapshot.docs
        .filter((doc) => doc.data().active)
        .map((doc) => doc.data().name)
        .sort();

      setCategories(['All', ...categoryList]);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);



  // Helper function to safely format price
  const safeFormatPrice = (priceValue) => {
    const numericPrice = typeof priceValue === 'number'
      ? priceValue
      : parseFloat(String(priceValue).replace(/[^\d.-]/g, '') || 0);
    return numericPrice.toFixed(2);
  };

  const addToOrder = useCallback((productToAdd) => {
    const lineId = productToAdd.id;
    const now = Date.now();
    if (now - (lastAddAtRef.current[lineId] || 0) < ADD_DEBOUNCE_MS) {
      return;
    }
    lastAddAtRef.current[lineId] = now;

    const storedOrder = localStorage.getItem('orderDetails');
    let orderDetails = [];
    if (storedOrder) {
      try {
        const parsed = JSON.parse(storedOrder);
        orderDetails = Array.isArray(parsed) ? parsed : [];
      } catch {
        orderDetails = [];
      }
    }

    const existingProductIndex = orderDetails.findIndex((item) => item.id === lineId);

    if (existingProductIndex > -1) {
      orderDetails[existingProductIndex].quantity += 1;
    } else {
      orderDetails.push({ ...productToAdd, quantity: 1 });
    }

    orderDetails = normalizeOrderLines(orderDetails);
    localStorage.setItem('orderDetails', JSON.stringify(orderDetails));
    window.dispatchEvent(new CustomEvent('order-updated'));

    setToast(`${productToAdd.name} added to order!`);
    setAddedProductId(lineId);
    setTimeout(() => setAddedProductId(null), ADD_DEBOUNCE_MS);
  }, []);

  const handleProductClick = useCallback((product) => {
    if (addedProductId === product.id) return;

    if (product.varietyPrices && Object.keys(product.varietyPrices).length > 0) {
      setSelectedCoffee(product);
      setIsSizeModalOpen(true);
    } else if (product.price !== undefined) {
      addToOrder({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
      });
    } else {
      console.warn(`Product "${product.name}" (ID: ${product.id}) is missing price information.`);
    }
  }, [addToOrder, addedProductId]);

  // Function called when a variety is selected in the modal
  const handleSelectVariety = (varietyName, varietyPrice) => {
    if (!selectedCoffee) return;

    const productToAdd = {
      // Create a unique ID for the product+variety combination
      id: `${selectedCoffee.id}_${varietyName.toLowerCase()}`,
      name: `${selectedCoffee.name} (${varietyName})`, // Combine name and variety
      price: varietyPrice, // Use the price for the selected variety
      category: selectedCoffee.category
    };

    addToOrder(productToAdd); // Use the unified add function
    handleCloseModal(); // Close modal after adding
  };

  // Function to close the modal and reset state
  const handleCloseModal = () => {
    setIsSizeModalOpen(false);
    setSelectedCoffee(null);
  };

  // Filter products based on selected category and search query
  const filteredProducts = (selectedCategory === 'All'
    ? products.filter(matchesSearch)
    : products.filter((product) =>
        product.category === selectedCategory && matchesSearch(product)
      )
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-900/35">

      {/* Toast Notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Category Tabs Section */}
      <div className="flex-shrink-0 border-b border-white/10 bg-neutral-900/55 shadow-lg backdrop-blur-xl">
        <div className="px-4 py-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-medium ${
                  selectedCategory === category
                    ? 'shadow-lg shadow-cyan-500/20'
                    : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                }`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-4">
          <div className="relative max-w-2xl mx-auto">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-neutral-400" />
            <Input
              type="text"
              placeholder="Search products by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 rounded-full border-white/10 bg-white/10 pl-12 pr-12 text-base text-white placeholder:text-neutral-500 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-400/20"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full text-neutral-400 hover:text-white"
              >
                ✕
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Product Grid - Takes up remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
        {!user || loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
            {Array.from({ length: PRODUCT_SKELETON_COUNT }).map((_, index) => (
              <div
                key={`product-skeleton-${index}`}
                className="min-h-24 rounded-xl border border-white/10 bg-neutral-800/70 p-3"
              >
                <Skeleton className="h-3 w-3/4 rounded-full bg-neutral-700/90" />
                <Skeleton className="mt-1.5 h-3 w-1/2 rounded-full bg-neutral-700/80" />
                <Skeleton className="mt-5 h-3 w-2/5 rounded-full bg-neutral-700/70" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="text-center max-w-sm">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-lg font-semibold text-white mb-2">No products found</h3>
              <p className="text-sm text-neutral-400">
                {searchQuery 
                  ? `No products match "${searchQuery}"`
                  : `No products available in "${selectedCategory}"`
                }
              </p>
              {searchQuery && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600"
                >
                  Clear Search
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
            {filteredProducts.map((product) => {
              const isJustAdded = addedProductId === product.id;
              const hasVariety = product.varietyPrices && Object.keys(product.varietyPrices).length > 0;
              
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleProductClick(product)}
                  disabled={isJustAdded}
                  className={`relative flex min-h-24 flex-col rounded-xl border bg-neutral-800/90 p-3 transition-all duration-200 hover:border-cyan-400 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:pointer-events-none disabled:opacity-80 ${
                    isJustAdded 
                      ? 'border-green-500 bg-green-900/20' 
                      : 'border-white/10'
                  }`}
                  aria-label={`Add ${product.name} to order`}
                >
                  {/* Success indicator */}
                  {isJustAdded && (
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 shadow-lg animate-bounce">
                      <FaCheck className="text-xs" />
                    </div>
                  )}

                  {/* Product Name */}
                  <h3 className="text-xs font-semibold text-white mb-1 text-center line-clamp-2 min-h-[2rem]">
                    {product.name}
                  </h3>

                  
                  {/* Price Display */}
                  <div className="mt-auto">
                    {hasVariety ? (
                      <div className="text-center">
                        <p className="text-xs text-blue-300 font-medium mb-0.5">
                          From R {safeFormatPrice(Math.min(...Object.values(product.varietyPrices)))}
                        </p>
                        <p className="text-[10px] text-neutral-500">Multiple sizes</p>
                      </div>
                    ) : product.price !== undefined ? (
                      <p className="text-sm font-bold text-green-400 text-center">
                        R {safeFormatPrice(product.price)}
                      </p>
                    ) : (
                      <p className="text-xs text-red-400 text-center">(Price N/A)</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Conditionally render the modal */}
      <VarietySelectionModal
        product={isSizeModalOpen && selectedCoffee ? selectedCoffee : null}
        onOpenChange={(open) => {
          if (!open) handleCloseModal();
          else setIsSizeModalOpen(true);
        }}
        onSelectVariety={handleSelectVariety}
      />
    </div>
  );
};

export default Products;
