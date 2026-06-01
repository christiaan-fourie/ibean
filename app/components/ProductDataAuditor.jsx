'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { FaTools, FaExclamationTriangle } from 'react-icons/fa';
import db from '../../utils/firebase';

export default function ProductDataAuditor({ products, categories, showNotification }) {
  const [issues, setIssues] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  const runAudit = () => {
    setIsScanning(true);
    const foundIssues = [];

    products.forEach((product) => {
      const productIssues = [];

      if (product.price && typeof product.price !== 'number') {
        productIssues.push({ type: 'INVALID_PRICE_TYPE', message: `Price is a ${typeof product.price}, should be a number.` });
      }

      if (product.varietyPrices) {
        Object.entries(product.varietyPrices).forEach(([variety, price]) => {
          if (price && typeof price !== 'number') {
            productIssues.push({ type: 'INVALID_VARIETY_PRICE_TYPE', message: `Variety '${variety}' price is a ${typeof price}, should be a number.` });
          }
        });
      }

      if (!categories.some((cat) => cat.name === product.category)) {
        productIssues.push({ type: 'INVALID_CATEGORY', message: `Category '${product.category}' does not exist or is inactive.` });
      }

      if (!product.name) productIssues.push({ type: 'MISSING_FIELD', message: 'Product is missing a name.' });
      if (!product.category) productIssues.push({ type: 'MISSING_FIELD', message: 'Product is missing a category.' });
      if (!product.createdAt) productIssues.push({ type: 'MISSING_FIELD', message: 'Product is missing creation date.' });

      if (productIssues.length > 0) {
        foundIssues.push({ ...product, issues: productIssues });
      }
    });

    setIssues(foundIssues);
    setIsScanning(false);
    showNotification(`Audit complete. Found ${foundIssues.length} products with issues.`, 'success');
  };

  const handleFixIssue = async (product, issue) => {
    let fixable = true;
    const updatedData = {};

    switch (issue.type) {
      case 'INVALID_PRICE_TYPE':
        updatedData.price = parseFloat(product.price);
        break;
      case 'INVALID_VARIETY_PRICE_TYPE':
        updatedData.varietyPrices = { ...product.varietyPrices };
        Object.entries(updatedData.varietyPrices).forEach(([variety, price]) => {
          if (typeof price !== 'number') {
            updatedData.varietyPrices[variety] = parseFloat(price);
          }
        });
        break;
      default:
        fixable = false;
        showNotification('This issue requires manual correction in Products Management.', 'error');
        break;
    }

    if (!fixable) return;

    try {
      await updateDoc(doc(db, 'products', product.id), updatedData);
      showNotification(`Successfully fixed ${issue.type} for ${product.name}.`, 'success');
      runAudit();
    } catch (error) {
      showNotification(`Failed to fix issue: ${error.message}`, 'error');
      console.error('Failed to fix product data:', error);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white"><FaTools className="text-sm text-blue-300" /> Data Integrity Audit</h2>
        <button onClick={runAudit} disabled={isScanning} className="min-h-10 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:bg-neutral-600">
          {isScanning ? 'Scanning...' : 'Scan Products'}
        </button>
      </div>
      <p className="mb-3 text-xs text-neutral-400">Scans for invalid types, missing fields, and category mismatches.</p>

      <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
        {issues.length > 0 ? (
          issues.map((product) => (
            <div key={product.id} className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm">
              <h3 className="text-sm font-bold text-white">{product.name}</h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                {product.issues.map((issue, index) => (
                  <li key={index} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-amber-200"><FaExclamationTriangle className="text-[10px]" /> {issue.message}</span>
                    <button onClick={() => handleFixIssue(product, issue)} className="rounded-lg bg-blue-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-600">
                      {['INVALID_CATEGORY', 'MISSING_FIELD'].includes(issue.type) ? 'Manual Fix' : 'Attempt Fix'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="py-3 text-center text-xs text-neutral-500">No issues found, or no audit has been run yet.</p>
        )}
      </div>
    </div>
  );
}
