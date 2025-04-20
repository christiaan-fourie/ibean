'use client';

import React, { useState, useEffect } from 'react';
import db from '../../utils/firebase'; // Import Firestore instance
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'; // Firestore methods
import { FaRegCircle, FaCheckCircle, FaTrashAlt, FaEdit } from 'react-icons/fa'; // Import React Icons

// Define expected coffee sizes
const COFFEE_SIZES = ['Solo', 'Short', 'Tall', 'Black'];

const ManageProducts = ({ onClose }) => {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '', // For non-coffee
    sizes: {}, // For coffee { Solo: '', Short: '', ... }
    description: '',
    category: '',
  });
  const [editingProductId, setEditingProductId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch existing products from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsCollection = collection(db, 'products');
        const snapshot = await getDocs(productsCollection);
        const productsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsList);
      } catch (error) {
        console.error('Error fetching products:', error);
        setErrorMessage('Failed to load existing products.');
      }
    };

    fetchProducts();
  }, []);

  // Helper to safely format price for display
  const safeFormatPrice = (priceValue) => {
    const numericPrice = typeof priceValue === 'number'
      ? priceValue
      : parseFloat(String(priceValue).replace(/[^\d.-]/g, '') || 0);
    return numericPrice.toFixed(2);
  };

  // Handle input changes - adapted for single price or sizes
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Check if the field name indicates a coffee size price (e.g., 'size_Solo')
    if (name.startsWith('size_')) {
        const sizeName = name.split('_')[1];
        setNewProduct((prevProduct) => ({
            ...prevProduct,
            sizes: {
                ...prevProduct.sizes,
                [sizeName]: value // Store size price as string initially, will parse on submit
            }
        }));
    } else {
        // Handle regular fields (name, description, price)
        setNewProduct((prevProduct) => ({
            ...prevProduct,
            [name]: value,
        }));
    }
  };

  // Handle category selection - reset price/sizes accordingly
  const handleCategorySelect = (category) => {
    setNewProduct((prevProduct) => {
      const updatedProduct = {
        ...prevProduct,
        category,
      };
      if (category === 'Coffee') {
        // Initialize sizes object if selecting Coffee, clear price
        updatedProduct.sizes = prevProduct.sizes || {}; // Keep existing sizes if switching back/editing
        COFFEE_SIZES.forEach(size => {
            if (updatedProduct.sizes[size] === undefined) updatedProduct.sizes[size] = ''; // Ensure all size keys exist
        });
        delete updatedProduct.price; // Remove single price field
      } else {
        // Initialize price if selecting non-Coffee, clear sizes
        updatedProduct.price = prevProduct.price || ''; // Keep existing price if switching back/editing
        delete updatedProduct.sizes; // Remove sizes object
      }
      return updatedProduct;
    });
     setErrorMessage(''); // Clear category error on select
  };

  // Function to reset the form and editing state
  const resetForm = () => {
    setNewProduct({ name: '', price: '', sizes: {}, description: '', category: '' });
    setEditingProductId(null);
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Handle starting the edit process - populate form based on product data
  const handleStartEdit = (product) => {
    setEditingProductId(product.id);
    // Populate form: check if it has 'sizes' (coffee) or 'price'
    const productData = {
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
    };
    if (product.category === 'Coffee' && product.sizes) {
        productData.sizes = { ...product.sizes }; // Copy sizes object
        // Ensure all defined sizes are present in the form state
        COFFEE_SIZES.forEach(size => {
            if (productData.sizes[size] === undefined) productData.sizes[size] = '';
        });
        productData.price = ''; // Ensure price field is cleared
    } else {
        productData.price = product.price !== undefined ? String(product.price) : ''; // Use existing price or empty string
        productData.sizes = {}; // Ensure sizes object is empty
    }
    setNewProduct(productData);
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Handle deleting a product
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return; // Stop if user cancels
    }

    try {
      const productRef = doc(db, 'products', productId);
      await deleteDoc(productRef);

      // Update the local state
      setProducts((prevProducts) =>
        prevProducts.filter((product) => product.id !== productId)
      );

      setSuccessMessage('Product deleted successfully!');
      setErrorMessage('');

      // If the deleted product was being edited, reset the form
      if (editingProductId === productId) {
          resetForm();
      }

    } catch (error) {
      console.error('Error deleting product:', error);
      setErrorMessage('Failed to delete product. Please try again.');
      setSuccessMessage('');
    }
  };

  // Handle form submission - prepare correct data structure for Firestore
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(''); // Clear previous errors
    setSuccessMessage('');

    if (!newProduct.category) {
        setErrorMessage('Please select a category.');
        return;
    }

    let productData = { ...newProduct };
    let hasError = false;

    try {
        if (productData.category === 'Coffee') {
            // Validate and parse coffee sizes
            const parsedSizes = {};
            COFFEE_SIZES.forEach(size => {
                const priceStr = String(productData.sizes[size] || '').trim();
                if (priceStr === '') {
                    setErrorMessage(`Price for size "${size}" is required for Coffee category.`);
                    hasError = true;
                    return; // Stop processing this size
                }
                const priceNum = parseFloat(priceStr);
                if (isNaN(priceNum) || priceNum < 0) {
                   setErrorMessage(`Invalid price entered for size "${size}". Please enter a valid number.`);
                   hasError = true;
                   return; // Stop processing this size
                }
                parsedSizes[size] = priceNum;
            });

            if (hasError) return; // Stop submission if size price error occurred

            productData.sizes = parsedSizes; // Use the parsed numbers
            delete productData.price; // Ensure single price is not saved for coffee

        } else {
            // Validate and parse single price for non-coffee
            const priceStr = String(productData.price || '').trim();
             if (priceStr === '') {
                setErrorMessage('Price is required for this category.');
                return;
            }
            const priceNum = parseFloat(priceStr);
             if (isNaN(priceNum) || priceNum < 0) {
                setErrorMessage('Invalid price entered. Please enter a valid number.');
                return;
            }
            productData.price = priceNum; // Use the parsed number
            delete productData.sizes; // Ensure sizes object is not saved
        }

        // Proceed with Firestore operation
        if (editingProductId) {
            const productRef = doc(db, 'products', editingProductId);
            await updateDoc(productRef, productData); // Send cleaned data
            setProducts((prevProducts) =>
                prevProducts.map((p) =>
                p.id === editingProductId ? { id: editingProductId, ...productData } : p
                )
            );
            setSuccessMessage('Product updated successfully!');
        } else {
            const productsCollection = collection(db, 'products');
            const docRef = await addDoc(productsCollection, productData); // Send cleaned data
            setProducts((prevProducts) => [
                ...prevProducts,
                { id: docRef.id, ...productData },
            ]);
            setSuccessMessage('Product added successfully!');
        }
        resetForm(); // Reset form on success

    } catch (error) {
        console.error('Error saving product:', error);
        setErrorMessage(`Failed to ${editingProductId ? 'update' : 'add'} product. Please try again.`);
        setSuccessMessage('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="border bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col text-white"> {/* Allow vertical scroll */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Manage Products</h2>
          <button onClick={onClose} className="text-red-500 hover:text-red-700 font-bold text-xl">&times;</button>
        </div>

        {/* Main content area */}
        <div className='flex-grow flex gap-6 overflow-hidden'> {/* Flex container for grid and form */}

            {/* Existing Products Grid */}
          <div className="w-2/3 overflow-y-auto px-4 flex-shrink-0"> {/* Make grid scrollable */}
            <h3 className="text-lg font-semibold text-white mb-4 sticky top-0 bg-neutral-800 py-1">Existing Products</h3> {/* Sticky header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map((product) => (
                <div key={product.id} className="border bg-neutral-700 p-3 rounded-md shadow-sm flex flex-col justify-between">
                  <div>
                      <p className="font-bold text-lg text-white truncate">{product.name}</p>
                      <p className="text-sm text-gray-400 mb-1 line-clamp-2">{product.description}</p>
                      {/* Display price based on category */}
                      {product.category === 'Coffee' && product.sizes ? (
                          <div className='text-xs text-green-400 mt-1'>
                              {Object.entries(product.sizes).map(([size, price]) => (
                                  <span key={size} className='mr-2'>{size}: R{safeFormatPrice(price)}</span>
                              ))}
                          </div>
                      ) : product.price !== undefined ? (
                         <p className="text-sm font-semibold text-green-400">R {safeFormatPrice(product.price)}</p>
                      ) : (
                         <p className="text-xs text-red-400">(Price N/A)</p>
                      )}
                      <p className="text-xs text-blue-400 mt-1">{product.category}</p>
                  </div>
                  <div className="flex justify-end gap-2 mt-2 pt-1 border-t border-neutral-600">
                    <button onClick={() => handleStartEdit(product)} className="text-blue-400 hover:text-blue-600" title="Edit Product"><FaEdit /></button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-red-500 hover:text-red-700" title="Delete Product"><FaTrashAlt /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add/Edit Product Form */}
          <div className='w-1/3 overflow-y-auto px-4 border-l border-neutral-700 flex-shrink-0'> {/* Make form scrollable */}
            <h3 className="text-lg font-semibold text-white mb-2 sticky top-0 bg-neutral-800 py-1"> {/* Sticky header */}
              {editingProductId ? 'Edit Product' : 'Add New Product'}
            </h3>
            <form onSubmit={handleSubmit}>
               {/* Name Input */}
               <div className="mb-4">
                   <label htmlFor="name" className="block text-sm font-medium text-gray-300">Product Name</label>
                   <input type="text" id="name" name="name" value={newProduct.name} onChange={handleChange} required
                       className="p-2 mt-1 block w-full rounded-md border-gray-600 bg-neutral-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"/>
               </div>

               {/* Description Input */}
                <div className="mb-4">
                   <label htmlFor="description" className="block text-sm font-medium text-gray-300">Description</label>
                   <textarea id="description" name="description" rows="3" value={newProduct.description} onChange={handleChange} required
                       className="p-2 mt-1 block w-full rounded-md border-gray-600 bg-neutral-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"/>
               </div>

               {/* Category Selection */}
               <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                  <div className="flex flex-wrap gap-3">
                    {['Coffee', 'Eats', 'Drinks'].map((category) => (
                      <button key={category} type="button" onClick={() => handleCategorySelect(category)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm ${
                          newProduct.category === category ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-700 text-gray-300 border-gray-600 hover:bg-neutral-600'}`}>
                        {newProduct.category === category ? <FaCheckCircle /> : <FaRegCircle />} {category}
                      </button>
                    ))}
                  </div>
               </div>

                {/* === Conditional Price Inputs === */}
                {newProduct.category === 'Coffee' ? (
                    // Coffee Size Prices
                    <div className='mb-4 border border-neutral-600 p-3 rounded-md'>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Coffee Prices (per size)</label>
                        <div className='grid grid-cols-2 gap-3'>
                            {COFFEE_SIZES.map(size => (
                                <div key={size}>
                                    <label htmlFor={`size_${size}`} className="block text-xs font-medium text-gray-400">{size}</label>
                                    <input type="number" id={`size_${size}`} name={`size_${size}`} step="0.01" min="0"
                                        value={newProduct.sizes[size] || ''} onChange={handleChange} required
                                        className="p-2 mt-1 block w-full rounded-md border-gray-600 bg-neutral-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"/>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : newProduct.category ? ( // Only show single price if category is selected and NOT coffee
                    // Single Price Input
                    <div className="mb-4">
                        <label htmlFor="price" className="block text-sm font-medium text-gray-300">Price</label>
                        <input type="number" id="price" name="price" step="0.01" min="0" value={newProduct.price} onChange={handleChange} required
                            className="p-2 mt-1 block w-full rounded-md border-gray-600 bg-neutral-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"/>
                    </div>
                ) : null /* Don't show price input if no category selected */ }
                {/* === End Conditional Price Inputs === */}


               {/* Action Buttons */}
               <div className='flex gap-4 mt-6'>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-800">
                    {editingProductId ? 'Update Product' : 'Add Product'}
                  </button>
                  {editingProductId && (
                    <button type="button" onClick={resetForm} className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-neutral-800">
                        Cancel Edit
                    </button>
                  )}
               </div>

            </form>

            {successMessage && <p className="mt-4 text-green-400">{successMessage}</p>}
            {errorMessage && <p className="mt-4 text-red-400">{errorMessage}</p>}
          </div> {/* End Form Column */}

        </div> {/* End Flex container */}
      </div> {/* End Modal Content */}
    </div> // End Modal Overlay
  );
};

export default ManageProducts;