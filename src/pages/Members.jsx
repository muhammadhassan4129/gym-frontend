import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Pencil,
  X,
  Phone,
  CalendarDays,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  ArrowUpRight,
} from 'lucide-react';

import memberService from '../services/memberService';

const PAGE_SIZE = 10;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function pakistanDate(value = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function displayDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function emptyForm() {
  return {
    fullName: '',
    phone: '',
    address: '',
    registrationDate: pakistanDate(),
    notes: '',
  };
}

function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'M'
  );
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

function validateForm(form) {
  const errors = {};

  if (!form.fullName.trim()) {
    errors.fullName = 'Enter the member’s full name.';
  } else if (form.fullName.trim().length > 120) {
    errors.fullName = 'Name must not exceed 120 characters.';
  }

  const phone = form.phone.trim();
  const digits = phone.replace(/\D/g, '');

  if (!phone) {
    errors.phone = 'Enter a phone number.';
  } else if (
    !/^\+?[\d\s()-]+$/.test(phone) ||
    digits.length < 7 ||
    digits.length > 15 ||
    phone.length > 30
  ) {
    errors.phone = 'Enter a valid phone number.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.registrationDate)) {
    errors.registrationDate = 'Select a valid registration date.';
  } else {
    const date = new Date(
      `${form.registrationDate}T00:00:00+05:00`
    );

    if (
      Number.isNaN(date.getTime()) ||
      pakistanDate(date) !== form.registrationDate
    ) {
      errors.registrationDate = 'Select a valid registration date.';
    }
  }

  if (form.address.trim().length > 500) {
    errors.address = 'Address must not exceed 500 characters.';
  }

  if (form.notes.trim().length > 2000) {
    errors.notes = 'Notes must not exceed 2,000 characters.';
  }

  return errors;
}

// ─────────────────────────────────────────────
// Shared Tailwind classes
// ─────────────────────────────────────────────

