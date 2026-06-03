'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, doc, deleteDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { FaCopy, FaGift, FaTrashAlt } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import db from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';
import { useCollectionLive } from '../../hooks/useCollectionLive';
import { useAuditActor } from '../../hooks/useAuditActor';
import { useToastNotification } from '../../hooks/useToastNotification';
import ToastNotification from '../../components/ToastNotification';

const initialVoucherState = {
  name: '',
  code: '',
  active: true,
  redeemed: false,
  voucherType: 'discount',
  discountType: 'percentage',
  discountValue: '',
  initialValue: '',
  applicableItems: [],
  freeItem: { type: 'product', id: '', name: '', variety: '' },
  maxRedemptions: '',
  redemptionCount: 0,
  expirationMode: 'date',
  expirationDate: '',
};

const fieldClass =
  'h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20';

const selectClass =
  'h-11 w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/50';

const voucherOptions = [
  { value: 'discount', label: 'Discount Voucher' },
  { value: 'freeItem', label: 'Free Item Voucher' },
  { value: 'giftCard', label: 'Gift Card' },
];

const discountOptions = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount (R)' },
];

const freeItemTypeOptions = [
  { value: 'product', label: 'Specific Product' },
  { value: 'category', label: 'Any Item from Category' },
];

const voucherExpiryOptions = [
  { value: 'date', label: 'Expires on date' },
  { value: 'never', label: "Doesn't expire" },
];

const voucherLimitOptions = [
  { value: 'limited', label: 'Limited redemptions' },
  { value: 'infinite', label: 'Infinite redemptions' },
];

const makeGeneratedCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const VoucherSelect = ({ value, onValueChange, placeholder, options, className }) => (
  <Select value={value || ''} onValueChange={onValueChange}>
    <SelectTrigger className={className}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default function Vouchers() {
  const { data: vouchersData, error: vouchersError } = useCollectionLive('vouchers');
  const { data: productsData } = useCollectionLive('products');
  const { data: categoriesData } = useCollectionLive('categories');
  const { notification, notify, clearNotification } = useToastNotification();
  const { hasAuditActor, getAuditActor } = useAuditActor();

  const [newVoucher, setNewVoucher] = useState(initialVoucherState);
  const [isLoading, setIsLoading] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const vouchers = useMemo(
    () =>
      [...(vouchersData || [])].sort((a, b) => {
        const at = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bt = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bt - at;
      }),
    [vouchersData]
  );

  const products = useMemo(
    () => [...(productsData || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [productsData]
  );

  const categories = useMemo(
    () => [...(categoriesData || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categoriesData]
  );

  const productNameById = (id) => products.find((product) => product.id === id)?.name || '';
  const categoryNameById = (id) => categories.find((category) => category.id === id)?.name || '';
  const selectedFreeItemCategory = categories.find((category) => category.id === newVoucher.freeItem.id);
  const selectedFreeItemVarieties = selectedFreeItemCategory?.varieties || [];

  useEffect(() => {
    if (vouchersError) {
      notify('Failed to fetch vouchers.', 'error');
      console.error(vouchersError);
    }
  }, [notify, vouchersError]);

  const resetForm = () => {
    setNewVoucher(initialVoucherState);
    setEditingVoucherId(null);
  };

  const toDateInputValue = (dateValue) => {
    if (!dateValue) return '';
    if (typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toISOString().slice(0, 10);
    }
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  };

  const handleStartEdit = (voucher) => {
    setEditingVoucherId(voucher.id);
    setNewVoucher({
      name: voucher.name || '',
      code: voucher.code || '',
      active: voucher.active ?? true,
      redeemed: voucher.redeemed ?? false,
      voucherType: voucher.voucherType || 'discount',
      discountType: voucher.discountType || 'percentage',
      discountValue: voucher.discountValue != null ? String(voucher.discountValue) : '',
      initialValue: voucher.initialValue != null ? String(voucher.initialValue) : '',
      applicableItems: Array.isArray(voucher.applicableItems) ? voucher.applicableItems : [],
      freeItem: {
        type: voucher.freeItem?.type || 'product',
        id: voucher.freeItem?.id || '',
        name: voucher.freeItem?.name || '',
        variety: voucher.freeItem?.variety || '',
      },
      maxRedemptions: voucher.maxRedemptions == null ? '' : String(voucher.maxRedemptions),
      redemptionCount: voucher.redemptionCount || 0,
      expirationMode: voucher.expirationDate ? 'date' : 'never',
      expirationDate: toDateInputValue(voucher.expirationDate),
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewVoucher((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setNewVoucher((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === 'voucherType') {
        updated.discountType = 'percentage';
        updated.discountValue = '';
        updated.initialValue = '';
        updated.freeItem = { type: 'product', id: '', name: '', variety: '' };
      }

      if (name === 'discountType') {
        updated.discountValue = '';
      }

      if (name === 'type') {
        updated.freeItem = { type: value, id: '', name: '', variety: '' };
      }

      if (name === 'freeItemId') {
        const label = updated.freeItem.type === 'product'
          ? productNameById(value)
          : categoryNameById(value);
        updated.freeItem = {
          ...updated.freeItem,
          id: value,
          name: label,
          variety: '',
        };
      }

      if (name === 'freeItemVariety') {
        updated.freeItem = {
          ...updated.freeItem,
          variety: value,
        };
      }

      if (name === 'expirationMode') {
        updated.expirationMode = value;
        if (value === 'never') {
          updated.expirationDate = '';
        }
      }

      if (name === 'redemptionMode') {
        updated.maxRedemptions = value === 'infinite' ? '' : '1';
      }

      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!newVoucher.name) {
      notify('Voucher name is required.', 'error');
      return;
    }

    if (newVoucher.expirationMode === 'date' && !newVoucher.expirationDate) {
      notify('Select an expiration date or choose "Doesn\'t expire".', 'error');
      return;
    }

    if (!hasAuditActor) {
      notify('Staff audit identity is missing.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const voucherData = {
        ...newVoucher,
        code: newVoucher.code || makeGeneratedCode(),
        ...(newVoucher.expirationMode === 'date'
          ? { expirationDate: Timestamp.fromDate(new Date(newVoucher.expirationDate)) }
          : {}),
        discountValue: parseFloat(newVoucher.discountValue) || 0,
        initialValue: parseFloat(newVoucher.initialValue) || 0,
        currentBalance: parseFloat(newVoucher.initialValue) || 0,
        ...(String(newVoucher.maxRedemptions).trim() === ''
          ? {}
          : { maxRedemptions: parseInt(newVoucher.maxRedemptions, 10) || 1 }),
        updatedBy: getAuditActor(),
        updatedAt: Timestamp.now(),
      };

      if (editingVoucher && editingVoucher.voucherType === 'giftCard') {
        voucherData.currentBalance =
          editingVoucher.currentBalance != null
            ? editingVoucher.currentBalance
            : parseFloat(newVoucher.initialValue) || 0;
      }

      if (voucherData.voucherType !== 'discount') {
        delete voucherData.discountType;
        delete voucherData.discountValue;
      }

      if (voucherData.voucherType !== 'freeItem') {
        delete voucherData.freeItem;
      }

      if (voucherData.voucherType !== 'giftCard') {
        delete voucherData.initialValue;
        delete voucherData.currentBalance;
      }

      if (newVoucher.expirationMode === 'never') {
        delete voucherData.expirationDate;
      }

      if (String(newVoucher.maxRedemptions).trim() === '') {
        delete voucherData.maxRedemptions;
      }

      if (editingVoucherId) {
        delete voucherData.createdBy;
        delete voucherData.createdAt;
        await updateDoc(doc(db, 'vouchers', editingVoucherId), voucherData);
        notify('Voucher updated successfully!', 'success');
      } else {
        voucherData.createdBy = getAuditActor();
        voucherData.createdAt = Timestamp.now();
        await addDoc(collection(db, 'vouchers'), voucherData);
        notify('Voucher created successfully!', 'success');
      }
      resetForm();
    } catch (error) {
      notify(`Failed to create voucher: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (voucherId) => {
    try {
      await deleteDoc(doc(db, 'vouchers', voucherId));
      if (editingVoucherId === voucherId) {
        resetForm();
      }
      notify('Voucher deleted successfully.', 'success');
    } catch (error) {
      notify('Failed to delete voucher.', 'error');
      console.error(error);
    }
  };

  const formatVoucherDetails = (voucher) => {
    switch (voucher.voucherType) {
      case 'discount':
        return voucher.discountType === 'percentage'
          ? `${voucher.discountValue}% off`
          : `R ${Number(voucher.discountValue || 0).toFixed(2)} off`;
      case 'freeItem':
        if (voucher.freeItem?.type === 'category' && voucher.freeItem?.variety) {
          return `Free category item: ${voucher.freeItem?.name || 'Category'} · ${voucher.freeItem.variety}`;
        }
        if (voucher.freeItem?.type === 'category') {
          return `Free category item: ${voucher.freeItem?.name || 'Category'}`;
        }
        return `Free product: ${voucher.freeItem?.name || 'Item'}`;
      case 'giftCard':
        return `Gift Card: R ${Number(voucher.currentBalance || 0).toFixed(2)} / R ${Number(voucher.initialValue || 0).toFixed(2)}`;
      default:
        return 'Standard Voucher';
    }
  };

  const getRedemptionLabel = (voucher) => {
    if (voucher.maxRedemptions == null) return 'Infinite';
    return `${voucher.redemptionCount} / ${voucher.maxRedemptions}`;
  };

  const isEditing = Boolean(editingVoucherId);
  const editingVoucher = editingVoucherId
    ? vouchers.find((voucher) => voucher.id === editingVoucherId)
    : null;

  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => notify('Voucher code copied!', 'success'))
        .catch(() => notify('Failed to copy code.', 'error'));
      return;
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      notify('Voucher code copied!', 'success');
    } catch {
      notify('Failed to copy code.', 'error');
    }
  };

  const safeFormatDate = (dateVal) => {
    if (!dateVal) return 'Does not expire';
    if (typeof dateVal.toDate === 'function') {
      return dateVal.toDate().toLocaleDateString();
    }

    try {
      return new Date(dateVal).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  return (
    <RouteGuard requiredRoles={['manager']}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-900/35 p-2.5 text-neutral-50 md:p-3">
        {notification.message && (
          <ToastNotification
            key={notification.key}
            message={notification.message}
            type={notification.type}
            onClose={clearNotification}
          />
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-white md:text-base">
                {isEditing ? 'Edit voucher' : 'Create voucher'}
              </h2>
              <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
                Build discount, free item, and gift card vouchers without changing the underlying voucher rules.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex h-[calc(100%-3.25rem)] min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              <div className="grid gap-3">
                <Input
                  type="text"
                  name="name"
                  value={newVoucher.name}
                  onChange={handleChange}
                  placeholder="Voucher name"
                  className={fieldClass}
                  required
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="text"
                    name="code"
                    value={newVoucher.code}
                    onChange={handleChange}
                    placeholder="Voucher code (optional)"
                    className={`${fieldClass} flex-1`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-white/10 bg-white/5 px-4 text-white hover:bg-white/10"
                    onClick={() => setNewVoucher((prev) => ({ ...prev, code: makeGeneratedCode() }))}
                  >
                    Generate code
                  </Button>
                </div>
              </div>

              <VoucherSelect
                value={newVoucher.voucherType}
                onValueChange={(value) => handleSelectChange('voucherType', value)}
                placeholder="Choose voucher type"
                className={selectClass}
                options={voucherOptions}
              />

              {newVoucher.voucherType === 'discount' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-cyan-200">Discount settings</h3>
                  <div className="mt-3 space-y-3">
                    <VoucherSelect
                      value={newVoucher.discountType}
                      onValueChange={(value) => handleSelectChange('discountType', value)}
                      placeholder="Choose discount type"
                      className={selectClass}
                      options={discountOptions}
                    />
                    <Input
                      type="number"
                      name="discountValue"
                      value={newVoucher.discountValue}
                      onChange={handleChange}
                      placeholder="Discount value"
                      className={fieldClass}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              )}

              {newVoucher.voucherType === 'freeItem' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-emerald-200">Free item settings</h3>
                  <div className="mt-3 space-y-3">
                    <VoucherSelect
                      value={newVoucher.freeItem.type}
                      onValueChange={(value) => handleSelectChange('type', value)}
                      placeholder="Choose item type"
                      className={selectClass}
                      options={freeItemTypeOptions}
                    />
                    {newVoucher.freeItem.type === 'product' ? (
                      <VoucherSelect
                        value={newVoucher.freeItem.id}
                        onValueChange={(value) => handleSelectChange('freeItemId', value)}
                        placeholder="Select product..."
                        className={selectClass}
                        options={products.map((product) => ({ value: product.id, label: product.name }))}
                      />
                    ) : (
                      <>
                        <VoucherSelect
                          value={newVoucher.freeItem.id}
                          onValueChange={(value) => handleSelectChange('freeItemId', value)}
                          placeholder="Select category..."
                          className={selectClass}
                          options={categories.map((category) => ({ value: category.id, label: category.name }))}
                        />
                        {selectedFreeItemVarieties.length > 0 && (
                          <VoucherSelect
                            value={newVoucher.freeItem.variety}
                            onValueChange={(value) => handleSelectChange('freeItemVariety', value)}
                            placeholder="Select variety..."
                            className={selectClass}
                            options={selectedFreeItemVarieties.map((variety) => ({ value: variety, label: variety }))}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {newVoucher.voucherType === 'giftCard' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-amber-200">Gift card value</h3>
                  <div className="mt-3">
                    <Input
                      type="number"
                      name="initialValue"
                      value={newVoucher.initialValue}
                      onChange={handleChange}
                      placeholder="Initial value (R)"
                      className={fieldClass}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <VoucherSelect
                    value={newVoucher.expirationMode}
                    onValueChange={(value) => handleSelectChange('expirationMode', value)}
                    placeholder="Expiry"
                    className={selectClass}
                    options={voucherExpiryOptions}
                  />
                  {newVoucher.expirationMode === 'date' ? (
                    <Input
                      type="date"
                      name="expirationDate"
                      value={newVoucher.expirationDate}
                      onChange={handleChange}
                      min={new Date().toISOString().split('T')[0]}
                      className={fieldClass}
                      required
                    />
                  ) : (
                    <p className="px-1 text-xs text-neutral-400">The voucher remains valid until it is manually deactivated.</p>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <VoucherSelect
                    value={String(newVoucher.maxRedemptions).trim() === '' ? 'infinite' : 'limited'}
                    onValueChange={(value) => handleSelectChange('redemptionMode', value)}
                    placeholder="Redemptions"
                    className={selectClass}
                    options={voucherLimitOptions}
                  />
                  {String(newVoucher.maxRedemptions).trim() !== '' && (
                    <Input
                      type="number"
                      name="maxRedemptions"
                      value={newVoucher.maxRedemptions}
                      onChange={handleChange}
                      placeholder="Max redemptions"
                      className={fieldClass}
                      min="1"
                    />
                  )}
                </div>
              </div>

              <p className="px-1 text-xs text-neutral-400">Optional. Leave blank and a code will be generated.</p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="min-h-12 flex-1 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600"
                >
                  {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : isEditing ? 'Save changes' : 'Create voucher'}
                </Button>
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={resetForm}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          </section>

          <section className="min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-white md:text-base">Voucher list</h2>
              <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
                Copy, review, and remove vouchers from one place.
              </p>
            </div>

            <div className="h-[calc(100%-3.75rem)] space-y-3 overflow-y-auto pr-1">
              {vouchers.length === 0 ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-neutral-400">
                  No vouchers created yet.
                </div>
              ) : (
                vouchers.map((voucher) => (
                  <article
                    key={voucher.id}
                    className={`rounded-[24px] border p-4 shadow-lg backdrop-blur-xl ${
                      voucher.redeemed
                        ? 'border-red-400/25 bg-red-400/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FaGift className="text-amber-300" />
                          <h3 className="text-base font-semibold text-white md:text-lg">{voucher.name}</h3>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-lg text-amber-300">{voucher.code}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => copyToClipboard(voucher.code)}
                            className="border-white/10 bg-white/5 text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
                          >
                            <FaCopy />
                          </Button>
                        </div>
                        <p className="mt-2 text-sm text-neutral-200">{formatVoucherDetails(voucher)}</p>
                        {voucher.freeItem?.type === 'category' && voucher.freeItem?.variety && (
                          <p className="mt-1 text-xs text-neutral-400">
                            Applies to the {voucher.freeItem.variety} variety only.
                          </p>
                        )}
                        <div className="mt-3 space-y-1 text-xs text-neutral-400">
                          <p>Expires: {safeFormatDate(voucher.expirationDate)}</p>
                          <p>Redemptions: {getRedemptionLabel(voucher)}</p>
                          {voucher.createdBy?.name && <p>Created by: {voucher.createdBy.name}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            voucher.redeemed
                              ? 'bg-red-900/30 text-red-300'
                              : 'bg-green-900/30 text-green-300'
                          }`}
                        >
                          {voucher.redeemed ? 'Redeemed' : 'Active'}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleStartEdit(voucher)}
                          className="min-h-9 rounded-xl border-white/10 bg-white/5 px-3 text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setDeleteCandidate(voucher)}
                          className="border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
                        >
                          <FaTrashAlt />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <Dialog
          open={Boolean(deleteCandidate)}
          onOpenChange={(open) => {
            if (!open) setDeleteCandidate(null);
          }}
        >
          <DialogContent className="border-white/10 bg-neutral-900 text-white">
            <DialogHeader className="text-left">
              <DialogTitle>Delete voucher?</DialogTitle>
              <DialogDescription className="text-neutral-400">
                This removes the voucher permanently. It cannot be recovered.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => setDeleteCandidate(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-500 text-white hover:bg-red-600"
                onClick={async () => {
                  if (!deleteCandidate) return;
                  await handleDelete(deleteCandidate.id);
                  setDeleteCandidate(null);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RouteGuard>
  );
}
