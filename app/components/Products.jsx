'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';

const ADD_DEBOUNCE_MS = 400;

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
import db from '../../utils/firebase';
import { auth } from '../../utils/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { documentBelongsToStore } from '../../utils/storeId';
import { FaSearch, FaCheck, FaShoppingCart } from 'react-icons/fa';


// Toast Notification Component
const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-3 right-3 z-50 animate-slide-in">
      <div className="bg-green-600 text-white px-4 py-2 rounded-md shadow-lg flex items-center gap-2">
        <FaCheck className="text-sm" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
};

const VarietySelectionModal = ({ product, onClose, onSelectVariety }) => {
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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4 pb-4 animate-fade-in">
      <div className="bg-neutral-800 border border-neutral-600 rounded-xl shadow-2xl p-6 w-full max-w-md text-white transform transition-all">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold mb-2">{product.name}</h3>
          <p className="text-neutral-400 text-sm">Select your size</p>
        </div>
        
        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
          {varieties.map(([varietyName, price]) => {
            const isSelected = selectedVariety?.name === varietyName;
            return (
              <button
                key={varietyName}
                onClick={() => setSelectedVariety({ name: varietyName, price: price })}
                className={`w-full flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-600 ring-2 ring-indigo-400 shadow-lg scale-105'
                    : 'bg-neutral-700 hover:bg-neutral-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-white bg-white' : 'border-neutral-400'
                  }`}>
                    {isSelected && <FaCheck className="text-indigo-600 text-xs" />}
                  </div>
                  <span className="text-lg font-medium">{varietyName}</span>
                </div>
                <span className="text-xl font-bold text-green-400">R {safeFormatPrice(price)}</span>
              </button>
            );
          })}
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-neutral-700 text-white py-3 px-4 rounded-lg hover:bg-neutral-600 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedVariety || isAdding}
            className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <FaShoppingCart />
            Add to Order
          </button>
        </div>
      </div>
    </div>
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
  const [sortOrder, setSortOrder] = useState('name'); // New state for sorting
  const [toast, setToast] = useState(null); // State for toast notifications
  const [loading, setLoading] = useState(true); // Loading state
  const [addedProductId, setAddedProductId] = useState(null); // Track recently added product
  const lastAddAtRef = useRef({});

  // Add sort options
  const sortOptions = [
    { value: 'name', label: 'Name A-Z' },
    { value: 'name_desc', label: 'Name Z-A' },
    { value: 'price', label: 'Price Low-High' },
    { value: 'price_desc', label: 'Price High-Low' }
  ];

  // Function to sort products
  const sortProducts = (products) => {
    const sortedProducts = [...products];
    
    switch (sortOrder) {
      case 'name':
        return sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return sortedProducts.sort((a, b) => b.name.localeCompare(a.name));
      case 'price':
        return sortedProducts.sort((a, b) => {
          const priceA = typeof a.price === 'number' ? a.price : parseFloat(String(a.price));
          const priceB = typeof b.price === 'number' ? b.price : parseFloat(String(b.price));
          return priceA - priceB;
        });
      case 'price_desc':
        return sortedProducts.sort((a, b) => {
          const priceA = typeof a.price === 'number' ? a.price : parseFloat(String(a.price));
          const priceB = typeof b.price === 'number' ? b.price : parseFloat(String(b.price));
          return priceB - priceA;
        });
      default:
        return sortedProducts;
    }
  };

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
    if (!user) {
      setCategories(['All']);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const categoryList = snapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return data.active && documentBelongsToStore(data.storeId, user);
        })
        .map((doc) => doc.data().name)
        .sort();

      setCategories(['All', ...categoryList]);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsList = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((product) => documentBelongsToStore(product.storeId, user));
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
  const filteredProducts = selectedCategory === 'All'
    ? sortProducts(products.filter(matchesSearch))
    : sortProducts(products.filter(product => 
        product.category === selectedCategory && matchesSearch(product)
      ));

  return (
    <div className="flex flex-col w-full h-full bg-neutral-900"> {/* Use h-full instead of min-h-screen */}

      {/* Toast Notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Category Tabs Section & Sorting */}
      <div className="flex-shrink-0 bg-neutral-900 border-b border-neutral-800 shadow-lg">
        <div className="px-4 py-3 flex justify-between items-center gap-4 flex-wrap">
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-indigo-600 text-white shadow-lg scale-105'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:scale-102'
                }`}
              >
                {category}
              </button>
            ))}
          </div>        
          
          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <label className="text-neutral-400 text-sm whitespace-nowrap">Sort by:</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-neutral-800 text-white px-4 py-2 rounded-lg border border-neutral-700 focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer hover:bg-neutral-700"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-4">
          <div className="relative max-w-2xl mx-auto">
            <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 text-lg" />
            <input
              type="text"
              placeholder="Search products by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full text-base bg-neutral-800 text-white border border-neutral-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-neutral-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product Grid - Takes up remaining space */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
              <p className="text-sm text-neutral-400">Loading products...</p>
            </div>
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
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {filteredProducts.map((product) => {
              const isJustAdded = addedProductId === product.id;
              const hasVariety = product.varietyPrices && Object.keys(product.varietyPrices).length > 0;
              
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleProductClick(product)}
                  disabled={isJustAdded}
                  className={`relative flex flex-col bg-neutral-800 border rounded-lg p-2.5 transition-all duration-300 hover:shadow-xl hover:scale-105 hover:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:pointer-events-none disabled:opacity-80 ${
                    isJustAdded 
                      ? 'border-green-500 bg-green-900/20 scale-105' 
                      : 'border-neutral-700'
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
                        <p className="text-xs text-indigo-400 font-medium mb-0.5">
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
      {isSizeModalOpen && selectedCoffee && (
        <VarietySelectionModal
          product={selectedCoffee}
          onClose={handleCloseModal}
          onSelectVariety={handleSelectVariety}
        />
      )}
    </div> // End main flex container
  );
};

export default Products;