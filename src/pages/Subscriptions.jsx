import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  CalendarDays,
  CalendarClock,
  Plus,
  Search,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Users,
  Dumbbell,
  Ban,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from 'lucide-react';

import subscriptionService from '../services/subscriptionService';
import memberService from '../services/memberService';
import serviceService from '../services/serviceService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const PAGE_SIZE = 10;

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

function nextMonthStart(dateText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return '';

  const [year, month] = dateText.split('-').map(Number);

  if (month < 1 || month > 12) return '';

  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const getId = (value) =>
  typeof value === 'object' && value !== null
    ? value._id
    : value;

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'Something went wrong. Please try again.';

const emptyForm = () => ({
  memberId: '',
  serviceId: '',
  fee: '',
  startDate: pakistanDate(),
});

function subscriptionStatus(subscription, today) {
  if (subscription.status !== 'active') {
    return subscription.status || 'unknown';
  }

  return pakistanDate(subscription.startDate) > today
    ? 'scheduled'
    : 'active';
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

// ─────────────────────────────────────────────
// Tailwind styles
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
    'disabled:opacity-60 focus:ring-2 [color-scheme:dark] ' +
    (hasError
      ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/10'
      : 'border-white/10 focus:border-lime-300/60 focus:ring-lime-300/10')
  );
}

