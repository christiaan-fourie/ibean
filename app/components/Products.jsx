'use client';

import React, { useEffect, useState } from 'react';
import db from '../../utils/firebase'; // Import Firestore instance
import { collection, onSnapshot } from 'firebase/firestore'; // Firestore methods

// New component for the size selection modal
const CoffeeSizeModal = ({ coffee, onClose, onSelectSize }) => {
  const [selectedSize, setSelectedSize] = useState(null);

  if (!coffee || !coffee.sizes) return null; // Don't render if no coffee/sizes

  const sizes = Object.entries(coffee.sizes); // Get [sizeName, price] pairs

  // Helper function to safely format price (can be defined outside or passed as prop if needed elsewhere)
   const safeFormatPrice = (priceValue) => {
       const numericPrice = typeof priceValue === 'number'
           ? priceValue
           : parseFloat(String(priceValue).replace(/[^\d.-]/g, '') || 0); // Parse or default to 0
       return numericPrice.toFixed(2);
   };

  const handleSelect = () => {
    if (selectedSize) {
      onSelectSize(selectedSize.name, selectedSize.price); // Pass selected size name and price back
      onClose(); // Close modal after selection
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-800 border border-gray-700 rounded-lg p-6 w-full max-w-sm text-white">
        <h3 className="text-xl font-semibold mb-4 text-center">Select Size for {coffee.name}</h3>
        <div className="space-y-3 mb-6">
          {sizes.map(([sizeName, price]) => (
            <label key={sizeName} className="flex items-center justify-between p-3 bg-neutral-700 rounded-md cursor-pointer hover:bg-neutral-600 transition-colors">
              <span className="text-lg">{sizeName}</span>
              <span className="text-lg font-semibold text-green-400">R {safeFormatPrice(price)}</span>
              <input
                type="radio"
                name="coffeeSize"
                className="ml-4 accent-indigo-500 w-5 h-5" // Style the radio button
                onChange={() => setSelectedSize({ name: sizeName, price: price })}
              />
            </label>
          ))}
        </div>
        <div className="flex justify-between gap-4">
           <button
            onClick={handleSelect}
            disabled={!selectedSize} // Disable if no size is selected
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
  const [selectedCoffee, setSelectedCoffee] = useState(null); // State for the coffee needing size selection
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false); // State for modal visibility
  const [selectedCategory, setSelectedCategory] = useState('All'); // State for category filter

  // Define categories for tabs
  const categories = ['All', 'Coffee', 'Eats', 'Drinks'];

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
          : parseFloat(String(priceValue).replace(/[^\d.-]/g, '') || 0); // Parse or default to 0
      return numericPrice.toFixed(2);
  };

  // Unified function to handle adding item (regular or coffee w/ size)
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

     // *** Dispatch a CUSTOM event instead of 'storage' ***
     window.dispatchEvent(new CustomEvent('order-updated'));
  };

  // Function called when clicking a product card/button
  const handleProductClick = (product) => {
    // Check if it's coffee AND has sizes defined
    if (product.category === 'Coffee' && product.sizes && Object.keys(product.sizes).length > 0) {
      setSelectedCoffee(product); // Set the coffee to trigger modal
      setIsSizeModalOpen(true);
    } else if (product.price !== undefined) { // Handle regular products (ensure price exists)
        addToOrder({ // Directly add non-coffee items or coffee items without sizes
            id: product.id, // Use original ID
            name: product.name,
            price: product.price,
            category: product.category            
        });
    } else {
        console.warn(`Product "${product.name}" (ID: ${product.id}) is missing price or size information.`);
    }
  };

  // Function called when a size is selected in the modal
  const handleSelectCoffeeSize = (sizeName, sizePrice) => {
    if (!selectedCoffee) return;

    const coffeeToAdd = {
      // Create a unique ID for the coffee+size combination
      id: `${selectedCoffee.id}_${sizeName.toLowerCase()}`,
      name: `${selectedCoffee.name} (${sizeName})`, // Combine name and size
      price: sizePrice, // Use the price for the selected size
      category: selectedCoffee.category,
      // description: selectedCoffee.description // Optional
      // baseId: selectedCoffee.id // Optional: keep track of the base coffee ID
    };

    addToOrder(coffeeToAdd); // Use the unified add function
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
            className="h-[120px] w-[120px] flex flex-col justify-center bg-neutral-800 border border-gray-700 rounded-lg p-4 hover:shadow-xl hover:scale-105 transition-transform duration-300"
            onClick={() => handleProductClick(product)}
          >
            {/* Content grouped for flex layout */}
            <div>
                <h3 className="text-base font-semibold text-neutral-50 mb-1 text-center">
                {product.name}
                </h3>

                {/* Conditionally display price or size indicator
                {product.category === 'Coffee' && product.sizes ? (
                     <p className="text-sm text-center text-indigo-400 mb-4">(Select Size)</p>
                 ) : product.price !== undefined ? (
                    <p className="text-sm font-bold text-green-400 mb-2 text-center">
                    R {safeFormatPrice(product.price)}
                    </p>
                 ) : (
                    <p className="text-sm text-center text-red-400 mb-4">(Price N/A)</p>
                 )
                } */}
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
        <CoffeeSizeModal
          coffee={selectedCoffee}
          onClose={handleCloseModal}
          onSelectSize={handleSelectCoffeeSize}
        />
      )}
    </div> // End main flex container
  );
};

export default Products;