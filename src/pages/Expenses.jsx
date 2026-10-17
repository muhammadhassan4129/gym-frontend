import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Wallet,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  CalendarDays,
  Tags,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import expenseService from '../services/expenseService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const PAGE_SIZE = 10;

const DEFAULT_CATEGORIES = [
  'Rent',
  'Electricity',
  'Water',
  'Internet',
  'Salaries',
  'Equipment',
  'Maintenance',
  'Cleaning',
  'Marketing',
  'Supplies',
  'Other',
];

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

const money = (value) =>
  `PKR ${Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const sumAmounts = (rows) =>
  rows.reduce(
    (total, row) => total + Math.round(Number(row.amount || 0) * 100),
    0
  ) / 100;

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'Something went wrong. Please try again.';

const emptyForm = () => ({
  date: pakistanDate(),
  category: '',
  amount: '',
  description: '',
});

function validateForm(form) {
  const errors = {};

  const date = new Date(`${form.date}T00:00:00+05:00`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
    Number.isNaN(date.getTime()) ||
    pakistanDate(date) !== form.date
  ) {
    errors.date = 'Select a valid expense date.';
  }

  if (!form.category.trim()) {
    errors.category = 'Enter or select a category.';
  } else if (form.category.trim().length > 100) {
    errors.category = 'Category must not exceed 100 characters.';
  }

  const amountText = String(form.amount).trim();
  const amount = Number(amountText);

  if (!amountText || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than zero.';
  } else if (amount > 1_000_000_000) {
    errors.amount = 'Amount must not exceed 1,000,000,000.';
  } else if (
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
  ) {
    errors.amount = 'Use a maximum of two decimal places.';
  }

  if (form.description.trim().length > 2000) {
    errors.description =
      'Description must not exceed 2,000 characters.';
  }

  return errors;
}

// ─────────────────────────────────────────────
// Tailwind classes
// ─────────────────────────────────────────────

const focusClass =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-lime-300 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[#14191e]';

const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 ' +
  'rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold ' +
  'text-zinc-950 transition hover:bg-lime-200 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  focusClass;

const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 ' +
  'rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 ' +
  'text-sm font-medium text-zinc-200 transition hover:bg-white/10 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  focusClass;

const iconButtonClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center ' +
  'rounded-xl border border-white/10 text-zinc-400 transition ' +
  'hover:bg-white/5 hover:text-white disabled:opacity-40 ' +
  focusClass;

function inputClass(hasError = false) {
  return (
    'min-h-11 w-full min-w-0 rounded-xl border bg-[#0d1217] ' +
    'px-3.5 py-3 text-sm text-zinc-100 outline-none transition ' +
    'placeholder:text-zinc-600 disabled:opacity-60 ' +
    'focus:ring-2 [color-scheme:dark] ' +
    (hasError
      ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/10'
      : 'border-white/10 focus:border-lime-300/60 focus:ring-lime-300/10')
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');

  const [month, setMonth] = useState(() =>
    pakistanDate().slice(0, 7)
  );
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // null | 'form' | 'delete'
  const [modal, setModal] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [needsRecheck, setNeedsRecheck] = useState(false);

  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const categoryRef = useRef(null);
  const keepExpenseRef = useRef(null);
  const openerRef = useRef(null);

  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const savingRef = useRef(false);

  // ─────────────────────────────────────────────
  // Load expenses
  // ─────────────────────────────────────────────

  const loadExpenses = useCallback(async () => {
    const requestId = ++requestRef.current;

    setLoading(true);
    setLoadError('');

    try {
      const data = await expenseService.getExpenses();

      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setExpenses(data);
        setLoaded(true);
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
    loadExpenses();

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadExpenses]);

  // ─────────────────────────────────────────────
  // Modal lifecycle
  // ─────────────────────────────────────────────

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (modal && !dialog.open) {
      dialog.showModal();

      if (modal === 'delete') {
        keepExpenseRef.current?.focus();
      } else {
        categoryRef.current?.focus();
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
  // Filters and totals
  // ─────────────────────────────────────────────

  const categories = useMemo(
    () =>
      [...new Set(
        expenses.map((expense) => expense.category).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b)),
    [expenses]
  );

  const categorySuggestions = useMemo(
    () =>
      [...new Set([...DEFAULT_CATEGORIES, ...categories])]
        .sort((a, b) => a.localeCompare(b)),
    [categories]
  );

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses
      .filter((expense) => {
        const matchesMonth =
          !month || pakistanDate(expense.date).slice(0, 7) === month;

        const matchesCategory =
          !categoryFilter || expense.category === categoryFilter;

        const matchesSearch =
          !query ||
          [expense.category, expense.description].some((value) =>
            String(value || '').toLowerCase().includes(query)
          );

        return matchesMonth && matchesCategory && matchesSearch;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, month, categoryFilter, search]);

  const totalAmount = sumAmounts(filteredExpenses);

  const categoryCount = new Set(
    filteredExpenses.map((expense) => expense.category)
  ).size;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredExpenses.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const visibleExpenses = filteredExpenses.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  function clearFilters() {
    setMonth('');
    setCategoryFilter('');
    setSearch('');
    setPage(1);
  }

  // ─────────────────────────────────────────────
  // Modal actions
  // ─────────────────────────────────────────────

  function prepareModal() {
    openerRef.current = document.activeElement;
    setFieldErrors({});
    setFormError('');
    setSuccess('');
    setNeedsRecheck(false);
  }

  function openCreate() {
    prepareModal();
    setSelectedExpense(null);
    setForm(emptyForm());
    setModal('form');
  }

  function openEdit(expense) {
    prepareModal();
    setSelectedExpense(expense);

    setForm({
      date: pakistanDate(expense.date),
      category: expense.category || '',
      amount: String(expense.amount ?? ''),
      description: expense.description || '',
    });

    setModal('form');
  }

  function openDelete(expense) {
    prepareModal();
    setSelectedExpense(expense);
    setModal('delete');
  }

  function closeModal() {
    if (savingRef.current) return;

    setModal(null);

    if (needsRecheck) {
      loadExpenses();
    }
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

  async function handleSave(event) {
    event.preventDefault();

    if (savingRef.current || needsRecheck) return;

    const errors = validateForm(form);

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

    const payload = {
      date: form.date,
      category: form.category.trim(),
      amount: Math.round(Number(form.amount) * 100) / 100,
      description: form.description.trim(),
    };

    const isEditing = Boolean(selectedExpense);

    try {
      if (isEditing) {
        await expenseService.updateExpense(
          selectedExpense._id,
          payload
        );
      } else {
        await expenseService.createExpense(payload);
      }
    } catch (error) {
      if (mountedRef.current) {
        const uncertainOutcome =
          !error.response || error.response.status >= 500;

        setNeedsRecheck(uncertainOutcome);

        setFormError(
          uncertainOutcome
            ? 'Save could not be confirmed. Close this form to refresh the list and check whether the expense was saved before trying again.'
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

    // Show the saved expense's month without hiding it behind old filters.
    setMonth(payload.date.slice(0, 7));
    setCategoryFilter('');
    setSearch('');
    setPage(1);

    setSuccess(
      isEditing
        ? 'Expense updated successfully.'
        : 'Expense recorded successfully.'
    );

    await loadExpenses();
  }

  // ─────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────

  async function handleDelete() {
    if (
      savingRef.current ||
      needsRecheck ||
      !selectedExpense?._id
    ) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError('');

    try {
      await expenseService.deleteExpense(selectedExpense._id);
    } catch (error) {
      if (mountedRef.current) {
        const uncertainOutcome =
          !error.response ||
          error.response.status >= 500 ||
          error.response.status === 404;

        setNeedsRecheck(uncertainOutcome);

        setFormError(
          uncertainOutcome
            ? 'The expense may already have been removed. Close this dialog to refresh the list and confirm its current state.'
            : errorMessage(error)
        );

        setSaving(false);
      }

      savingRef.current = false;
      return;
    }

    savingRef.current = false;

    if (!mountedRef.current) return;

    setExpenses((previous) =>
      previous.filter((expense) => expense._id !== selectedExpense._id)
    );

    setSaving(false);
    setModal(null);
    setSuccess('Expense deleted successfully.');

    await loadExpenses();
  }

  function fieldProps(name) {
    return {
      id: `expense-${name}`,
      name,
      value: form[name],
      onChange: updateField,
      className: inputClass(Boolean(fieldErrors[name])),
      'aria-invalid': Boolean(fieldErrors[name]),
      'aria-describedby': fieldErrors[name]
        ? `expense-${name}-error`
        : undefined,
    };
  }

  function renderFieldError(name) {
    return fieldErrors[name] ? (
      <p
        id={`expense-${name}-error`}
        className="mt-1.5 text-xs leading-relaxed text-red-300"
      >
        {fieldErrors[name]}
      </p>
    ) : null;
  }

  return (
    <section
      className="min-w-0 space-y-5 text-zinc-100"
      aria-label="Expense management"
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300">
            <Wallet size={24} aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Gym expenses
            </h2>

            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Keep your operating costs in clear view.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className={primaryButtonClass}
        >
          <Plus size={18} aria-hidden="true" />
          Add expense
        </button>
      </div>

      {/* Messages */}
      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-lime-300/20 bg-lime-300/5 p-4 text-sm text-lime-200"
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
            className={`rounded p-1 ${focusClass}`}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-300/20 bg-red-300/5 p-4 text-sm text-red-200"
        >
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <p>{loadError}</p>

            {loaded && (
              <p className="mt-1 text-xs">
                Previously loaded records are shown below.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={loadExpenses}
            disabled={loading}
            className={`rounded px-2 py-1 text-xs font-semibold underline disabled:opacity-40 ${focusClass}`}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filtered totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Total expenses',
            value: money(totalAmount),
            icon: Wallet,
            color: 'text-amber-300',
          },
          {
            label: 'Expense entries',
            value: filteredExpenses.length,
            icon: Receipt,
            color: 'text-white',
          },
          {
            label: 'Categories used',
            value: categoryCount,
            icon: Tags,
            color: 'text-lime-300',
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#14191e] p-5"
            >
              <div className="min-w-0">
                <p className="text-xs text-zinc-400">
                  {item.label}
                </p>

                <p
                  className={`mt-3 break-words text-xl font-bold tabular-nums ${item.color}`}
                >
                  {loaded ? item.value : '—'}
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400">
                <Icon size={21} aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500">
        Totals reflect the month, category and search filters below.
      </p>

      {/* Expense directory */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#14191e]">
        <div className="space-y-4 border-b border-white/10 p-4 sm:p-5">
          {/* Search */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />

              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search category or description..."
                aria-label="Search expenses"
                className={`${inputClass()} pl-10`}
              />
            </div>

            <button
              type="button"
              onClick={loadExpenses}
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

              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="expense-month-filter"
                className="mb-2 block text-xs text-zinc-400"
              >
                Expense month
              </label>

              <input
                id="expense-month-filter"
                type="month"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  setPage(1);
                }}
                className={inputClass()}
              />
            </div>

            <div>
              <label
                htmlFor="expense-category-filter"
                className="mb-2 block text-xs text-zinc-400"
              >
                Category
              </label>

              <select
                id="expense-category-filter"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setPage(1);
                }}
                className={inputClass()}
              >
                <option value="">All categories</option>

                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className={secondaryButtonClass}
            >
              <X size={15} aria-hidden="true" />
              Clear filters / all dates
            </button>
          </div>
        </div>

        {/* Table */}
        <div
          role="region"
          aria-label="Expense history table"
          aria-busy={loading}
          tabIndex={0}
          className={`overflow-x-auto ${focusClass}`}
        >
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">
              Expenses with date, category, amount and edit or delete actions
            </caption>

            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                {[
                  'Date',
                  'Category',
                  'Amount',
                  'Description',
                  'Actions',
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className={`px-5 py-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 ${
                      label === 'Actions' ? 'text-right' : ''
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {loading && !loaded ? (
                <tr>
                  <td colSpan={5}>
                    <div
                      role="status"
                      className="flex min-h-64 flex-col items-center justify-center gap-4 p-8"
                    >
                      <Loader2
                        size={30}
                        className="animate-spin text-lime-300 motion-reduce:animate-none"
                        aria-hidden="true"
                      />

                      <p className="text-sm text-zinc-400">
                        Loading expenses...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lime-300">
                        <Receipt size={29} aria-hidden="true" />
                      </div>

                      <h3 className="mt-5 font-semibold text-white">
                        {loadError && !loaded
                          ? 'Expenses unavailable'
                          : 'No expenses found'}
                      </h3>

                      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
                        {loadError && !loaded
                          ? 'Retry loading your expense records.'
                          : 'Add an expense or change your filters to see other records.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleExpenses.map((expense) => (
                  <tr
                    key={expense._id}
                    className="transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-5 align-top">
                      <div className="flex items-center gap-2 whitespace-nowrap text-xs text-zinc-400">
                        <CalendarDays
                          size={14}
                          className="text-zinc-600"
                          aria-hidden="true"
                        />
                        {displayDate(expense.date)}
                      </div>
                    </td>

                    <td className="px-5 py-5 align-top">
                      <span className="inline-block max-w-[180px] break-words rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-200">
                        {expense.category}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-5 text-sm font-bold tabular-nums text-amber-300 align-top">
                      {money(expense.amount)}
                    </td>

                    <td className="px-5 py-5 align-top">
                      <p className="max-w-sm whitespace-pre-wrap break-words text-xs leading-7 text-zinc-400">
                        {expense.description || 'No description added.'}
                      </p>
                    </td>

                    <td className="px-5 py-5 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(expense)}
                          aria-label={`Edit ${expense.category} expense dated ${displayDate(expense.date)}`}
                          className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-lime-300/30 hover:text-lime-300 ${focusClass}`}
                        >
                          <Pencil size={13} aria-hidden="true" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => openDelete(expense)}
                          aria-label={`Delete ${expense.category} expense dated ${displayDate(expense.date)}`}
                          className={`inline-flex items-center justify-center rounded-lg border border-red-300/10 p-2 text-red-300 hover:border-red-300/30 hover:bg-red-300/5 ${focusClass}`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500" aria-live="polite">
            {filteredExpenses.length
              ? `Showing ${startIndex + 1}–${Math.min(
                  startIndex + PAGE_SIZE,
                  filteredExpenses.length
                )} of ${filteredExpenses.length} expenses`
              : '0 expenses shown'}
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

      {/* Add / Edit / Delete dialog */}
      <dialog
        ref={dialogRef}
        aria-labelledby="expense-modal-title"
        aria-describedby="expense-modal-description"
        onClose={handleDialogClose}
        onClick={handleBackdropClick}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#14191e] p-0 text-zinc-100 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {/* Dialog header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div
              className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border sm:flex ${
                modal === 'delete'
                  ? 'border-red-300/20 bg-red-300/10 text-red-300'
                  : 'border-lime-300/20 bg-lime-300/10 text-lime-300'
              }`}
            >
              {modal === 'delete' ? (
                <Trash2 size={23} aria-hidden="true" />
              ) : (
                <Wallet size={23} aria-hidden="true" />
              )}
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                Expense management
              </p>

              <h2
                id="expense-modal-title"
                className="mt-1.5 text-xl font-bold text-white"
              >
                {modal === 'delete'
                  ? 'Delete expense?'
                  : selectedExpense
                    ? 'Edit expense'
                    : 'Record an expense'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            aria-label="Close expense dialog"
            className={iconButtonClass}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        {modal === 'delete' ? (
          <div className="space-y-5 p-5 sm:p-7">
            <p
              id="expense-modal-description"
              className="text-sm leading-relaxed text-zinc-400"
            >
              This permanently removes the expense and changes
              the expense totals in your reports.
            </p>

            <div className="rounded-xl border border-white/10 bg-[#0d1217] p-4">
              <p className="font-semibold text-white">
                {selectedExpense?.category}
              </p>

              <p className="mt-2 text-xl font-bold text-amber-300">
                {money(selectedExpense?.amount)}
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                {displayDate(selectedExpense?.date)}
              </p>
            </div>

            {formError && (
              <p
                role="alert"
                className="text-xs leading-relaxed text-red-300"
              >
                {formError}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                ref={keepExpenseRef}
                type="button"
                onClick={closeModal}
                disabled={saving}
                className={secondaryButtonClass}
              >
                {needsRecheck ? 'Close & refresh' : 'Keep expense'}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || needsRecheck}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-red-300 disabled:opacity-40 ${focusClass}`}
              >
                {saving ? (
                  <Loader2
                    size={17}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 size={17} aria-hidden="true" />
                )}

                {saving ? 'Deleting...' : 'Delete expense'}
              </button>
            </div>
          </div>
        ) : (
          <form
            ref={formRef}
            onSubmit={handleSave}
            noValidate
            aria-busy={saving}
          >
            <div className="space-y-5 p-5 sm:p-7">
              <p
                id="expense-modal-description"
                className="text-sm leading-relaxed text-zinc-400"
              >
                {selectedExpense
                  ? 'Update this expense. Reports use the expense date selected below.'
                  : 'Record a gym operating cost with its date, category and amount.'}
              </p>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-300/20 bg-red-300/5 p-3.5 text-xs leading-relaxed text-red-200"
                >
                  {formError}
                </div>
              )}

              <fieldset
                disabled={saving || needsRecheck}
                className="m-0 grid min-w-0 grid-cols-1 gap-5 border-0 p-0 sm:grid-cols-2"
              >
                <legend className="sr-only">
                  Expense information
                </legend>

                {/* Category */}
                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="expense-category"
                    className="mb-2 block text-xs font-semibold text-zinc-300"
                  >
                    Category <span className="text-lime-300">*</span>
                  </label>

                  <input
                    {...fieldProps('category')}
                    ref={categoryRef}
                    type="text"
                    list="expense-category-options"
                    maxLength={100}
                    placeholder="Choose or type a category"
                    required
                  />

                  <datalist id="expense-category-options">
                    {categorySuggestions.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>

                  {renderFieldError('category')}

                  <p className="mt-2 text-[10px] text-zinc-500">
                    Choose a suggestion or enter your own category.
                  </p>
                </div>

                {/* Date */}
                <div className="min-w-0">
                  <label
                    htmlFor="expense-date"
                    className="mb-2 block text-xs font-semibold text-zinc-300"
                  >
                    Expense date <span className="text-lime-300">*</span>
                  </label>

                  <input
                    {...fieldProps('date')}
                    type="date"
                    required
                  />

                  {renderFieldError('date')}
                </div>

                {/* Amount */}
                <div className="min-w-0">
                  <label
                    htmlFor="expense-amount"
                    className="mb-2 block text-xs font-semibold text-zinc-300"
                  >
                    Amount (PKR) <span className="text-lime-300">*</span>
                  </label>

                  <input
                    {...fieldProps('amount')}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="1000000000"
                    step="0.01"
                    placeholder="5000"
                    required
                  />

                  {renderFieldError('amount')}
                </div>

                {/* Description */}
                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="expense-description"
                    className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-zinc-300"
                  >
                    Description
                    <span className="text-[10px] font-normal text-zinc-500">
                      Optional
                    </span>
                  </label>

                  <textarea
                    {...fieldProps('description')}
                    rows={4}
                    maxLength={2000}
                    placeholder="What was this expense for?"
                    className={`${inputClass(
                      Boolean(fieldErrors.description)
                    )} min-h-28 resize-y`}
                  />

                  <div className="mt-1.5 flex items-start justify-between gap-3">
                    <div>{renderFieldError('description')}</div>

                    <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                      {form.description.length}/2000
                    </span>
                  </div>
                </div>
              </fieldset>
            </div>

            {/* Dialog footer */}
            <div className="flex flex-col gap-4 border-t border-white/10 bg-[#10151a] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-[11px] text-zinc-500">
                <span className="text-lime-300">*</span> Required fields
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className={`${secondaryButtonClass} flex-1 sm:flex-none`}
                >
                  {needsRecheck ? 'Close & refresh' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={saving || needsRecheck}
                  className={`${primaryButtonClass} flex-1 sm:flex-none`}
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save size={17} aria-hidden="true" />
                  )}

                  {saving
                    ? 'Saving...'
                    : selectedExpense
                      ? 'Save changes'
                      : 'Save expense'}
                </button>
              </div>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}

export default Expenses;