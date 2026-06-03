'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { FaTrashAlt } from 'react-icons/fa';
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

const initialStaffState = {
  name: '',
  code: '',
  dob: '',
  accountType: 'staff',
  active: true,
};

const fieldClass =
  'h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20';

const selectClass =
  'h-11 w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/50';

const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
};

const accountTypeOptions = [
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
];

const StaffSelect = ({ value, onValueChange, placeholder, options, className }) => (
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

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newStaff, setNewStaff] = useState(initialStaffState);
  const [editingId, setEditingId] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [notification, setNotification] = useState({ key: 0, message: '', type: '' });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'staff'),
      (snapshot) => {
        setStaff(snapshot.docs.map((staffDoc) => ({ id: staffDoc.id, ...staffDoc.data() })));
        setIsLoading(false);
      },
      () => {
        setNotification({ key: Date.now(), message: 'Error fetching staff.', type: 'error' });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const sortedStaff = useMemo(
    () => [...staff].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [staff]
  );

  const showNotification = (message, type) => {
    setNotification({ key: Date.now(), message, type });
  };

  const resetForm = () => {
    setNewStaff(initialStaffState);
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewStaff((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSelectChange = (name, value) => {
    setNewStaff((prev) => ({ ...prev, [name]: value }));
  };

  const handleStartEdit = (member) => {
    setEditingId(member.id);
    setNewStaff({
      name: member.name || '',
      code: member.code || '',
      dob: toDateInputValue(member.dob),
      accountType: member.accountType || 'staff',
      active: member.active ?? true,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    const normalizedCode = String(newStaff.code || '').padStart(4, '0');

    if (!/^\d{4}$/.test(normalizedCode)) {
      showNotification('Login code must be 4 digits.', 'error');
      return;
    }

    const duplicateStaff = staff.find(
      (member) =>
        String(member.code || '').padStart(4, '0') === normalizedCode &&
        member.id !== editingId
    );

    if (duplicateStaff) {
      showNotification('That login code is already assigned to another staff member.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: newStaff.name.trim(),
        code: normalizedCode,
        dob: newStaff.dob,
        accountType: newStaff.accountType,
        active: Boolean(newStaff.active),
      };

      if (editingId) {
        await updateDoc(doc(db, 'staff', editingId), payload);
        showNotification('Staff updated successfully.', 'success');
      } else {
        await addDoc(collection(db, 'staff'), payload);
        showNotification('Staff added successfully.', 'success');
      }

      resetForm();
    } catch (error) {
      showNotification('Error saving staff.', 'error');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'staff', id));
      showNotification('Staff deleted.', 'success');
    } catch (error) {
      showNotification('Error deleting staff.', 'error');
      console.error(error);
    }
  };

  return (
    <RouteGuard requiredRoles={['manager']}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-900/35 p-2.5 text-neutral-50 md:p-3">
        {notification.message && (
          <div
            key={notification.key}
            className={`fixed bottom-4 right-4 z-50 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-xl ${
              notification.type === 'success'
                ? 'border-green-400/20 bg-green-500/90 text-white'
                : 'border-red-400/20 bg-red-500/90 text-white'
            }`}
          >
            {notification.message}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white md:text-base">
                  {editingId ? 'Edit staff' : 'Create staff'}
                </h2>
                <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
                  Keep staff records compact and easy to update.
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

            <form onSubmit={handleSubmitForm} className="flex h-[calc(100%-3.25rem)] min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              <div className="grid gap-3">
                <Input
                  type="text"
                  name="name"
                  value={newStaff.name}
                  onChange={handleChange}
                  placeholder="Staff name"
                  className={fieldClass}
                  required
                />
                <Input
                  type="text"
                  name="code"
                  value={newStaff.code}
                  onChange={(e) =>
                    setNewStaff((prev) => ({
                      ...prev,
                      code: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  placeholder="Login code"
                  className={fieldClass}
                  required
                  maxLength={4}
                  inputMode="numeric"
                />
              </div>

              <Input
                type="date"
                name="dob"
                value={newStaff.dob}
                onChange={handleChange}
                className={fieldClass}
                required
              />

              <StaffSelect
                value={newStaff.accountType}
                onValueChange={(value) => handleSelectChange('accountType', value)}
                placeholder="Choose account type"
                className={selectClass}
                options={accountTypeOptions}
              />

              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <input
                  type="checkbox"
                  name="active"
                  checked={newStaff.active}
                  onChange={handleChange}
                  className="mt-1 h-5 w-5 rounded border-white/20 bg-neutral-900/60 text-cyan-400 focus:ring-cyan-400/50"
                />
                <span>
                  <span className="block font-medium text-amber-200">Active</span>
                  <span className="block text-sm text-neutral-400">Staff member can log in and process transactions</span>
                </span>
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-12 flex-1 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Update staff' : 'Add staff'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteCandidate({ id: editingId, name: newStaff.name })}
                    className="min-h-12 rounded-xl border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </form>
          </section>

          <section className="min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-white md:text-base">Staff list</h2>
              <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
                Edit staff details or remove inactive accounts.
              </p>
            </div>

            <div className="h-[calc(100%-3.75rem)] space-y-3 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-neutral-400">
                  Loading staff...
                </div>
              ) : sortedStaff.length === 0 ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-neutral-400">
                  No staff members found.
                </div>
              ) : (
                sortedStaff.map((member) => (
                  <article
                    key={member.id}
                    className={`rounded-[24px] border p-4 shadow-lg backdrop-blur-xl ${
                      member.active ? 'border-white/10 bg-white/5' : 'border-red-400/25 bg-red-400/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-white md:text-lg">{member.name}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                              member.accountType === 'manager'
                                ? 'border border-amber-400/30 bg-amber-400/10 text-amber-200'
                                : 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
                            }`}
                          >
                            {member.accountType}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                              member.active
                                ? 'border border-green-400/30 bg-green-400/10 text-green-200'
                                : 'border border-red-400/30 bg-red-400/10 text-red-200'
                            }`}
                          >
                            {member.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-neutral-300">
                          <p>DOB: {member.dob ? new Date(member.dob).toLocaleDateString('en-ZA') : 'N/A'}</p>
                          <p>Code: ****</p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleStartEdit(member)}
                          className="border-white/10 bg-white/5 text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
                        >
                          Edit
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
              <DialogTitle>Delete staff member?</DialogTitle>
              <DialogDescription className="text-neutral-400">
                This removes the staff record permanently.
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
                  await deleteDoc(doc(db, 'staff', deleteCandidate.id));
                  setDeleteCandidate(null);
                  showNotification('Staff deleted.', 'success');
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
