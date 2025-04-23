'use client';

import React, { useState, useEffect } from 'react';
import { FaBars } from 'react-icons/fa';
import { CgClose } from "react-icons/cg";
import ManageProducts from './ManageProducts'; // Import the ManageProducts component
import Sales from './Sales'; // Import the Sales component
import { auth } from '../../utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

import { FaLock } from 'react-icons/fa';

const Menu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManageProductsOpen, setIsManageProductsOpen] = useState(false); // State to control ManageProducts popup
  const [isSalesOpen, setIsSalesOpen] = useState(false); // State to control Sales popup
  
  const [user, setUser] = useState(null);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => unsubscribe();
    }, []);


  // Toggle menu visibility
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      {/* Menu Button */}
      <button
        className="flex items-center bg-neutral-700 text-white py-1.5 px-3 rounded-lg hover:bg-neutral-600 transition-colors relative z-10"
        onClick={toggleMenu}
      >
        <FaBars className="" />
      </button>

      {/* Backdrop for blur and click-outside-to-close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20"
          onClick={toggleMenu}
        ></div>
      )}

      {/* Sliding Menu */}
      <div
        className={`fixed top-0 left-0 h-full rounded-r-lg w-60 bg-neutral-800 shadow-lg transform transition-transform duration-300 z-30 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
          <ul className="space-y-3">
            <li>
              <button onClick={toggleMenu} className="flex items-center gap-2 w-full text-left bg-red-600 text-white py-1.5 px-3 text-sm rounded-md hover:bg-red-700">
                <CgClose /> Close
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setIsSalesOpen(true); // Open Sales popup
                  toggleMenu(); // Close the menu
                }}
                className="w-full text-left bg-neutral-700 text-white py-1.5 px-3 text-sm rounded-md hover:bg-neutral-600 transition-colors"
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
                className="w-full text-left bg-neutral-700 text-white py-1.5 px-3 text-sm rounded-md hover:bg-neutral-600 transition-colors"
              >
                Manage Products
              </button>
            </li>
            <li>
              {/* Login/Logout Button */}
            <button 
                className="flex items-center gap-2 bg-neutral-700 text-white py-1.5 px-3 text-sm rounded-md hover:bg-neutral-600 transition-colors w-full text-left"
                onClick={() => {
                    setShowConfirmLogout(true)
                }}
            >   
                {/* Display the username if the user is logged in */}
                {user && (
                    <span className="text-white">{user.email}</span>
                )}

                <FaLock className="" />

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

      {showConfirmLogout &&
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm z-50">
              <div className="bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-sm">
                  <h1 className="text-xl font-semibold mb-4 text-center text-white">Logout?</h1>
                   <p className="text-sm text-neutral-300 text-center mb-6">Are you sure you want to logout?</p>
                   <div className="flex justify-center gap-4">
                      <button
                        className="bg-red-600 text-white py-1.5 px-4 text-sm rounded-md hover:bg-red-700 transition-colors w-full"
                        onClick={() => {
                            signOut(auth);
                            setShowConfirmLogout(false);
                            setIsOpen(false);
                        }}>Logout
                        </button>
                      {/* Cancel button */}
                      <button
                        className="bg-neutral-600 text-white py-1.5 px-4 text-sm rounded-md hover:bg-neutral-700 transition-colors w-full"
                        onClick={() => setShowConfirmLogout(false)}
                      >Cancel
                      </button>
                   </div>
              </div>
          </div>
      }
    </div>
  );
};

export default Menu;