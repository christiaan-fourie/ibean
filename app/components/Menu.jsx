'use client';

import React, { useState, useEffect } from 'react';
import { FaBars, FaLock } from 'react-icons/fa'; // Added FaLock here
import { CgClose } from "react-icons/cg";
import ManageProducts from './ManageProducts'; // Import the ManageProducts component
import Sales from './Sales'; // Import the Sales component
import Refunds from './Refunds'; // *** Import the new Refunds component ***
import { auth } from '../../utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Removed duplicate FaLock import

const Menu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManageProductsOpen, setIsManageProductsOpen] = useState(false);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isRefundsOpen, setIsRefundsOpen] = useState(false); // *** State for Refunds popup ***

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

      {/* Backdrop */}
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
                  setIsSalesOpen(true);
                  toggleMenu();
                }}
                className="w-full text-left bg-neutral-700 text-white py-1.5 px-3 text-sm rounded-md hover:bg-neutral-600 transition-colors"
              >
                Sales
              </button>
            </li>
            {/* *** Add Refunds Button *** */}
            <li>
              <button
                onClick={() => {
                  setIsRefundsOpen(true); // Open Refunds popup
                  toggleMenu(); // Close the menu
                }}
                className="w-full text-left bg-neutral-700 text-white py-1.5 px-3 text-sm rounded-md hover:bg-neutral-600 transition-colors"
              >
                Refunds
              </button>
            </li>
            {/* ************************* */}
            <li>
              <button
                onClick={() => {
                  setIsManageProductsOpen(true);
                  toggleMenu();
                }}
                className="w-full text-left bg-neutral-700 text-white py-1.5 px-3 text-sm rounded-md hover:bg-neutral-600 transition-colors"
              >
                Manage Products
              </button>
            </li>
            <li>
              <button
                className="flex items-center gap-2 bg-neutral-700 text-white py-1.5 px-3 text-sm rounded-md hover:bg-neutral-600 transition-colors w-full text-left"
                onClick={() => {
                    setShowConfirmLogout(true)
                }}
              >
                {user && (
                    <span className="text-white truncate">{user.email}</span> // Added truncate
                )}
                <FaLock className="ml-auto flex-shrink-0" /> {/* Ensure icon stays right */}
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
      {/* *** Refunds Popup *** */}
      {isRefundsOpen && (
        <Refunds onClose={() => setIsRefundsOpen(false)} />
      )}
      {/* ********************* */}

      {/* Logout Confirmation */}
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
                            setIsOpen(false); // Close menu on logout
                        }}>Logout
                        </button>
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
