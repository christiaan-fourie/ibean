'use client';

import React, { useEffect, useState } from 'react';
import db from '../../utils/firebase'; // Import Firestore instance
import { collection, onSnapshot } from 'firebase/firestore'; // Firestore methods

// Rename CoffeeSizeModal to VarietySelectionModal and update its logic
const VarietySelectionModal = ({ product, onClose, onSelectVariety }) => {
  const [selectedVariety, setSelectedVariety] = useState(null);

  if (!product || !product.varietyPrices) return null;

  const varieties = Object.entries(product.varietyPrices);

  const safeFormatPrice = (priceValue) => {
    const numericPrice = typeof priceValue === 'number'
      ? priceValue
      : parseFloat(String(priceValue).replace(/[^\d.-]/g, '') || 0);
    return numericPrice.toFixed(2);
  };

  const handleSelect = () => {
    if (selectedVariety) {
      onSelectVariety(selectedVariety.name, selectedVariety.price);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-800 border border-gray-700 rounded-lg p-6 w-full max-w-sm text-white">
        <h3 className="text-xl font-semibold mb-4 text-center">Select {product.category} Size for {product.name}</h3>
        <div className="space-y-3 mb-6">
          {varieties.map(([varietyName, price]) => (
            <label 
              key={varietyName} 
              className="flex items-center justify-between p-3 bg-neutral-700 rounded-md cursor-pointer hover:bg-neutral-600 transition-colors"
            >
              <span className="text-lg">{varietyName}</span>
              <span className="text-lg font-semibold text-green-400">R {safeFormatPrice(price)}</span>
              <input
                type="radio"
                name="productVariety"
                className="ml-4 accent-indigo-500 w-5 h-5"
                onChange={() => setSelectedVariety({ name: varietyName, price: price })}
              />
            </label>
          ))}
        </div>
        <div className="flex justify-between gap-4">
          <button
            onClick={handleSelect}
            disabled={!selectedVariety}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors"
          >
            Add to Order
          </button>
          <button
            onClick={onClose}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCoffee, setSelectedCoffee] = useState(null); // State for the product needing variety selection
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false); // State for modal visibility
  const [selectedCategory, setSelectedCategory] = useState('All'); // State for category filter

  // Add new useEffect for fetching categories
  useEffect(() => {
    const categoriesCollection = collection(db, 'categories');
    
    const unsubscribe = onSnapshot(categoriesCollection, (snapshot) => {
      const categoryList = snapshot.docs
        .filter(doc => doc.data().active) // Only get active categories
        .map(doc => doc.data().name)
        .sort(); // Sort alphabetically

      setCategories(['All', ...categoryList]); // Always keep 'All' as first option
    });

    return () => unsubscribe();
  }, []);
  
  // Fetch product list with real-time updates from Firestore
  useEffect(() => {
    // Reference the "products" collection in Firestore
    const productsCollection = collection(db, 'products');

    // Set up a real-time listener
    const unsubscribe = onSnapshot(productsCollection, (snapshot) => {
      const productsList = snapshot.docs.map((doc) => ({
        id: doc.id, // Use Firestore document ID as the product ID
        ...doc.data(), // Spread the document data
      }));
      setProducts(productsList); // Update the state with the latest data
    });

    // Cleanup the listener on component unmount
    return () => unsubscribe();
  }, []);



  // Helper function to safely format price
  const safeFormatPrice = (priceValue) => {
    const numericPrice = typeof priceValue === 'number'
      ? priceValue
      : parseFloat(String(priceValue).replace(/[^\d.-]/g, '') || 0);
    return numericPrice.toFixed(2);
  };

  // Unified function to handle adding item (regular or product w/ variety)
  const addToOrder = (productToAdd) => {
    const storedOrder = localStorage.getItem('orderDetails');
    let orderDetails = storedOrder ? JSON.parse(storedOrder) : [];

    const existingProductIndex = orderDetails.findIndex((item) => item.id === productToAdd.id);

    if (existingProductIndex > -1) {
      orderDetails[existingProductIndex].quantity += 1;
    } else {
      orderDetails.push({ ...productToAdd, quantity: 1 });
    }

    localStorage.setItem('orderDetails', JSON.stringify(orderDetails));

    // Dispatch a CUSTOM event instead of 'storage'
    window.dispatchEvent(new CustomEvent('order-updated'));
  };

  // Function called when clicking a product card/button
  const handleProductClick = (product) => {
    // Check if it has varietyPrices defined
    if (product.varietyPrices && Object.keys(product.varietyPrices).length > 0) {
      setSelectedCoffee(product); // Set the product to trigger modal
      setIsSizeModalOpen(true);
    } else if (product.price !== undefined) { // Handle regular products (ensure price exists)
      addToOrder({ // Directly add non-variety items
        id: product.id, // Use original ID
        name: product.name,
        price: product.price,
        category: product.category            
      });
    } else {
      console.warn(`Product "${product.name}" (ID: ${product.id}) is missing price information.`);
    }
  };

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

  // Filter products based on selected category
  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(product => product.category === selectedCategory);

  return (
    <div className="flex flex-col"> {/* Ensure parent container allows flex-grow */}

      {/* Category Tabs Section */}
      <div className="px-2 bg-neutral-900">
        <div className="flex justify-left space-x-4">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid - Takes up remaining space */}
      <div className="flex flex-wrap px-2 mt-4 gap-4 py-4 pr-6 overflow-y-auto"> {/* Adjusted gap from gap-6 to gap-4 */}
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="flex flex-col justify-center bg-neutral-800 border border-gray-700 rounded-lg p-4 hover:shadow-xl hover:scale-105 transition-transform duration-300"
            onClick={() => handleProductClick(product)}
          >
            {/* Content grouped for flex layout */}
            <div>
              <h3 className="text-base font-semibold text-neutral-50 mb-1 text-center">
                {product.name}
              </h3>
              {product.varietyPrices && Object.keys(product.varietyPrices).length > 0 ? (
                <p className="text-sm text-center text-indigo-400 mb-4">
                  From R {safeFormatPrice(Math.min(...Object.values(product.varietyPrices)))}
                </p>
              ) : product.price !== undefined ? (
                <p className="text-sm font-bold text-green-400 mb-2 text-center">
                  R {safeFormatPrice(product.price)}
                </p>
              ) : (
                <p className="text-sm text-center text-red-400 mb-4">(Price N/A)</p>
              )}
            </div>
          </div>
        ))}
        {/* Display message if no products match filter */}
        {filteredProducts.length === 0 && products.length > 0 && (
          <p className="col-span-full text-center text-neutral-500 mt-10">
            No products found in the "{selectedCategory}" category.
          </p>
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