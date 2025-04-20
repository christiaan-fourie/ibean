'use client';

import React, { useState } from 'react';
import { FaBars } from 'react-icons/fa';
import { CgClose } from "react-icons/cg";
import ManageProducts from './ManageProducts'; // Import the ManageProducts component
import Sales from './Sales'; // Import the Sales component

const Menu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManageProductsOpen, setIsManageProductsOpen] = useState(false); // State to control ManageProducts popup
  const [isSalesOpen, setIsSalesOpen] = useState(false); // State to control Sales popup

  // Toggle menu visibility
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      {/* Menu Button */}
      <button 
        className="flex items-center bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        onClick={toggleMenu}
      >
        <FaBars className="" />
      </button>

      {/* Sliding Menu */}
      <div
        className={`fixed top-0 left-0 h-full rounded-lg w-64 bg-neutral-800 shadow-lg transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <ul className="space-y-4">
            <li>
              <button onClick={toggleMenu} className="flex items-center gap-2 w-full text-left bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-700">
                <CgClose /> Close
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setIsSalesOpen(true); // Open Sales popup
                  toggleMenu(); // Close the menu
                }}
                className="w-full text-left bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
              >
                Sales
              </button>
            </li>  
            <li>
              <button
                onClick={() => {
                  setIsManageProductsOpen(true); // Open ManageProducts popup
                  toggleMenu(); // Close the menu
                }}
                className="w-full text-left bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
              >
                Manage Products
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* ManageProducts Popup */}
      {isManageProductsOpen && (
        <ManageProducts onClose={() => setIsManageProductsOpen(false)} />
      )}
      {/* Sales Popup */}
      {isSalesOpen && (
        <Sales onClose={() => setIsSalesOpen(false)} />
      )}
    </div>
  );
};

export default Menu;