const statusStyles = {
  active: 'border-lime-300/20 bg-lime-300/10 text-lime-300',
  scheduled: 'border-sky-300/20 bg-sky-300/10 text-sky-300',
  cancelled: 'border-red-300/20 bg-red-300/5 text-red-300',
  expired: 'border-amber-300/20 bg-amber-300/10 text-amber-300',
  unknown: 'border-white/10 bg-white/5 text-zinc-400',
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [members, setMembers] = useState([]);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [today, setToday] = useState(pakistanDate);

  // modal: null | 'assign' | 'cancel'
  const [modal, setModal] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const memberSelectRef = useRef(null);
  const keepSubscriptionRef = useRef(null);
  const openerRef = useRef(null);

  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const savingRef = useRef(false);

  // ─────────────────────────────────────────────
  // Fetch through service files
  // ─────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const requestId = ++requestRef.current;

    setLoading(true);
    setLoadError('');

    try {
      const [subscriptionRows, memberRows, serviceRows] =
        await Promise.all([
          subscriptionService.getSubscriptions(),
          memberService.getMembers(),
          serviceService.getServices(),
        ]);

      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setSubscriptions(subscriptionRows);
        setMembers(memberRows);
        setServices(serviceRows);
        setDataReady(true);
        setToday(pakistanDate());
      }
    } catch (error) {
      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setLoadError(errorMessage(error));
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
    loadData();

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(pakistanDate());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  // ─────────────────────────────────────────────
  // Modal lifecycle
  // ─────────────────────────────────────────────

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (modal && !dialog.open) {
      dialog.showModal();

      if (modal === 'assign') {
        memberSelectRef.current?.focus();
      } else {
        keepSubscriptionRef.current?.focus();
      }
    } else if (!modal && dialog.open) {
      dialog.close();
    }
  }, [modal]);

  useEffect(() => {
    if (!modal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modal]);

  // ─────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────

  const activeServices = useMemo(
    () => services.filter((service) => service.isActive !== false),
    [services]
  );

  const selectedMember = members.find(
    (member) => member._id === form.memberId
  );

  const selectedService = activeServices.find(
    (service) => service._id === form.serviceId
  );

  const duplicateSubscription = subscriptions.some(
    (subscription) =>
      subscription.status === 'active' &&
      String(getId(subscription.memberId)) === form.memberId &&
      String(getId(subscription.serviceId)) === form.serviceId
  );

  const filteredSubscriptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return subscriptions.filter((subscription) => {
      const status = subscriptionStatus(subscription, today);

      const matchesStatus =
        statusFilter === 'all' || status === statusFilter;

      const matchesSearch =
        !query ||
        [
          subscription.memberId?.fullName,
          subscription.memberId?.memberId,
          subscription.memberId?.phone,
          subscription.serviceId?.name,
        ].some((value) =>
          String(value || '').toLowerCase().includes(query)
        );

      return matchesStatus && matchesSearch;
    });
  }, [subscriptions, searchQuery, statusFilter, today]);

  const counts = useMemo(() => {
    const result = {
      all: subscriptions.length,
      active: 0,
      scheduled: 0,
      cancelled: 0,
      expired: 0,
    };

    subscriptions.forEach((subscription) => {
      const status = subscriptionStatus(subscription, today);

      if (Object.prototype.hasOwnProperty.call(result, status)) {
        result[status] += 1;
      }
    });

    return result;
  }, [subscriptions, today]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSubscriptions.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const visibleSubscriptions = filteredSubscriptions.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const hasFilters =
    Boolean(searchQuery.trim()) || statusFilter !== 'all';

  const futureStart = form.startDate > today;
  const nextMonthDate = nextMonthStart(form.startDate);

  // ─────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setPage(1);
  }

  function openAssign() {
    openerRef.current = document.activeElement;

    setForm(emptyForm());
    setFieldErrors({});
    setFormError('');
    setSuccess('');
    setModal('assign');
  }

  function openCancel(subscription) {
    openerRef.current = document.activeElement;

    setCancelTarget(subscription);
    setFormError('');
    setSuccess('');
    setModal('cancel');
  }

  function closeModal() {
    if (savingRef.current) return;
    setModal(null);
  }

  function handleDialogClose() {
    setModal(null);

    if (openerRef.current?.isConnected) {
      openerRef.current.focus();
    }
  }

  function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) return;

    const rect = event.currentTarget.getBoundingClientRect();

    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      closeModal();
    }
  }

  function updateField(event) {
    const { name, value } = event.target;

    if (name === 'serviceId') {
      const service = activeServices.find(
        (item) => item._id === value
      );

      setForm((previous) => ({
        ...previous,
        serviceId: value,
        fee: service ? String(service.fee) : '',
      }));

      setFieldErrors((previous) => ({
        ...previous,
        serviceId: '',
        fee: '',
      }));

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: '',
      ...(name === 'memberId' ? { serviceId: '' } : {}),
    }));
  }

  function validateForm() {
    const errors = {};

    if (!members.some((member) => member._id === form.memberId)) {
      errors.memberId = 'Select a member.';
    }

    if (
      !activeServices.some((service) => service._id === form.serviceId)
    ) {
      errors.serviceId = 'Select an active service.';
    } else if (duplicateSubscription) {
      errors.serviceId =
        'This member already has an active or scheduled subscription for this service.';
    }

    const feeText = String(form.fee).trim();
    const fee = Number(feeText);

    if (!feeText || !Number.isFinite(fee) || fee <= 0) {
      errors.fee = 'Enter a fee greater than zero.';
    } else if (fee > 1_000_000_000) {
      errors.fee = 'Fee must not exceed 1,000,000,000.';
    } else if (
      Math.abs(fee * 100 - Math.round(fee * 100)) > 0.00001
    ) {
      errors.fee = 'Use a maximum of two decimal places.';
    }

    const date = new Date(
      `${form.startDate}T00:00:00+05:00`
    );

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(form.startDate) ||
      Number.isNaN(date.getTime()) ||
      pakistanDate(date) !== form.startDate
    ) {
      errors.startDate = 'Select a valid start date.';
    } else if (
      form.startDate < `${pakistanDate().slice(0, 7)}-01`
    ) {
      errors.startDate =
        'Start date cannot be before the current month.';
    }

    return errors;
  }

  async function handleAssign(event) {
    event.preventDefault();

    if (savingRef.current) return;

    const errors = validateForm();

    setFieldErrors(errors);
    setFormError('');

    if (Object.keys(errors).length) {
      formRef.current?.elements
        .namedItem(Object.keys(errors)[0])
        ?.focus();

      return;
    }

    savingRef.current = true;
    setSaving(true);

    let result;

    try {
      result = await subscriptionService.createSubscription({
        memberId: form.memberId,
        serviceId: form.serviceId,
        fee: Math.round(Number(form.fee) * 100) / 100,
        billingMethod: 'calendar-month',
        startDate: form.startDate,
      });
    } catch (error) {
      if (mountedRef.current) {
        const uncertainOutcome =
          !error.response || error.response.status >= 500;

        setFormError(
          uncertainOutcome
            ? 'Assignment could not be confirmed. Close this form and refresh the list before retrying.'
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
    setModal(null);
    clearFilters();

    setSuccess(
      result?.invoice
        ? 'Subscription assigned and the first invoice generated.'
        : 'Subscription scheduled. Its first invoice will be generated when the start date is reached.'
    );

    await loadData();
  }

  async function handleCancel() {
    if (savingRef.current || !cancelTarget?._id) return;

    savingRef.current = true;
    setSaving(true);
    setFormError('');

    try {
      await subscriptionService.cancelSubscription(cancelTarget._id);
    } catch (error) {
      if (mountedRef.current) {
        setFormError(
          !error.response || error.response.status >= 500
            ? 'Cancellation could not be confirmed. Close this dialog and refresh the list to check its status.'
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
    setModal(null);

    setSuccess(
      'Subscription cancelled. Existing invoices and outstanding balances remain payable.'
    );

    await loadData();
  }

  function fieldProps(name) {
    return {
      id: `subscription-${name}`,
      name,
      value: form[name],
      onChange: updateField,
      className: inputClass(Boolean(fieldErrors[name])),
      'aria-invalid': Boolean(fieldErrors[name]),
      'aria-describedby': fieldErrors[name]
        ? `subscription-${name}-error`
        : undefined,
    };
  }

  function renderFieldError(name) {
    return fieldErrors[name] ? (
      <p
        id={`subscription-${name}-error`}
        className="mt-1.5 text-xs leading-relaxed text-red-300"
      >
        {fieldErrors[name]}
      </p>
    ) : null;
  }

  return (
    <section
      className="min-w-0 space-y-5 text-zinc-100"
      aria-label="Subscriptions management"
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300">
            <CalendarDays size={24} aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Membership plans
            </h2>

            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Assign services. Keep monthly billing organized.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openAssign}
          disabled={!dataReady || loading || Boolean(loadError)}
          className={primaryButtonClass}
        >
          <Plus size={18} aria-hidden="true" />
          Assign subscription
        </button>
      </div>

      {/* Messages */}
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
            className={`rounded-lg p-1 ${focusClass}`}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">Could not refresh data.</p>
            <p className="mt-1 text-xs leading-relaxed">{loadError}</p>

            {dataReady && (
              <p className="mt-1 text-xs text-red-200/70">
                Previously loaded records are shown below.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={loadData}
            className={`rounded-lg px-2 py-1 text-xs font-semibold underline disabled:opacity-40 ${focusClass}`}
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Active now',
            value: counts.active,
            icon: CheckCircle2,
            color: 'text-lime-300 bg-lime-300/10 border-lime-300/20',
          },
          {
            label: 'Scheduled',
            value: counts.scheduled,
            icon: CalendarClock,
            color: 'text-sky-300 bg-sky-300/10 border-sky-300/20',
          },
          {
            label: 'Total subscriptions',
            value: counts.all,
            icon: Users,
            color: 'text-zinc-300 bg-white/5 border-white/10',
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#14191e] p-5"
            >
              <div>
                <p className="text-xs text-zinc-400">{item.label}</p>

                <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                  {dataReady ? item.value : '—'}
                </p>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl border ${item.color}`}
              >
                <Icon size={21} aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Directory */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#14191e]">
        <div className="space-y-4 border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                aria-label="Search member, phone, member ID or service"
                placeholder="Search member, phone or service..."
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d1217] py-3 pl-10 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/10"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className={secondaryButtonClass}
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

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Subscription status filter"
          >
            {[
              ['all', 'All'],
              ['active', 'Active'],
              ['scheduled', 'Scheduled'],
              ['cancelled', 'Cancelled'],
              ['expired', 'Expired'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={statusFilter === value}
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${focusClass} ${
                  statusFilter === value
                    ? 'border-lime-300/25 bg-lime-300/10 text-lime-300'
                    : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                }`}
              >
                {label}
                <span className="ml-1.5 opacity-60">
                  {dataReady ? counts[value] : '—'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          role="region"
          aria-label="Subscriptions table"
          aria-busy={loading}
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-300"
        >
          <table className="w-full min-w-[980px] border-collapse text-left">
            <caption className="sr-only">
              Member subscriptions, monthly fees and next invoice dates
            </caption>

            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                {[
                  'Member',
                  'Service',
                  'Monthly fee',
                  'Start date',
                  'Next invoice',
                  'Status',
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
              {loading && !dataReady ? (
                <tr>
                  <td colSpan={7}>
                    <div
                      role="status"
                      className="flex min-h-64 flex-col items-center justify-center p-8 text-center"
                    >
                      <Loader2
                        size={30}
                        className="animate-spin text-lime-300 motion-reduce:animate-none"
                        aria-hidden="true"
                      />

                      <p className="mt-4 text-sm text-zinc-300">
                        Loading subscriptions...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lime-300">
                        <CalendarDays size={28} aria-hidden="true" />
                      </div>

                      <h3 className="mt-5 text-base font-semibold text-white">
                        {loadError
                          ? 'Subscriptions unavailable'
                          : hasFilters
                            ? 'No matching subscriptions'
                            : 'Start a member’s next chapter'}
                      </h3>

                      <p className="mt-2 text-sm text-zinc-400">
                        {loadError
                          ? 'Refresh to load the latest records.'
                          : hasFilters
                            ? 'Try another search or status filter.'
                            : 'Assign a service to begin their monthly billing.'}
                      </p>

                      {!loadError && (
                        <button
                          type="button"
                          onClick={hasFilters ? clearFilters : openAssign}
                          className={`${secondaryButtonClass} mt-5`}
                        >
                          {hasFilters ? 'Clear filters' : 'Assign subscription'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visibleSubscriptions.map((subscription) => {
                  const status = subscriptionStatus(subscription, today);
                  const member = subscription.memberId;
                  const active = subscription.status === 'active';

                  return (
                    <tr
                      key={subscription._id}
                      className="transition-colors hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-5 align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-300/15 bg-lime-300/10 text-xs font-bold text-lime-300">
                            {initials(member?.fullName)}
                          </div>

                          <div className="max-w-[220px]">
                            <p className="break-words text-sm font-semibold text-zinc-100">
                              {member?.fullName || 'Member unavailable'}
                            </p>

                            <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-zinc-500">
                              {member?.memberId || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <p className="max-w-[180px] break-words text-sm text-zinc-300">
                          {subscription.serviceId?.name || 'Service unavailable'}
                        </p>

                        <p className="mt-1 text-[10px] text-zinc-500">
                          Calendar month
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 align-top">
                        <span className="text-xs text-zinc-500">PKR </span>

                        <span className="text-sm font-bold tabular-nums text-lime-300">
                          {formatMoney(subscription.fee)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-xs text-zinc-400 align-top">
                        {displayDate(subscription.startDate)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-xs align-top">
                        <span className={active ? 'text-zinc-200' : 'text-zinc-600'}>
                          {active
                            ? displayDate(subscription.nextBillingDate)
                            : '—'}
                        </span>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${
                            statusStyles[status] || statusStyles.unknown
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-5 py-5 text-right align-top">
                        {active ? (
                          <button
                            type="button"
                            onClick={() => openCancel(subscription)}
                            disabled={loading || Boolean(loadError)}
                            aria-label={`Cancel ${member?.fullName || 'member'} subscription`}
                            className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:border-red-400/30 hover:bg-red-400/5 hover:text-red-300 disabled:opacity-40 ${focusClass}`}
                          >
                            <Ban size={13} aria-hidden="true" />
                            Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500" aria-live="polite">
            {filteredSubscriptions.length
              ? `Showing ${startIndex + 1}–${Math.min(
                  startIndex + PAGE_SIZE,
                  filteredSubscriptions.length
                )} of ${filteredSubscriptions.length} subscriptions`
              : '0 subscriptions shown'}
          </p>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className={secondaryButtonClass}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Previous
            </button>

            <span className="whitespace-nowrap text-xs text-zinc-400">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className={secondaryButtonClass}
            >
              Next
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <Info
          size={18}
          className="mt-0.5 shrink-0 text-lime-300"
          aria-hidden="true"
        />

        <p className="text-xs leading-relaxed text-zinc-400">
          Next invoice is the next billing date, not a payment deadline.
          Full and partial payments are managed from Payments & Invoices.
        </p>
      </div>

      {/* Shared dialog */}
      <dialog
        ref={dialogRef}
        aria-labelledby="subscription-modal-title"
        aria-describedby="subscription-modal-description"
        onClose={handleDialogClose}
        onClick={handleBackdropClick}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#14191e] p-0 text-zinc-100 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div
              className={`hidden h-12 w-12 items-center justify-center rounded-2xl border sm:flex ${
                modal === 'cancel'
                  ? 'border-red-300/20 bg-red-300/10 text-red-300'
                  : 'border-lime-300/20 bg-lime-300/10 text-lime-300'
              }`}
            >
              {modal === 'cancel' ? (
                <Ban size={23} aria-hidden="true" />
              ) : (
                <CalendarDays size={23} aria-hidden="true" />
              )}
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                Membership management
              </p>

              <h2
                id="subscription-modal-title"
                className="mt-1.5 text-xl font-bold text-white"
              >
                {modal === 'cancel'
                  ? 'Cancel subscription?'
                  : 'Assign a subscription'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            aria-label="Close dialog"
            className={iconButtonClass}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        {modal === 'cancel' ? (
          <div className="space-y-5 p-5 sm:p-7">
            <p
              id="subscription-modal-description"
              className="text-sm leading-relaxed text-zinc-400"
            >
              Stop future billing for{' '}
              <strong className="text-white">
                {cancelTarget?.memberId?.fullName || 'this member'}
              </strong>
              ’s{' '}
              <strong className="text-white">
                {cancelTarget?.serviceId?.name || 'selected service'}
              </strong>
              {' '}subscription.
            </p>

            <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-7 text-amber-100">
              Already-started billing periods remain chargeable.
              Existing invoices and unpaid balances will remain.
              To rejoin later, create a new subscription.
            </div>

            {formError && (
              <p role="alert" className="text-sm leading-relaxed text-red-300">
                {formError}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                ref={keepSubscriptionRef}
                type="button"
                onClick={closeModal}
                disabled={saving}
                className={secondaryButtonClass}
              >
                Keep subscription
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-red-300 disabled:opacity-50 ${focusClass}`}
              >
                {saving ? (
                  <Loader2
                    size={17}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Ban size={17} aria-hidden="true" />
                )}

                {saving ? 'Cancelling...' : 'Cancel subscription'}
              </button>
            </div>
          </div>
        ) : (
          <form
            ref={formRef}
            onSubmit={handleAssign}
            noValidate
            aria-busy={saving}
          >
            <div className="space-y-5 p-5 sm:p-7">
              <p
                id="subscription-modal-description"
                className="text-sm leading-relaxed text-zinc-400"
              >
                Choose a member and service, then confirm their
                agreed monthly fee.
              </p>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-300/20 bg-red-300/5 p-3.5 text-xs leading-relaxed text-red-200"
                >
                  {formError}
                </div>
              )}

              {(!members.length || !activeServices.length) && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3.5 text-xs leading-relaxed text-amber-200">
                  {!members.length
                    ? 'Create a member on the Members page first. '
                    : ''}
                  {!activeServices.length
                    ? 'Create or activate a service on the Services page first.'
                    : ''}
                </div>
              )}

              <fieldset
                disabled={saving}
                className="m-0 grid min-w-0 grid-cols-1 gap-5 border-0 p-0 sm:grid-cols-2"
              >
                <legend className="sr-only">
                  Subscription details
                </legend>

                {/* Member */}
                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="subscription-memberId"
                    className="mb-2 block text-xs font-semibold text-zinc-300"
                  >
                    Member <span className="text-lime-300">*</span>
                  </label>

                  <select
                    {...fieldProps('memberId')}
                    ref={memberSelectRef}
                    required
                  >
                    <option value="">Choose a member</option>

                    {members.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.fullName} — {member.phone} — {member.memberId}
                      </option>
                    ))}
                  </select>

                  {renderFieldError('memberId')}
                </div>

                {/* Service */}
                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="subscription-serviceId"
                    className="mb-2 block text-xs font-semibold text-zinc-300"
                  >
                    Service <span className="text-lime-300">*</span>
                  </label>

                  <select {...fieldProps('serviceId')} required>
                    <option value="">Choose an active service</option>

                    {activeServices.map((service) => (
                      <option key={service._id} value={service._id}>
                        {service.name} — PKR {formatMoney(service.fee)} / month
                      </option>
                    ))}
                  </select>

                  {renderFieldError('serviceId')}

                  {duplicateSubscription && !fieldErrors.serviceId && (
                    <p className="mt-2 text-xs text-amber-300">
                      This member already has this service assigned.
                    </p>
                  )}
                </div>

                {/* Fee */}
                <div className="min-w-0">
                  <label
                    htmlFor="subscription-fee"
                    className="mb-2 block text-xs font-semibold text-zinc-300"
                  >
                    Agreed monthly fee (PKR){' '}
                    <span className="text-lime-300">*</span>
                  </label>

                  <input
                    {...fieldProps('fee')}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="1000000000"
                    step="0.01"
                    placeholder="3000"
                    required
                  />

                  {renderFieldError('fee')}

                  <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                    Auto-filled from the service. Adjust if agreed with the member.
                  </p>
                </div>

                {/* Start date */}
                <div className="min-w-0">
                  <label
                    htmlFor="subscription-startDate"
                    className="mb-2 block text-xs font-semibold text-zinc-300"
                  >
                    Start date <span className="text-lime-300">*</span>
                  </label>

                  <input
                    {...fieldProps('startDate')}
                    type="date"
                    min={`${today.slice(0, 7)}-01`}
                    required
                  />

                  {renderFieldError('startDate')}
                </div>
              </fieldset>

              {/* Billing preview */}
              <div className="rounded-xl border border-lime-300/15 bg-lime-300/5 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-lime-300">
                  <Receipt size={16} aria-hidden="true" />
                  Calendar-month billing
                </div>

                {selectedMember && selectedService && (
                  <p className="mt-3 break-words text-sm text-zinc-200">
                    {selectedMember.fullName}
                    <span className="mx-2 text-zinc-600">/</span>
                    {selectedService.name}
                  </p>
                )}

                <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-400">
                  <p>
                    {futureStart
                      ? `First invoice scheduled for ${displayDate(
                          `${form.startDate}T00:00:00+05:00`
                        )}.`
                      : 'The first invoice is generated when this subscription is saved.'}
                  </p>

                  {nextMonthDate && (
                    <p>
                      Following invoice:{' '}
                      <span className="text-zinc-200">
                        {displayDate(
                          `${nextMonthDate}T00:00:00+05:00`
                        )}
                      </span>
                      . Then on the 1st of each month.
                    </p>
                  )}

                  <p>
                    The full monthly fee applies to the joining month.
                    There is no automatic proration.
                  </p>

                  <p>
                    Creating an invoice does not record a payment.
                    Collect payment from Payments & Invoices.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-4 border-t border-white/10 bg-[#10151a] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <span className="text-[11px] text-zinc-500">
                <span className="text-lime-300">*</span> Required fields
              </span>

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
                  disabled={
                    saving ||
                    !members.length ||
                    !activeServices.length ||
                    duplicateSubscription
                  }
                  className={`${primaryButtonClass} flex-1 sm:flex-none`}
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus size={17} aria-hidden="true" />
                  )}

                  {saving
                    ? 'Assigning...'
                    : futureStart
                      ? 'Schedule subscription'
                      : 'Assign subscription'}
                </button>
              </div>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}

export default Subscriptions;