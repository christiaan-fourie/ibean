'use client';

import { useState } from 'react';
import { FaTools, FaExclamationTriangle } from 'react-icons/fa';

export default function CategoryDataAuditor({ categories, showNotification }) {
  const [issues, setIssues] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  const runAudit = () => {
    setIsScanning(true);
    const foundIssues = [];

    categories.forEach((category) => {
      const categoryIssues = [];

      if (!category.name || typeof category.name !== 'string') {
        categoryIssues.push({ type: 'INVALID_NAME', message: 'Category name is missing or not a string.' });
      }
      if (typeof category.active !== 'boolean') {
        categoryIssues.push({ type: 'INVALID_ACTIVE_FLAG', message: "'active' flag is not a boolean." });
      }
      if (!Array.isArray(category.varieties)) {
        categoryIssues.push({ type: 'INVALID_VARIETIES', message: "'varieties' is not an array." });
      }
      if (typeof category.order !== 'number') {
        categoryIssues.push({ type: 'INVALID_ORDER', message: "'order' is not a number." });
      }
      if (!category.createdAt) {
        categoryIssues.push({ type: 'MISSING_CREATED_AT', message: 'Category is missing creation date.' });
      }

      if (categoryIssues.length > 0) {
        foundIssues.push({ ...category, issues: categoryIssues });
      }
    });

    setIssues(foundIssues);
    setIsScanning(false);
    showNotification(`Audit complete. Found ${foundIssues.length} categories with issues.`, 'success');
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white"><FaTools className="text-sm text-blue-300" /> Category Data Audit</h2>
        <button onClick={runAudit} disabled={isScanning} className="min-h-10 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:bg-neutral-600">
          {isScanning ? 'Scanning...' : 'Scan Categories'}
        </button>
      </div>
      <p className="mb-3 text-xs text-neutral-400">Scans for missing fields, invalid types, and ordering issues.</p>

      <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
        {issues.length > 0 ? (
          issues.map((category) => (
            <div key={category.id} className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm">
              <h3 className="text-sm font-bold text-white">{category.name || 'Category with no name'}</h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                {category.issues.map((issue, index) => (
                  <li key={index} className="flex items-center gap-1.5 text-amber-200">
                    <FaExclamationTriangle className="text-[10px]" /> {issue.message}
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
