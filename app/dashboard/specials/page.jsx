'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { FaCalendarAlt, FaEdit, FaStar, FaTrashAlt } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import db from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';
import { getStoreId, documentBelongsToStore } from '../../../utils/storeId';
import { useCollectionLive } from '../../hooks/useCollectionLive';
import { useToastNotification } from '../../hooks/useToastNotification';
import ToastNotification from '../../components/ToastNotification';

const initialSpecialState = {
  name: '',
  description: '',
  active: true,
  mutuallyExclusive: false,
  triggerType: 'product',
  triggerProduct: '',
  triggerProductSize: '',
  triggerCategory: '',
  triggerCategorySize: '',
  triggerQuantity: 1,
  rewardType: 'product',
  rewardProduct: '',
  rewardProductSize: '',
  rewardCategory: '',
  rewardCategorySize: '',
  rewardQuantity: 1,
  discountType: 'free',
  discountValue: 100,
  fixedDiscountAmount: 0,
  startDate: '',
  endDate: '',
};

const fieldClass =
  'h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20';

const selectClass =
  'h-11 w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/50';

const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return '';
};

export default function Specials() {
  const { data: specialsData, error: specialsError } = useCollectionLive('specials');
  const { data: productsData, error: productsError } = useCollectionLive('products');
  const { data: categoriesData, error: categoriesError } = useCollectionLive('categories');
  const { notification, notify, clearNotification } = useToastNotification();

  const [newSpecial, setNewSpecial] = useState(initialSpecialState);
  const [editingId, setEditingId] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const authUser = getAuth().currentUser;

  const specials = useMemo(
    () =>
      [...(specialsData || [])]
        .filter((special) => documentBelongsToStore(special.storeId, authUser))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [authUser, specialsData]
  );

  const products = useMemo(
    () => [...(productsData || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [productsData]
  );

  const categories = useMemo(
    () => [...(categoriesData || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categoriesData]
  );

  const filteredSpecials = useMemo(
    () =>
      specials.filter((special) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'exclusive') return !!special.mutuallyExclusive;
        if (activeTab === 'stackable') return !special.mutuallyExclusive;
        return true;
      }),
    [activeTab, specials]
  );

  useEffect(() => {
    if (specialsError) {
      notify('Failed to fetch specials.', 'error');
      console.error(specialsError);
    }
    if (productsError) {
      notify('Failed to fetch products.', 'error');
      console.error(productsError);
    }
    if (categoriesError) {
      notify('Failed to fetch categories.', 'error');
      console.error(categoriesError);
    }
  }, [categoriesError, notify, productsError, specialsError]);

  const resetForm = () => {
    setNewSpecial(initialSpecialState);
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setNewSpecial((prev) => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };

      if (name === 'triggerType') {
        updated.triggerProduct = '';
        updated.triggerProductSize = '';
        updated.triggerCategory = '';
        updated.triggerCategorySize = '';
      }

      if (name === 'rewardType') {
        updated.rewardProduct = '';
        updated.rewardProductSize = '';
        updated.rewardCategory = '';
        updated.rewardCategorySize = '';
      }

      if (name === 'triggerProduct' || name === 'triggerCategory') {
        updated.triggerProductSize = '';
        updated.triggerCategorySize = '';
      }

      if (name === 'rewardProduct' || name === 'rewardCategory') {
        updated.rewardProductSize = '';
        updated.rewardCategorySize = '';
      }

      return updated;
    });
  };

  const handleStartEdit = (special) => {
    setEditingId(special.id);
    setNewSpecial({
      ...initialSpecialState,
      ...special,
      startDate: toDateInputValue(special.startDate),
      endDate: toDateInputValue(special.endDate),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (specialId) => {
    try {
      await deleteDoc(doc(db, 'specials', specialId));
      notify('Special deleted successfully', 'success');
    } catch (error) {
      notify('Failed to delete special', 'error');
      console.error('Error deleting special:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!newSpecial.name) {
      notify('Special name is required.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const auth = getAuth();
      const specialData = {
        ...newSpecial,
        storeId: getStoreId(auth.currentUser),
        triggerQuantity: parseInt(newSpecial.triggerQuantity, 10) || 1,
        rewardQuantity: parseInt(newSpecial.rewardQuantity, 10) || 1,
      };

      if (newSpecial.discountType === 'free') {
        specialData.discountValue = 100;
        specialData.fixedDiscountAmount = 0;
      } else if (newSpecial.discountType === 'percentage') {
        specialData.discountValue = parseInt(newSpecial.discountValue, 10) || 0;
        specialData.fixedDiscountAmount = 0;
      } else if (newSpecial.discountType === 'fixed') {
        specialData.discountValue = 0;
        specialData.fixedDiscountAmount = parseFloat(newSpecial.fixedDiscountAmount) || 0;
      }

      if (specialData.startDate) {
        specialData.startDate = Timestamp.fromDate(new Date(`${specialData.startDate}T00:00:00`));
      }

      if (specialData.endDate) {
        specialData.endDate = Timestamp.fromDate(new Date(`${specialData.endDate}T23:59:59`));
      }

      if (editingId) {
        await updateDoc(doc(db, 'specials', editingId), specialData);
        notify('Special updated successfully', 'success');
      } else {
        await addDoc(collection(db, 'specials'), specialData);
        notify('Special added successfully', 'success');
      }

      resetForm();
    } catch (error) {
      notify(`Failed to save special: ${error.message}`, 'error');
      console.error('Error saving special:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getVarietiesForCategory = (categoryName) => {
    const category = categories.find((category) => category.name === categoryName);
    return category?.varieties || [];
  };

  const renderSizeDropdown = (field, value, onChange) => {
    let categoryName = '';

    if (field === 'triggerProduct' || field === 'rewardProduct') {
      const product = products.find((item) => item.id === newSpecial[field]);
      categoryName = product?.category;
    } else if (field === 'triggerCategory' || field === 'rewardCategory') {
      categoryName = newSpecial[field];
    }

    const varieties = getVarietiesForCategory(categoryName);
    if (varieties.length === 0) return null;

    return (
      <select name={`${field}Size`} value={value} onChange={onChange} className={selectClass}>
        <option value="">Any size</option>
        {varieties.map((variety) => (
          <option key={variety} value={variety}>
            {variety}
          </option>
        ))}
      </select>
    );
  };

  const productNameById = (id) => products.find((product) => product.id === id)?.name || 'N/A';

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
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white md:text-base">
                  {editingId ? 'Edit special' : 'Create special'}
                </h2>
                <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
                  Keep the form focused on one offer at a time.
                </p>
              </div>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={resetForm}
                >
                  Cancel edit
                </Button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col space-y-4">
              <div className="grid gap-3">
                <Input
                  type="text"
                  name="name"
                  value={newSpecial.name}
                  onChange={handleChange}
                  placeholder="Special name"
                  className={fieldClass}
                  required
                />
                <Input
                  type="text"
                  name="description"
                  value={newSpecial.description}
                  onChange={handleChange}
                  placeholder="Description"
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-cyan-200">Trigger Conditions</h3>
                  <div className="mt-3 space-y-3">
                    <select
                      name="triggerType"
                      value={newSpecial.triggerType}
                      onChange={handleChange}
                      className={selectClass}
                    >
                      <option value="product">Specific Product</option>
                      <option value="category">Any Product in Category</option>
                    </select>

                    {newSpecial.triggerType === 'product' ? (
                      <select
                        name="triggerProduct"
                        value={newSpecial.triggerProduct}
                        onChange={handleChange}
                        className={selectClass}
                      >
                        <option value="">Select product...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        name="triggerCategory"
                        value={newSpecial.triggerCategory}
                        onChange={handleChange}
                        className={selectClass}
                      >
                        <option value="">Select category...</option>
                        {categories.map((category) => (
                          <option key={category.id || category.name} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {newSpecial.triggerType === 'product'
                      ? renderSizeDropdown('triggerProduct', newSpecial.triggerProductSize, handleChange)
                      : renderSizeDropdown('triggerCategory', newSpecial.triggerCategorySize, handleChange)}

                    <Input
                      type="number"
                      name="triggerQuantity"
                      value={newSpecial.triggerQuantity}
                      onChange={handleChange}
                      placeholder="Quantity needed"
                      min="1"
                      className={fieldClass}
                      required
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-emerald-200">Reward Conditions</h3>
                  <div className="mt-3 space-y-3">
                    <select
                      name="rewardType"
                      value={newSpecial.rewardType}
                      onChange={handleChange}
                      className={selectClass}
                    >
                      <option value="product">Specific Product</option>
                      <option value="category">Any Product in Category</option>
                    </select>

                    {newSpecial.rewardType === 'product' ? (
                      <select
                        name="rewardProduct"
                        value={newSpecial.rewardProduct}
                        onChange={handleChange}
                        className={selectClass}
                      >
                        <option value="">Select product...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        name="rewardCategory"
                        value={newSpecial.rewardCategory}
                        onChange={handleChange}
                        className={selectClass}
                      >
                        <option value="">Select category...</option>
                        {categories.map((category) => (
                          <option key={category.id || category.name} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {newSpecial.rewardType === 'product'
                      ? renderSizeDropdown('rewardProduct', newSpecial.rewardProductSize, handleChange)
                      : renderSizeDropdown('rewardCategory', newSpecial.rewardCategorySize, handleChange)}

                    <Input
                      type="number"
                      name="rewardQuantity"
                      value={newSpecial.rewardQuantity}
                      onChange={handleChange}
                      placeholder="Reward quantity"
                      min="1"
                      className={fieldClass}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-amber-200">Discount Settings</h3>
                <div className="mt-3 space-y-3">
                  <select
                    name="discountType"
                    value={newSpecial.discountType}
                    onChange={handleChange}
                    className={selectClass}
                  >
                    <option value="free">Free</option>
                    <option value="percentage">Percentage Discount</option>
                    <option value="fixed">Fixed Amount Discount</option>
                  </select>

                  {newSpecial.discountType === 'percentage' && (
                    <Input
                      type="number"
                      name="discountValue"
                      value={newSpecial.discountValue}
                      onChange={handleChange}
                      placeholder="Discount %"
                      min="1"
                      max="100"
                      className={fieldClass}
                    />
                  )}

                  {newSpecial.discountType === 'fixed' && (
                    <Input
                      type="number"
                      name="fixedDiscountAmount"
                      value={newSpecial.fixedDiscountAmount}
                      onChange={handleChange}
                      placeholder="Discount amount (R)"
                      min="0.01"
                      step="0.01"
                      className={fieldClass}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="mb-2 text-sm font-semibold text-blue-200">Validity period</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    type="date"
                    name="startDate"
                    value={newSpecial.startDate}
                    onChange={handleChange}
                    className={fieldClass}
                  />
                  <Input
                    type="date"
                    name="endDate"
                    value={newSpecial.endDate}
                    onChange={handleChange}
                    className={fieldClass}
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <input
                  type="checkbox"
                  id="mutuallyExclusive"
                  name="mutuallyExclusive"
                  checked={newSpecial.mutuallyExclusive}
                  onChange={handleChange}
                  className="mt-1 h-5 w-5 rounded border-white/20 bg-neutral-900/60 text-cyan-400 focus:ring-cyan-400/50"
                />
                <span>
                  <span className="block font-medium text-amber-200">Mutually exclusive</span>
                  <span className="block text-sm text-neutral-400">Cannot stack with other specials</span>
                </span>
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="min-h-12 flex-1 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600"
                >
                  {isLoading ? 'Saving...' : editingId ? 'Update special' : 'Add special'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    className="min-h-12 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </section>

          <section className="min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white md:text-base">Specials list</h2>
                <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
                  Review active rules and edit the ones that need changes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={activeTab === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('all')}
                  className={
                    activeTab === 'all'
                      ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                      : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                  }
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'exclusive' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('exclusive')}
                  className={
                    activeTab === 'exclusive'
                      ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                      : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                  }
                >
                  <FaStar className="mr-2" />
                  Exclusive
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'stackable' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('stackable')}
                  className={
                    activeTab === 'stackable'
                      ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                      : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                  }
                >
                  Stackable
                </Button>
              </div>
            </div>

            <div className="h-[calc(100%-3.75rem)] space-y-3 overflow-y-auto pr-1">
              {filteredSpecials.length === 0 ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-neutral-400">
                  No specials match the current filter.
                </div>
              ) : (
                filteredSpecials.map((special) => (
                  <article
                    key={special.id}
                    className={`rounded-[24px] border p-4 shadow-lg backdrop-blur-xl ${
                      special.mutuallyExclusive
                        ? 'border-yellow-400/25 bg-yellow-400/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-white md:text-lg">{special.name}</h3>
                          {special.mutuallyExclusive && (
                            <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-yellow-200">
                              Exclusive
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-neutral-400">
                          {special.description || 'No description provided.'}
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-neutral-200">
                          <p>
                            <span className="font-semibold text-cyan-200">Buy:</span> {special.triggerQuantity} x{' '}
                            {special.triggerType === 'product'
                              ? productNameById(special.triggerProduct)
                              : special.triggerCategory}{' '}
                            {special.triggerProductSize || special.triggerCategorySize}
                          </p>
                          <p>
                            <span className="font-semibold text-emerald-200">Get:</span> {special.rewardQuantity} x{' '}
                            {special.rewardType === 'product'
                              ? productNameById(special.rewardProduct)
                              : special.rewardCategory}{' '}
                            {special.rewardProductSize || special.rewardCategorySize}{' '}
                            <span className="font-semibold text-amber-200">
                              {special.discountType === 'free'
                                ? 'FREE'
                                : special.discountType === 'percentage'
                                  ? `${special.discountValue}% off`
                                  : `R${Number(special.fixedDiscountAmount || 0).toFixed(2)} off`}
                            </span>
                          </p>
                          {special.startDate && (
                            <p className="flex items-center gap-2 text-xs text-neutral-400">
                              <FaCalendarAlt />
                              {typeof special.startDate?.toDate === 'function'
                                ? special.startDate.toDate().toLocaleDateString('en-ZA')
                                : special.startDate}{' '}
                              to{' '}
                              {special.endDate?.toDate
                                ? special.endDate.toDate().toLocaleDateString('en-ZA')
                                : special.endDate || 'open ended'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleStartEdit(special)}
                          className="border-white/10 bg-white/5 text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
                        >
                          <FaEdit />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setDeleteCandidate(special)}
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
              <DialogTitle>Delete special?</DialogTitle>
              <DialogDescription className="text-neutral-400">
                This removes the special rule permanently. You can recreate it later if needed.
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
