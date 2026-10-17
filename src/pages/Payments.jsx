import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Receipt,
  Search,
  RefreshCw,
  Wallet,
  History,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarDays,
  CreditCard,
  Info,
} from 'lucide-react';

import paymentService from '../services/paymentService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const PAGE_SIZE = 10;

function currentMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get('year')}-${get('month')}`;
}

function displayDate(value, includeTime = false) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime
      ? { hour: '2-digit', minute: '2-digit' }
      : {}),
  }).format(date);
}

const cents = (value) => Math.round(Number(value || 0) * 100);

const sum = (rows, field) =>
  rows.reduce((total, row) => total + cents(row[field]), 0) / 100;

const money = (value) =>
  `PKR ${Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'Something went wrong. Please try again.';

const memberOf = (invoice) =>
  typeof invoice.memberId === 'object' && invoice.memberId
    ? invoice.memberId
    : {};

function matchesSearch(invoice, query) {
  if (!query) return true;

  const member = memberOf(invoice);

  return [
    invoice.invoiceNumber,
    member.fullName,
    member.phone,
    member.memberId,
    invoice.serviceName,
    invoice.serviceId?.name,
  ].some((value) =>
    String(value || '').toLowerCase().includes(query)
  );
}

function isOverdue(invoice) {
  return (
    cents(invoice.remainingBalance) > 0 &&
    Boolean(invoice.dueDate) &&
    new Date(invoice.dueDate).getTime() < Date.now()
  );
}

// Retain an unconfirmed request across a page reload.
// No member contact details are stored here.
const attemptKey = (id) => `gym-payment-attempt:${id}`;

function readAttempt(id) {
  const value = sessionStorage.getItem(attemptKey(id));

  if (!value) return null;

  const payload = JSON.parse(value);

  if (
    payload.paymentId !== id ||
    typeof payload.idempotencyKey !== 'string' ||
    !Number.isFinite(payload.amountPaid) ||
    payload.amountPaid <= 0 ||
    !['cash', 'bank', 'card', 'other'].includes(payload.method)
  ) {
    throw new Error('Saved payment request is invalid.');
  }

  return payload;
}

function createRequestKey() {
  const cryptoApi = window.crypto;

  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random generation is unavailable.');
  }

  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);

  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

// ─────────────────────────────────────────────
// Tailwind classes
// ─────────────────────────────────────────────