const focusClass =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-lime-300 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[#14191e]';

const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 ' +
  'rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold ' +
  'text-zinc-950 transition hover:bg-lime-200 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  focusClass;

const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 ' +
  'rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 ' +
  'text-sm font-medium text-zinc-200 transition ' +
  'hover:border-white/20 hover:bg-white/10 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  focusClass;

const iconButtonClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center ' +
  'rounded-xl border border-white/10 text-zinc-400 transition ' +
  'hover:bg-white/5 hover:text-white ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  focusClass;

function inputClass(hasError) {
  return (
    'w-full min-w-0 rounded-xl border bg-[#0d1217] px-3.5 py-3 ' +
    'text-sm text-zinc-100 outline-none transition ' +
    'placeholder:text-zinc-600 disabled:cursor-not-allowed ' +
    'disabled:opacity-60 focus:ring-2 ' +
    (hasError
      ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/10'
      : 'border-white/10 focus:border-lime-300/60 focus:ring-lime-300/10')
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const nameInputRef = useRef(null);
  const openerRef = useRef(null);

  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const savingRef = useRef(false);

  // ─────────────────────────────────────────────
  // Fetch members through service
  // ─────────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    const requestId = ++requestRef.current;

    setLoading(true);
    setListError('');

    try {
      const data = await memberService.getMembers();

      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setMembers(data);
      }
    } catch (error) {
      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setListError(errorMessage(error));
      }
    } finally {
      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadMembers();

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadMembers]);

  // Native dialog provides keyboard focus containment.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (modalOpen && !dialog.open) {
      dialog.showModal();
      nameInputRef.current?.focus();
    } else if (!modalOpen && dialog.open) {
      dialog.close();
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  // ─────────────────────────────────────────────
  // Search and pagination
  // ─────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return members;

    return members.filter((member) =>
      [
        member.fullName,
        member.phone,
        member.memberId,
      ].some((value) =>
        String(value || '').toLowerCase().includes(query)
      )
    );
  }, [members, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const visibleMembers = filteredMembers.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  // ─────────────────────────────────────────────
  // Modal actions
  // ─────────────────────────────────────────────

  function openCreate() {
    openerRef.current = document.activeElement;

    setEditingMember(null);
    setForm(emptyForm());
    setFieldErrors({});
    setFormError('');
    setSuccess('');
    setModalOpen(true);
  }

  function openEdit(member) {
    openerRef.current = document.activeElement;

    setEditingMember(member);

    setForm({
      fullName: member.fullName || '',
      phone: member.phone || '',
      address: member.address || '',
      registrationDate:
        pakistanDate(member.registrationDate) || pakistanDate(),
      notes: member.notes || '',
    });

    setFieldErrors({});
    setFormError('');
    setSuccess('');
    setModalOpen(true);
  }

  function closeModal() {
    if (savingRef.current) return;
    setModalOpen(false);
  }

  function handleDialogClose() {
    setModalOpen(false);

    if (openerRef.current?.isConnected) {
      openerRef.current.focus();
    }
  }

  function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) return;

    const rect = event.currentTarget.getBoundingClientRect();

    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (outside) closeModal();
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: '',
    }));
  }

  // ─────────────────────────────────────────────
  // Create / Update
  // ─────────────────────────────────────────────

  async function handleSubmit(event) {
    event.preventDefault();

    if (savingRef.current) return;

    const errors = validateForm(form);

    setFieldErrors(errors);
    setFormError('');

    if (Object.keys(errors).length > 0) {
      const firstField = Object.keys(errors)[0];

      formRef.current?.elements
        .namedItem(firstField)
        ?.focus();

      return;
    }

    savingRef.current = true;
    setSaving(true);

    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      registrationDate: form.registrationDate,
      notes: form.notes.trim(),
    };

    const isEditing = Boolean(editingMember);

    try {
      if (isEditing) {
        await memberService.updateMember(
          editingMember._id,
          payload
        );
      } else {
        await memberService.createMember(payload);
      }
    } catch (error) {
      if (mountedRef.current) {
        const uncertainOutcome =
          !error.response ||
          error.response.status >= 500;

        setFormError(
          uncertainOutcome
            ? 'Save could not be confirmed. Close this form and refresh the list before retrying, to avoid duplicate records.'
            : errorMessage(error)
        );

        setSaving(false);
      }

      savingRef.current = false;
      return;
    }

    savingRef.current = false;

    if (!mountedRef.current) return;

    setSaving(false);
    setModalOpen(false);

    setSuccess(
      isEditing
        ? 'Member details updated successfully.'
        : 'New member registered successfully.'
    );

    if (!isEditing) {
      setSearchQuery('');
      setPage(1);
    }

    await loadMembers();
  }

  function fieldProps(name) {
    return {
      id: `member-${name}`,
      name,
      value: form[name],
      onChange: updateField,
      className: inputClass(Boolean(fieldErrors[name])),
      'aria-invalid': Boolean(fieldErrors[name]),
      'aria-describedby': fieldErrors[name]
        ? `member-${name}-error`
        : undefined,
    };
  }

  function renderFieldError(name) {
    if (!fieldErrors[name]) return null;

    return (
      <p
        id={`member-${name}-error`}
        className="mt-1.5 text-xs leading-relaxed text-red-300"
      >
        {fieldErrors[name]}
      </p>
    );
  }

  return (
    <section
      className="min-w-0 space-y-5 text-zinc-100"
      aria-label="Members management"
    >
      {/* Page toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300">
            <Users size={23} aria-hidden="true" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-white">
                Member directory
              </h2>

              <span
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-zinc-300"
                aria-label={`${members.length} loaded members`}
              >
                {loading && members.length === 0
                  ? '…'
                  : members.length}
              </span>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Your people. Their details. One place.
            </p>
          </div>
        </div>

        <button
          type="button"
          className={primaryButtonClass}
          onClick={openCreate}
        >
          <UserPlus size={18} aria-hidden="true" />
          Add member
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-lime-300/20 bg-lime-300/5 px-4 py-3 text-sm text-lime-200"
        >
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <p className="flex-1 leading-relaxed">{success}</p>

          <button
            type="button"
            onClick={() => setSuccess('')}
            aria-label="Dismiss success message"
            className={`rounded-lg p-1 text-lime-200/70 hover:text-lime-100 ${focusClass}`}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Fetch error */}
      {listError && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Could not refresh members.
            </p>

            <p className="mt-1 text-xs leading-relaxed text-red-200/80">
              {listError}
            </p>

            {members.length > 0 && (
              <p className="mt-1 text-xs text-red-200/70">
                Previously loaded records are shown below.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={loadMembers}
            disabled={loading}
            className={`rounded-lg px-2 py-1 text-xs font-semibold underline disabled:opacity-40 ${focusClass}`}
          >
            Retry
          </button>
        </div>
      )}

      {/* Directory card */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#14191e]">
        {/* Search and refresh */}
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full sm:max-w-md">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              aria-label="Search members by name, phone or ID"
              placeholder="Search name, phone or member ID..."
              className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d1217] py-3 pl-10 pr-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/10"
            />
          </div>

          <button
            type="button"
            onClick={loadMembers}
            disabled={loading}
            className={`${secondaryButtonClass} shrink-0`}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={
                loading
                  ? 'animate-spin motion-reduce:animate-none'
                  : ''
              }
            />

            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Table */}
        <div
          className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-300"
          role="region"
          aria-label="Members table"
          tabIndex={0}
          aria-busy={loading}
        >
          <table className="w-full min-w-[820px] border-collapse text-left">
            <caption className="sr-only">
              Member directory with contact information,
              registration dates and edit actions
            </caption>

            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                {[
                  'Member',
                  'Phone number',
                  'Registration',
                  'Address & notes',
                  'Action',
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className={`px-5 py-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 ${
                      heading === 'Action' ? 'text-right' : ''
                    }`}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {loading && members.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div
                      role="status"
                      className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"
                    >
                      <Loader2
                        size={30}
                        className="animate-spin text-lime-300 motion-reduce:animate-none"
                        aria-hidden="true"
                      />

                      <h3 className="mt-4 text-base font-semibold text-white">
                        Loading your members
                      </h3>

                      <p className="mt-2 text-sm text-zinc-500">
                        Getting the latest directory.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lime-300">
                        {listError ? (
                          <AlertCircle
                            size={28}
                            aria-hidden="true"
                          />
                        ) : (
                          <Users
                            size={28}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <h3 className="mt-5 text-base font-semibold text-white">
                        {listError
                          ? 'Member list unavailable'
                          : searchQuery.trim()
                            ? 'No matching members'
                            : 'Your community starts here'}
                      </h3>

                      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
                        {listError
                          ? 'Retry loading the member directory.'
                          : searchQuery.trim()
                            ? 'Try a different name, phone number or member ID.'
                            : 'Add your first member and start building your gym community.'}
                      </p>

                      {!listError && (
                        <button
                          type="button"
                          className={`${secondaryButtonClass} mt-5`}
                          onClick={
                            searchQuery.trim()
                              ? () => {
                                  setSearchQuery('');
                                  setPage(1);
                                }
                              : openCreate
                          }
                        >
                          {searchQuery.trim() ? (
                            <X size={16} aria-hidden="true" />
                          ) : (
                            <UserPlus
                              size={16}
                              aria-hidden="true"
                            />
                          )}

                          {searchQuery.trim()
                            ? 'Clear search'
                            : 'Add first member'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visibleMembers.map((member) => (
                  <tr
                    key={member._id}
                    className="transition-colors hover:bg-white/[0.025]"
                  >
                    {/* Member */}
                    <td className="px-5 py-5 align-top">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-300/15 bg-lime-300/10 text-xs font-bold text-lime-300">
                          {initials(member.fullName)}
                        </div>

                        <div className="min-w-0 max-w-[225px]">
                          <p className="break-words text-sm font-semibold text-zinc-100">
                            {member.fullName}
                          </p>

                          <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-zinc-500">
                            {member.memberId || '—'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-5 align-top">
                      <div className="flex items-center gap-2 pt-1 text-xs text-zinc-300">
                        <Phone
                          size={14}
                          className="shrink-0 text-zinc-600"
                          aria-hidden="true"
                        />

                        <span className="whitespace-nowrap tabular-nums">
                          {member.phone || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Registration */}
                    <td className="px-5 py-5 align-top">
                      <div className="flex items-center gap-2 pt-1 text-xs text-zinc-400">
                        <CalendarDays
                          size={14}
                          className="shrink-0 text-zinc-600"
                          aria-hidden="true"
                        />

                        <span className="whitespace-nowrap">
                          {displayDate(member.registrationDate)}
                        </span>
                      </div>
                    </td>

                    {/* Address and notes */}
                    <td className="px-5 py-5 align-top">
                      <div className="max-w-[240px]">
                        <div className="flex items-start gap-2 pt-1">
                          <MapPin
                            size={14}
                            className="mt-0.5 shrink-0 text-zinc-600"
                            aria-hidden="true"
                          />

                          <p className="break-words text-xs leading-relaxed text-zinc-400">
                            {member.address || 'No address added'}
                          </p>
                        </div>

                        {member.notes && (
                          <details className="mt-3">
                            <summary className="w-fit cursor-pointer rounded text-xs font-medium text-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300">
                              View notes
                            </summary>

                            <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-[#0d1217] p-3 text-xs leading-relaxed text-zinc-400">
                              {member.notes}
                            </p>
                          </details>
                        )}
                      </div>
                    </td>

                    {/* Edit */}
                    <td className="px-5 py-5 text-right align-top">
                      <button
                        type="button"
                        onClick={() => openEdit(member)}
                        aria-label={`Edit ${member.fullName}`}
                        className={`inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-lime-300/30 hover:bg-lime-300/5 hover:text-lime-300 ${focusClass}`}
                      >
                        <Pencil size={13} aria-hidden="true" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="text-xs text-zinc-500"
            aria-live="polite"
          >
            {filteredMembers.length > 0 ? (
              <>
                Showing{' '}
                <span className="font-medium text-zinc-300">
                  {startIndex + 1}–
                  {Math.min(
                    startIndex + PAGE_SIZE,
                    filteredMembers.length
                  )}
                </span>{' '}
                of{' '}
                <span className="font-medium text-zinc-300">
                  {filteredMembers.length}
                </span>{' '}
                members
              </>
            ) : (
              '0 members shown'
            )}
          </p>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              aria-label="Previous page"
              className={`${secondaryButtonClass} min-h-9 px-3 py-2 text-xs`}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Previous
            </button>

            <span className="whitespace-nowrap text-xs tabular-nums text-zinc-400">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              aria-label="Next page"
              className={`${secondaryButtonClass} min-h-9 px-3 py-2 text-xs`}
            >
              Next
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit member modal */}
      <dialog
        ref={dialogRef}
        aria-labelledby="member-modal-title"
        aria-describedby="member-modal-description"
        onClick={handleBackdropClick}
        onClose={handleDialogClose}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#14191e] p-0 text-zinc-100 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-lime-300/[0.03] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300 sm:flex">
              {editingMember ? (
                <Pencil size={23} aria-hidden="true" />
              ) : (
                <UserPlus size={24} aria-hidden="true" />
              )}
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-lime-300">
                Member profile
              </p>

              <h2
                id="member-modal-title"
                className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl"
              >
                {editingMember
                  ? 'Edit member'
                  : 'Welcome someone new.'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            aria-label="Close member form"
            className={iconButtonClass}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          aria-busy={saving}
        >
          <div className="space-y-6 px-5 py-6 sm:px-7">
            <p
              id="member-modal-description"
              className="text-sm leading-relaxed text-zinc-400"
            >
              {editingMember
                ? 'Keep their profile and contact information up to date.'
                : 'Add their details below. You can assign a subscription afterwards.'}
            </p>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/5 p-3.5 text-xs leading-relaxed text-red-200"
              >
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <p>{formError}</p>
              </div>
            )}

            <fieldset
              disabled={saving}
              className="m-0 grid min-w-0 grid-cols-1 gap-5 border-0 p-0 sm:grid-cols-2"
            >
              <legend className="sr-only">
                Member information
              </legend>

              {/* Full name */}
              <div className="min-w-0">
                <label
                  htmlFor="member-fullName"
                  className="mb-2 block text-xs font-semibold text-zinc-300"
                >
                  Full name{' '}
                  <span className="text-lime-300">*</span>
                </label>

                <input
                  {...fieldProps('fullName')}
                  ref={nameInputRef}
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Ali Khan"
                  maxLength={120}
                  required
                />

                {renderFieldError('fullName')}
              </div>

              {/* Phone */}
              <div className="min-w-0">
                <label
                  htmlFor="member-phone"
                  className="mb-2 block text-xs font-semibold text-zinc-300"
                >
                  Phone number{' '}
                  <span className="text-lime-300">*</span>
                </label>

                <input
                  {...fieldProps('phone')}
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. 03001234567"
                  maxLength={30}
                  required
                />

                {renderFieldError('phone')}
              </div>

              {/* Registration date */}
              <div className="min-w-0">
                <label
                  htmlFor="member-registrationDate"
                  className="mb-2 block text-xs font-semibold text-zinc-300"
                >
                  Registration date{' '}
                  <span className="text-lime-300">*</span>
                </label>

                <input
                  {...fieldProps('registrationDate')}
                  type="date"
                  className={`${inputClass(
                    Boolean(fieldErrors.registrationDate)
                  )} [color-scheme:dark]`}
                  required
                />

                {renderFieldError('registrationDate')}
              </div>

              {/* Address */}
              <div className="min-w-0">
                <label
                  htmlFor="member-address"
                  className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-zinc-300"
                >
                  Address
                  <span className="text-[10px] font-normal text-zinc-500">
                    Optional
                  </span>
                </label>

                <input
                  {...fieldProps('address')}
                  type="text"
                  autoComplete="street-address"
                  placeholder="House, street and city"
                  maxLength={500}
                />

                {renderFieldError('address')}
              </div>

              {/* Notes */}
              <div className="min-w-0 sm:col-span-2">
                <label
                  htmlFor="member-notes"
                  className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-zinc-300"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FileText
                      size={13}
                      className="text-zinc-500"
                      aria-hidden="true"
                    />
                    Member notes
                  </span>

                  <span className="text-[10px] font-normal text-zinc-500">
                    Optional
                  </span>
                </label>

                <textarea
                  {...fieldProps('notes')}
                  placeholder="Useful information about this member..."
                  rows={4}
                  maxLength={2000}
                  className={`${inputClass(
                    Boolean(fieldErrors.notes)
                  )} min-h-28 resize-y`}
                />

                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <div>{renderFieldError('notes')}</div>

                  <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                    {form.notes.length}/2000
                  </span>
                </div>
              </div>
            </fieldset>

            {!editingMember && (
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-3.5">
                <ArrowUpRight
                  size={17}
                  className="mt-0.5 shrink-0 text-lime-300"
                  aria-hidden="true"
                />

                <p className="text-xs leading-relaxed text-zinc-400">
                  A member ID will be generated automatically.
                  Membership plans and billing are managed from
                  Subscriptions.
                </p>
              </div>
            )}
          </div>

          {/* Modal footer */}
          <div className="flex flex-col gap-4 border-t border-white/10 bg-[#10151a] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-[11px] text-zinc-500">
              <span className="text-lime-300">*</span>{' '}
              Required fields
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className={`${secondaryButtonClass} flex-1 sm:flex-none`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className={`${primaryButtonClass} flex-1 sm:flex-none`}
              >
                {saving ? (
                  <Loader2
                    size={17}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : editingMember ? (
                  <Save size={17} aria-hidden="true" />
                ) : (
                  <UserPlus size={17} aria-hidden="true" />
                )}

                {saving
                  ? 'Saving...'
                  : editingMember
                    ? 'Save changes'
                    : 'Register member'}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </section>
  );
}

export default Members;