const focus =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-lime-300 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[#14191e]';

const primary =
  'inline-flex min-h-11 items-center justify-center gap-2 ' +
  'rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold ' +
  'text-zinc-950 hover:bg-lime-200 disabled:cursor-not-allowed ' +
  'disabled:opacity-40 transition ' +
  focus;

const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 ' +
  'rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 ' +
  'text-sm font-medium text-zinc-200 hover:bg-white/10 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 transition ' +
  focus;

const input =
  'min-h-11 w-full min-w-0 rounded-xl border border-white/10 ' +
  'bg-[#0d1217] px-3.5 py-3 text-sm text-zinc-100 outline-none ' +
  'placeholder:text-zinc-600 focus:border-lime-300/60 ' +
  'focus:ring-2 focus:ring-lime-300/10 disabled:opacity-60 ' +
  '[color-scheme:dark]';

function StatusBadge({ invoice }) {
  const status =
    cents(invoice.remainingBalance) === 0
      ? 'paid'
      : cents(invoice.amountPaid) > 0
        ? 'partial'
        : 'unpaid';

  const styles = {
    paid: 'border-lime-300/20 bg-lime-300/10 text-lime-300',
    partial: 'border-amber-300/20 bg-amber-300/10 text-amber-300',
    unpaid: 'border-white/10 bg-white/5 text-zinc-300',
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles[status]}`}
      >
        {status === 'unpaid'
          ? 'Pending'
          : status === 'partial'
            ? 'Partial'
            : 'Paid'}
      </span>

      {isOverdue(invoice) && (
        <span className="text-[10px] font-semibold text-red-300">
          Overdue
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

function Payments() {
  const [payments, setPayments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');

  const [month, setMonth] = useState(currentMonth);
  const [view, setView] = useState('month');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  // modal: null | 'pay' | 'history'
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [form, setForm] = useState({
    amount: '',
    method: 'cash',
    reference: '',
    note: '',
  });

  const [pendingAttempt, setPendingAttempt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const amountRef = useRef(null);
  const openerRef = useRef(null);

  const mountedRef = useRef(false);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const savingRef = useRef(false);

  // ─────────────────────────────────────────────
  // Load invoices
  // GET /payments also recovers missed invoices.
  // ─────────────────────────────────────────────

  const loadPayments = useCallback(async () => {
    const requestId = ++listRequestRef.current;

    setLoading(true);
    setLoadError('');

    try {
      const data = await paymentService.getPayments();

      if (
        mountedRef.current &&
        requestId === listRequestRef.current
      ) {
        setPayments(data);
        setLoaded(true);
      }
    } catch (error) {
      if (
        mountedRef.current &&
        requestId === listRequestRef.current
      ) {
        setLoadError(errorMessage(error));
      }
    } finally {
      if (
        mountedRef.current &&
        requestId === listRequestRef.current
      ) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadPayments();

    return () => {
      mountedRef.current = false;
      listRequestRef.current += 1;
      detailRequestRef.current += 1;
    };
  }, [loadPayments]);

  // ─────────────────────────────────────────────
  // Modal lifecycle
  // ─────────────────────────────────────────────

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (modal && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!modal && dialog.open) {
      dialog.close();
    }
  }, [modal]);

  useEffect(() => {
    if (!modal) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [modal]);

  // ─────────────────────────────────────────────
  // Filters and member-wise arrears
  // ─────────────────────────────────────────────

  const previousInvoices = useMemo(
    () =>
      payments.filter(
        (invoice) =>
          cents(invoice.remainingBalance) > 0 &&
          (
            invoice.legacy === true ||
            (
              invoice.billingMonth &&
              invoice.billingMonth < month
            )
          )
      ),
    [payments, month]
  );

  const scopedInvoices = useMemo(() => {
    if (view === 'arrears') return previousInvoices;
    if (view === 'all') return payments;

    return payments.filter(
      (invoice) => invoice.billingMonth === month
    );
  }, [payments, previousInvoices, view, month]);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return scopedInvoices.filter((invoice) => {
      if (!matchesSearch(invoice, query)) return false;

      if (status === 'pending') {
        return cents(invoice.remainingBalance) > 0;
      }

      if (status === 'paid') {
        return cents(invoice.remainingBalance) === 0;
      }

      if (status === 'partial') {
        return (
          cents(invoice.amountPaid) > 0 &&
          cents(invoice.remainingBalance) > 0
        );
      }

      if (status === 'overdue') {
        return isOverdue(invoice);
      }

      return true;
    });
  }, [scopedInvoices, search, status]);

  const arrearsGroups = useMemo(() => {
    const groups = new Map();

    for (const invoice of filteredInvoices) {
      const member = memberOf(invoice);
      const key = String(
        member._id || invoice.memberId || invoice._id
      );

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          member,
          invoices: [],
        });
      }

      groups.get(key).invoices.push(invoice);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        balance: sum(group.invoices, 'remainingBalance'),
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [filteredInvoices]);

  const rows = view === 'arrears'
    ? arrearsGroups
    : filteredInvoices;

  const totalPages = Math.max(
    1,
    Math.ceil(rows.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

  const scopeTotals = {
    charged: sum(scopedInvoices, 'amountCharged'),
    paid: sum(scopedInvoices, 'amountPaid'),
    balance: sum(scopedInvoices, 'remainingBalance'),
  };

  function changeView(value) {
    setView(value);
    setStatus('all');
    setPage(1);
  }

  // ─────────────────────────────────────────────
  // Fresh invoice data before opening payment
  // ─────────────────────────────────────────────

  async function openInvoice(invoice, type) {
    openerRef.current = document.activeElement;

    const requestId = ++detailRequestRef.current;

    setSelected(invoice);
    setModal(type);
    setDetailLoading(true);
    setDetailError('');
    setFormError('');
    setPendingAttempt(null);
    setSuccess('');

    try {
      const fresh = await paymentService.getPayment(invoice._id);

      if (
        !mountedRef.current ||
        requestId !== detailRequestRef.current
      ) {
        return;
      }

      const attempt = type === 'pay'
        ? readAttempt(invoice._id)
        : null;

      setSelected(fresh);
      setPendingAttempt(attempt);

      setForm({
        amount: attempt
          ? String(attempt.amountPaid)
          : String(fresh.remainingBalance),
        method: attempt?.method || 'cash',
        reference: attempt?.reference || '',
        note: attempt?.note || '',
      });

      setDetailLoading(false);
    } catch (error) {
      if (
        mountedRef.current &&
        requestId === detailRequestRef.current
      ) {
        setDetailLoading(false);
        setDetailError(errorMessage(error));
      }
    }
  }

  function closeModal() {
    if (savingRef.current) return;

    detailRequestRef.current += 1;
    setModal(null);
  }

  function handleDialogClose() {
    detailRequestRef.current += 1;
    setModal(null);

    if (openerRef.current?.isConnected) {
      openerRef.current.focus();
    }
  }

  function handleBackdrop(event) {
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

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFormError('');
  }

  // ─────────────────────────────────────────────
  // Receive payment
  // ─────────────────────────────────────────────

  async function handlePay(event) {
    event.preventDefault();

    if (
      savingRef.current ||
      detailLoading ||
      detailError ||
      !selected
    ) {
      return;
    }

    setFormError('');

    // An uncertain payment must be retried with its exact payload.
    let payload = pendingAttempt;

    if (!payload) {
      const amount = Number(form.amount);

      if (
        !String(form.amount).trim() ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 1_000_000_000 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
      ) {
        setFormError('Enter a valid amount with up to two decimal places.');
        amountRef.current?.focus();
        return;
      }

      if (cents(amount) > cents(selected.remainingBalance)) {
        setFormError('Payment cannot exceed the remaining balance.');
        amountRef.current?.focus();
        return;
      }

      try {
        payload = {
          paymentId: selected._id,
          amountPaid: cents(amount) / 100,
          method: form.method,
          reference: form.reference.trim(),
          note: form.note.trim(),
          idempotencyKey: createRequestKey(),
        };

        // Persist before sending so a reload retains the same key.
        sessionStorage.setItem(
          attemptKey(selected._id),
          JSON.stringify(payload)
        );
      } catch {
        setFormError(
          'The payment request could not be saved safely in this browser. Enable session storage before recording payment.'
        );
        return;
      }
    }

    savingRef.current = true;
    setSaving(true);
    setPendingAttempt(payload);

    let result;

    try {
      result = await paymentService.recordPayment(payload);
    } catch (error) {
      const statusCode = error.response?.status;

      // Validation/not-found/auth errors did not record a new payment.
      const definitelyRejected =
        [400, 401, 403, 404, 422].includes(statusCode);

      let cleared = false;

      if (definitelyRejected) {
        try {
          sessionStorage.removeItem(attemptKey(payload.paymentId));
          cleared = true;
        } catch {
          // Keep the saved key if browser storage cannot be updated.
        }
      }

      if (mountedRef.current) {
        if (cleared) {
          setPendingAttempt(null);
        }

        setFormError(
          definitelyRejected
            ? errorMessage(error)
            : `${errorMessage(error)} The request is retained. Use “Retry same payment” to confirm it without recording it twice.`
        );

        setSaving(false);
      }

      savingRef.current = false;
      return;
    }

    // Server confirmed the request, including an idempotent retry.
    try {
      sessionStorage.removeItem(attemptKey(payload.paymentId));
    } catch {
      // A retained key still prevents duplication on a later retry.
    }

    savingRef.current = false;

    if (!mountedRef.current) return;

    setSaving(false);
    setPendingAttempt(null);
    setModal(null);

    // Keep populated member/service references from the list.
    setPayments((previous) =>
      previous.map((invoice) =>
        invoice._id === payload.paymentId
          ? {
              ...invoice,
              amountPaid: result.amountPaid,
              remainingBalance: result.remainingBalance,
              status: result.status,
              transactions: result.transactions,
            }
          : invoice
      )
    );

    setSuccess(
      result.duplicateRequest
        ? 'This payment was already recorded. Confirmation retrieved; no duplicate payment was added.'
        : `${money(payload.amountPaid)} received successfully. Remaining balance: ${money(result.remainingBalance)}.`
    );

    await loadPayments();
  }

  const receiptRows = [...(selected?.transactions || [])].sort(
    (a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)
  );

  const remainingAfterPayment = selected
    ? Math.max(
        0,
        cents(selected.remainingBalance) -
          cents(Number(form.amount) || 0)
      ) / 100
    : 0;

  function invoiceActions(invoice) {
    return (
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => openInvoice(invoice, 'history')}
          aria-label={`View history for ${invoice.invoiceNumber}`}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 ${focus}`}
        >
          <History size={14} aria-hidden="true" />
          History
        </button>

        {cents(invoice.remainingBalance) > 0 && (
          <button
            type="button"
            onClick={() => openInvoice(invoice, 'pay')}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-lime-200 ${focus}`}
          >
            <Wallet size={14} aria-hidden="true" />
            Pay
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-5 text-zinc-100">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300">
            <Receipt size={24} aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">
              Payments & invoices
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Collect fees. Track balances. Keep every receipt.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadPayments}
          disabled={loading}
          className={secondary}
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={loading ? 'animate-spin motion-reduce:animate-none' : ''}
          />
          {loading ? 'Refreshing...' : 'Refresh invoices'}
        </button>
      </div>

      {success && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-lime-300/20 bg-lime-300/5 p-4 text-sm text-lime-200">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="flex-1 leading-relaxed">{success}</p>
          <button type="button" onClick={() => setSuccess('')} aria-label="Dismiss message" className={`rounded p-1 ${focus}`}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300/20 bg-red-300/5 p-4 text-sm text-red-200">
          <AlertCircle size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p>{loadError}</p>
            {loaded && (
              <p className="mt-1 text-xs">Previously loaded balances are shown. Refresh to confirm the latest figures.</p>
            )}
          </div>
        </div>
      )}

      {/* Scope controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#14191e] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Invoice view">
          {[
            ['month', 'Monthly invoices'],
            ['arrears', 'Previous dues'],
            ['all', 'All invoices'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => changeView(value)}
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${focus} ${
                view === value
                  ? 'border-lime-300/25 bg-lime-300/10 text-lime-300'
                  : 'border-transparent text-zinc-400 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {view !== 'all' && (
          <div className="flex items-center gap-3">
            <label htmlFor="billing-month" className="shrink-0 text-xs text-zinc-400">
              {view === 'arrears' ? 'Before month' : 'Billing month'}
            </label>

            <input
              id="billing-month"
              type="month"
              value={month}
              min="2000-01"
              max="2100-12"
              onChange={(event) => {
                if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) {
                  setMonth(event.target.value);
                  setPage(1);
                }
              }}
              className={`${input} max-w-[185px]`}
            />
          </div>
        )}
      </div>

      {/* Summaries are for the chosen view before search/status filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Invoice charges', scopeTotals.charged, 'text-white'],
          ['Paid against these invoices', scopeTotals.paid, 'text-lime-300'],
          ['Remaining balance', scopeTotals.balance, 'text-amber-300'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#14191e] p-5">
            <p className="text-xs text-zinc-400">{label}</p>
            <p className={`mt-3 break-words text-xl font-bold tabular-nums ${color}`}>
              {loaded ? money(value) : '—'}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-zinc-500">
        Totals cover the selected view before search filters.
        Paid amounts are invoice totals, not income received during the selected month.
        {view === 'arrears' && ' Previous dues show current unpaid balances before the chosen month, plus legacy balances without a verified month.'}
      </p>

      {/* Directory */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#14191e]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:p-5">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              aria-label="Search invoices or members"
              placeholder="Search member, phone, invoice or service..."
              className={`${input} pl-10`}
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter payment status"
            className={`${input} sm:max-w-[190px]`}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending balance</option>
            <option value="partial">Partial payment</option>
            <option value="overdue">Overdue</option>
            {view !== 'arrears' && <option value="paid">Paid</option>}
          </select>
        </div>

        {loading && !loaded ? (
          <div role="status" className="flex min-h-64 flex-col items-center justify-center gap-4 p-8">
            <Loader2 size={30} className="animate-spin text-lime-300 motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm text-zinc-400">Loading invoices...</p>
          </div>
        ) : !rows.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <Receipt size={34} className="text-lime-300" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-white">
              {loadError && !loaded ? 'Invoices unavailable' : 'No matching invoices'}
            </h3>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              {view === 'arrears'
                ? 'No previous unpaid invoices match this selection.'
                : 'Try another month or filter. Invoices are generated from subscriptions.'}
            </p>
          </div>
        ) : view === 'arrears' ? (
          <div className="space-y-4 p-4 sm:p-5">
            {visibleRows.map((group) => (
              <article key={group.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#10151a]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <Users size={21} className="text-lime-300" aria-hidden="true" />
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {group.member.fullName || 'Member unavailable'}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {group.member.phone || 'No phone'} · {group.invoices.length} pending invoice(s)
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Displayed balance
                    </p>
                    <p className="mt-1 font-bold text-amber-300">{money(group.balance)}</p>
                  </div>
                </div>

                <div className="divide-y divide-white/5">
                  {group.invoices.map((invoice) => (
                    <div key={invoice._id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-200">
                          {invoice.billingMonth || 'Legacy / unallocated'}
                          <span className="mx-2 text-zinc-600">·</span>
                          {invoice.serviceName || invoice.serviceId?.name || 'Service'}
                        </p>
                        <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">
                          {invoice.invoiceNumber}
                        </p>
                        <div className="mt-2"><StatusBadge invoice={invoice} /></div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-amber-300">
                          {money(invoice.remainingBalance)}
                        </p>
                        {invoiceActions(invoice)}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div role="region" aria-label="Invoices table" tabIndex={0} className={`overflow-x-auto ${focus}`}>
            <table className="w-full min-w-[1050px] text-left">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  {['Member / invoice', 'Billing period', 'Charged', 'Paid', 'Balance', 'Status', 'Actions'].map((label) => (
                    <th key={label} scope="col" className={`px-5 py-4 text-[10px] uppercase tracking-widest text-zinc-500 ${label === 'Actions' ? 'text-right' : ''}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {visibleRows.map((invoice) => (
                  <tr key={invoice._id} className="hover:bg-white/[0.02]">
                    <td className="max-w-[280px] px-5 py-5 align-top">
                      <p className="break-words text-sm font-semibold text-white">
                        {memberOf(invoice).fullName || 'Member unavailable'}
                      </p>
                      <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="mt-2 text-xs text-zinc-400">
                        {invoice.serviceName || invoice.serviceId?.name || '—'}
                      </p>
                    </td>

                    <td className="px-5 py-5 align-top">
                      <p className="text-xs text-zinc-200">
                        {invoice.billingMonth || 'Legacy / unallocated'}
                      </p>
                      <p className="mt-1 max-w-[180px] text-[10px] text-zinc-500">
                        {invoice.billingPeriod}
                      </p>
                      <p className="mt-2 text-[10px] text-zinc-400">
                        Due: {displayDate(invoice.dueDate)}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-5 text-xs text-zinc-200 align-top">
                      {money(invoice.amountCharged)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 text-xs text-lime-300 align-top">
                      {money(invoice.amountPaid)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 text-xs font-bold text-amber-300 align-top">
                      {money(invoice.remainingBalance)}
                    </td>
                    <td className="px-5 py-5 align-top">
                      <StatusBadge invoice={invoice} />
                    </td>
                    <td className="px-5 py-5 align-top">
                      {invoiceActions(invoice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="text-xs text-zinc-500">
            {rows.length
              ? `${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, rows.length)} of ${rows.length}`
              : '0'}{' '}
            {view === 'arrears' ? 'members' : 'invoices'}
          </p>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1 || loading} className={secondary}>
              <ChevronLeft size={15} aria-hidden="true" /> Previous
            </button>
            <span className="text-xs text-zinc-400">{currentPage} / {totalPages}</span>
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages || loading} className={secondary}>
              Next <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Payment / history dialog */}
      <dialog
        ref={dialogRef}
        aria-labelledby="payment-dialog-title"
        onClose={handleDialogClose}
        onClick={handleBackdrop}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#14191e] p-0 text-zinc-100 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5 sm:px-7">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-lime-300">
              Payments & receipts
            </p>
            <h2 id="payment-dialog-title" className="mt-1.5 text-xl font-bold">
              {modal === 'history' ? 'Invoice history' : 'Receive payment'}
            </h2>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={closeModal}
            disabled={saving}
            aria-label="Close dialog"
            className={`rounded-xl border border-white/10 p-2.5 text-zinc-400 disabled:opacity-40 ${focus}`}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        {detailLoading ? (
          <div role="status" className="flex items-center justify-center gap-3 p-12 text-sm text-zinc-400">
            <Loader2 size={22} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Loading latest invoice...
          </div>
        ) : detailError ? (
          <div role="alert" className="p-6 text-sm text-red-300">
            {detailError} Close and reopen this invoice to retry.
          </div>
        ) : selected && (
          <div className="p-5 sm:p-7">
            {/* Invoice identity */}
            <div className="rounded-xl border border-white/10 bg-[#0d1217] p-4">
              <p className="font-semibold text-white">
                {memberOf(selected).fullName || 'Member unavailable'}
              </p>
              <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">
                {selected.invoiceNumber}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                {selected.serviceName || selected.serviceId?.name || 'Service'}
                {' · '}
                {selected.billingMonth || 'Legacy / unallocated'}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
                {[
                  ['Charged', selected.amountCharged],
                  ['Paid', selected.amountPaid],
                  ['Balance', selected.remainingBalance],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] text-zinc-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-200">{money(value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {modal === 'history' ? (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Receipt history</h3>
                  <span className="text-xs text-zinc-500">
                    {receiptRows.length} receipt(s)
                  </span>
                </div>

                {Number(selected.legacyPaidAmount) > 0 && (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-200">
                    Historical amount received: {money(selected.legacyPaidAmount)}.
                    Individual receipt dates were not recorded by the old system.
                  </div>
                )}

                {!receiptRows.length && (
                  <p className="rounded-xl border border-white/10 p-5 text-center text-sm text-zinc-500">
                    No dated receipts recorded.
                  </p>
                )}

                {receiptRows.map((receipt) => (
                  <article key={receipt._id || receipt.receiptNumber} className="rounded-xl border border-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-lime-300">{money(receipt.amount)}</p>
                      <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] capitalize text-zinc-400">
                        {receipt.method}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      {displayDate(receipt.receivedAt, true)} · Pakistan time
                    </p>
                    <p className="mt-2 break-all font-mono text-[10px] text-zinc-500">
                      {receipt.receiptNumber}
                    </p>
                    {receipt.reference && <p className="mt-2 break-words text-xs text-zinc-400">Reference: {receipt.reference}</p>}
                    {receipt.note && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-400">{receipt.note}</p>}
                  </article>
                ))}

                <div className="flex justify-end">
                  <button type="button" onClick={closeModal} className={secondary}>Close</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePay} noValidate className="mt-5 space-y-5" aria-busy={saving}>
                {pendingAttempt && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3.5 text-xs leading-relaxed text-amber-200">
                    <Info size={17} className="shrink-0" aria-hidden="true" />
                    <p>
                      An unconfirmed request for {money(pendingAttempt.amountPaid)} is retained.
                      Retry it unchanged to confirm the outcome. It will not be charged twice.
                    </p>
                  </div>
                )}

                {formError && (
                  <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/5 p-3.5 text-xs leading-relaxed text-red-200">
                    {formError}
                  </p>
                )}

                {!pendingAttempt && cents(selected.remainingBalance) === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-lime-300">
                    <CheckCircle2 size={19} aria-hidden="true" />
                    This invoice is fully paid.
                  </div>
                ) : (
                  <>
                    <fieldset disabled={saving || Boolean(pendingAttempt)} className="m-0 grid min-w-0 grid-cols-1 gap-5 border-0 p-0 sm:grid-cols-2">
                      <legend className="sr-only">Payment details</legend>

                      <div>
                        <label htmlFor="payment-amount" className="mb-2 block text-xs font-semibold text-zinc-300">
                          Amount received (PKR) *
                        </label>
                        <input
                          ref={amountRef}
                          id="payment-amount"
                          name="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={selected.remainingBalance}
                          inputMode="decimal"
                          value={form.amount}
                          onChange={updateField}
                          className={input}
                          required
                        />

                        <button
                          type="button"
                          onClick={() => setForm((previous) => ({
                            ...previous,
                            amount: String(selected.remainingBalance),
                          }))}
                          className={`mt-2 rounded text-xs font-semibold text-lime-300 ${focus}`}
                        >
                          Use full balance
                        </button>
                      </div>

                      <div>
                        <label htmlFor="payment-method" className="mb-2 block text-xs font-semibold text-zinc-300">
                          Payment method *
                        </label>
                        <select id="payment-method" name="method" value={form.method} onChange={updateField} className={input}>
                          <option value="cash">Cash</option>
                          <option value="bank">Bank transfer</option>
                          <option value="card">Card</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor="payment-reference" className="mb-2 block text-xs font-semibold text-zinc-300">
                          Reference <span className="font-normal text-zinc-500">(optional)</span>
                        </label>
                        <input id="payment-reference" name="reference" value={form.reference} onChange={updateField} maxLength={200} placeholder="Bank or transaction reference" className={input} />
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor="payment-note" className="mb-2 block text-xs font-semibold text-zinc-300">
                          Note <span className="font-normal text-zinc-500">(optional)</span>
                        </label>
                        <textarea id="payment-note" name="note" value={form.note} onChange={updateField} maxLength={1000} rows={3} placeholder="Payment details..." className={`${input} resize-y`} />
                      </div>
                    </fieldset>

                    {!pendingAttempt && (
                      <div className="rounded-xl border border-lime-300/15 bg-lime-300/5 p-4">
                        <p className="text-xs text-zinc-400">Balance after this payment</p>
                        <p className="mt-1 font-bold text-lime-300">{money(remainingAfterPayment)}</p>
                        <p className="mt-2 text-[11px] text-zinc-500">
                          Records money already received. This form does not process a bank or card charge.
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                  <button type="button" onClick={closeModal} disabled={saving} className={secondary}>
                    Close
                  </button>

                  {(pendingAttempt || cents(selected.remainingBalance) > 0) && (
                    <button type="submit" disabled={saving} className={primary}>
                      {saving ? (
                        <Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <CreditCard size={17} aria-hidden="true" />
                      )}
                      {saving
                        ? 'Recording...'
                        : pendingAttempt
                          ? 'Retry same payment'
                          : 'Confirm payment'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}

export default Payments;