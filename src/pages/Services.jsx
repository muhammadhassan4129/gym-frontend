import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Dumbbell,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Info,
  Layers,
  CircleCheck,
  CirclePause,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import serviceService from '../services/serviceService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const PAGE_SIZE = 9;

const emptyForm = () => ({
  name: '',
  fee: '',
  description: '',
  isActive: true,
});

const isServiceActive = (service) => service.isActive !== false;

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'Something went wrong. Please try again.';

function validateForm(form) {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = 'Enter a service name.';
  } else if (form.name.trim().length > 120) {
    errors.name = 'Name must not exceed 120 characters.';
  }

  const feeText = String(form.fee).trim();
  const fee = Number(feeText);

  if (!feeText) {
    errors.fee = 'Enter the monthly fee.';
  } else if (!Number.isFinite(fee) || fee <= 0) {
    errors.fee = 'Fee must be greater than zero.';
  } else if (fee > 1_000_000_000) {
    errors.fee = 'Fee must not exceed 1,000,000,000.';
  } else if (
    Math.abs(fee * 100 - Math.round(fee * 100)) > 0.00001
  ) {
    errors.fee = 'Use a maximum of two decimal places.';
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
// Component
// ─────────────────────────────────────────────

function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
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
  // Load services
  // ─────────────────────────────────────────────

  const loadServices = useCallback(async () => {
    const requestId = ++requestRef.current;

    setLoading(true);
    setListError('');

    try {
      const data = await serviceService.getServices();

      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setServices(data);
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
    loadServices();

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadServices]);

  // ─────────────────────────────────────────────
  // Modal lifecycle
  // ─────────────────────────────────────────────

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
  // Counts, search and pagination
  // ─────────────────────────────────────────────

  const activeCount = services.filter(isServiceActive).length;
  const inactiveCount = services.length - activeCount;

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !query ||
        [service.name, service.description].some((value) =>
          String(value || '').toLowerCase().includes(query)
        );

      const active = isServiceActive(service);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && active) ||
        (statusFilter === 'inactive' && !active);

      return matchesSearch && matchesStatus;
    });
  }, [services, searchQuery, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredServices.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const visibleServices = filteredServices.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const hasFilters =
    Boolean(searchQuery.trim()) || statusFilter !== 'all';

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setPage(1);
  }

  // ─────────────────────────────────────────────
  // Modal actions
  // ─────────────────────────────────────────────

  function openCreate() {
    openerRef.current = document.activeElement;

    setEditingService(null);
    setForm(emptyForm());
    setFieldErrors({});
    setFormError('');
    setSuccess('');
    setModalOpen(true);
  }

  function openEdit(service) {
    openerRef.current = document.activeElement;

    setEditingService(service);

    setForm({
      name: service.name || '',
      fee: String(service.fee ?? ''),
      description: service.description || '',
      isActive: isServiceActive(service),
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
  // Save service
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

    const isEditing = Boolean(editingService);

    const payload = {
      name: form.name.trim(),
      fee: Math.round(Number(form.fee) * 100) / 100,
      description: form.description.trim(),
    };

    try {
      if (isEditing) {
        await serviceService.updateService(editingService._id, {
          ...payload,
          isActive: form.isActive,
        });
      } else {
        // Backend creates new services as active.
        await serviceService.createService(payload);
      }
    } catch (error) {
      if (mountedRef.current) {
        const uncertainOutcome =
          !error.response ||
          error.response.status >= 500;

        setFormError(
          uncertainOutcome
            ? 'Save could not be confirmed. Close this form and refresh the list before retrying.'
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
        ? 'Service updated successfully.'
        : 'New service created successfully.'
    );

    if (!isEditing) {
      clearFilters();
    }

    await loadServices();
  }

  function fieldProps(name) {
    return {
      id: `service-${name}`,
      name,
      value: form[name],
      onChange: updateField,
      className: inputClass(Boolean(fieldErrors[name])),
      'aria-invalid': Boolean(fieldErrors[name]),
      'aria-describedby': fieldErrors[name]
        ? `service-${name}-error`
        : undefined,
    };
  }

  function renderFieldError(name) {
    if (!fieldErrors[name]) return null;

    return (
      <p
        id={`service-${name}-error`}
        className="mt-1.5 text-xs leading-relaxed text-red-300"
      >
        {fieldErrors[name]}
      </p>
    );
  }

  const summaryCards = [
    {
      label: 'Total services',
      value: services.length,
      icon: Layers,
      style: 'border-white/10 bg-white/5 text-zinc-300',
    },
    {
      label: 'Active services',
      value: activeCount,
      icon: CircleCheck,
      style: 'border-lime-300/20 bg-lime-300/10 text-lime-300',
    },
    {
      label: 'Inactive services',
      value: inactiveCount,
      icon: CirclePause,
      style: 'border-amber-300/20 bg-amber-300/10 text-amber-300',
    },
  ];

  return (
    <section
      className="min-w-0 space-y-5 text-zinc-100"
      aria-label="Services and fees management"
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300">
            <Dumbbell size={24} aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Services & fees
            </h2>

            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Training options built around your members.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className={primaryButtonClass}
        >
          <Plus size={18} aria-hidden="true" />
          Add service
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
            className={`rounded-lg p-1 text-lime-200/70 hover:text-lime-100 ${focusClass}`}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {listError && (
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
            <p className="font-semibold">
              Could not refresh services.
            </p>

            <p className="mt-1 text-xs leading-relaxed">
              {listError}
            </p>

            {services.length > 0 && (
              <p className="mt-1 text-xs text-red-200/70">
                Previously loaded services are shown below.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={loadServices}
            disabled={loading}
            className={`rounded-lg px-2 py-1 text-xs font-semibold underline disabled:opacity-40 ${focusClass}`}
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#14191e] p-5"
            >
              <div>
                <p className="text-xs text-zinc-400">
                  {card.label}
                </p>

                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white">
                  {loading && services.length === 0
                    ? '—'
                    : listError && services.length === 0
                      ? '—'
                      : card.value}
                </p>
              </div>

              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${card.style}`}
              >
                <Icon size={21} aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Catalog */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#14191e]">
        {/* Search and filters */}
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
                aria-label="Search services"
                placeholder="Search services or descriptions..."
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d1217] py-3 pl-10 pr-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/10"
              />
            </div>

            <button
              type="button"
              onClick={loadServices}
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

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter services by availability"
          >
            {[
              { value: 'all', label: 'All services' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ].map((filter) => {
              const selected = statusFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setStatusFilter(filter.value);
                    setPage(1);
                  }}
                  className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${focusClass} ${
                    selected
                      ? 'border-lime-300/25 bg-lime-300/10 text-lime-300'
                      : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Service cards */}
        <div aria-busy={loading}>
          {loading && services.length === 0 ? (
            <div
              role="status"
              className="flex min-h-72 flex-col items-center justify-center p-8 text-center"
            >
              <Loader2
                size={30}
                className="animate-spin text-lime-300 motion-reduce:animate-none"
                aria-hidden="true"
              />

              <h3 className="mt-4 text-base font-semibold text-white">
                Loading services
              </h3>

              <p className="mt-2 text-sm text-zinc-400">
                Getting your latest training options.
              </p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lime-300">
                {listError ? (
                  <AlertCircle size={28} aria-hidden="true" />
                ) : (
                  <Dumbbell size={28} aria-hidden="true" />
                )}
              </div>

              <h3 className="mt-5 text-base font-semibold text-white">
                {listError
                  ? 'Service list unavailable'
                  : hasFilters
                    ? 'No matching services'
                    : 'Build your training lineup'}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
                {listError
                  ? 'Retry loading your services.'
                  : hasFilters
                    ? 'Try another search or availability filter.'
                    : 'Add your first service and set its monthly fee.'}
              </p>

              {!listError && (
                <button
                  type="button"
                  onClick={hasFilters ? clearFilters : openCreate}
                  className={`${secondaryButtonClass} mt-5`}
                >
                  {hasFilters ? (
                    <X size={16} aria-hidden="true" />
                  ) : (
                    <Plus size={16} aria-hidden="true" />
                  )}

                  {hasFilters
                    ? 'Clear filters'
                    : 'Add first service'}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 sm:p-5">
              {visibleServices.map((service) => {
                const active = isServiceActive(service);

                return (
                  <article
                    key={service._id}
                    className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-[#10151a] p-5 transition-colors hover:border-lime-300/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                          active
                            ? 'border-lime-300/15 bg-lime-300/10 text-lime-300'
                            : 'border-white/10 bg-white/5 text-zinc-500'
                        }`}
                      >
                        <Dumbbell size={23} aria-hidden="true" />
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                          active
                            ? 'border-lime-300/20 bg-lime-300/5 text-lime-300'
                            : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400'
                        }`}
                      >
                        {active ? (
                          <CircleCheck size={12} aria-hidden="true" />
                        ) : (
                          <CirclePause size={12} aria-hidden="true" />
                        )}

                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <h3 className="mt-5 break-words text-base font-bold tracking-tight text-white">
                      {service.name}
                    </h3>

                    <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                      <span className="text-xs font-medium text-zinc-500">
                        PKR
                      </span>

                      <span className="break-all text-3xl font-bold tabular-nums tracking-tight text-lime-300">
                        {formatMoney(service.fee)}
                      </span>

                      <span className="text-xs text-zinc-500">
                        / month
                      </span>
                    </div>

                    <p className="mt-4 whitespace-pre-wrap break-words text-xs leading-7 text-zinc-400">
                      {service.description || 'No description added.'}
                    </p>

                    <div className="mt-auto pt-5">
                      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                        <span className="text-[10px] leading-relaxed text-zinc-500">
                          {active
                            ? 'Available for new subscriptions'
                            : 'Unavailable for new subscriptions'}
                        </span>

                        <button
                          type="button"
                          onClick={() => openEdit(service)}
                          aria-label={`Edit ${service.name}`}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-lime-300/30 hover:bg-lime-300/5 hover:text-lime-300 ${focusClass}`}
                        >
                          <Pencil size={13} aria-hidden="true" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500" aria-live="polite">
            {filteredServices.length > 0 ? (
              <>
                Showing{' '}
                <span className="font-medium text-zinc-300">
                  {startIndex + 1}–
                  {Math.min(
                    startIndex + PAGE_SIZE,
                    filteredServices.length
                  )}
                </span>{' '}
                of{' '}
                <span className="font-medium text-zinc-300">
                  {filteredServices.length}
                </span>{' '}
                services
              </>
            ) : (
              '0 services shown'
            )}
          </p>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              aria-label="Previous page"
              className={secondaryButtonClass}
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
              className={secondaryButtonClass}
            >
              Next
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Billing explanation */}
      <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <Info
          size={18}
          className="mt-0.5 shrink-0 text-lime-300"
          aria-hidden="true"
        />

        <p className="text-xs leading-relaxed text-zinc-400">
          Service prices apply to new subscriptions. Existing
          subscriptions keep their agreed fee. Making a service
          inactive prevents new sign-ups; existing subscriptions
          continue until cancelled separately.
        </p>
      </div>

      {/* Add / Edit modal */}
      <dialog
        ref={dialogRef}
        aria-labelledby="service-modal-title"
        aria-describedby="service-modal-description"
        onClose={handleDialogClose}
        onClick={handleBackdropClick}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#14191e] p-0 text-zinc-100 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-lime-300/[0.03] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300 sm:flex">
              <Dumbbell size={24} aria-hidden="true" />
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-lime-300">
                Training & pricing
              </p>

              <h2
                id="service-modal-title"
                className="mt-1.5 text-xl font-bold tracking-tight text-white"
              >
                {editingService
                  ? 'Edit service'
                  : 'Build your next offering.'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            aria-label="Close service form"
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
              id="service-modal-description"
              className="text-sm leading-relaxed text-zinc-400"
            >
              {editingService
                ? 'Update the service details, monthly fee and availability.'
                : 'Give your service a name, set its monthly fee and add a short description.'}
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
              className="m-0 min-w-0 space-y-5 border-0 p-0"
            >
              <legend className="sr-only">
                Service information
              </legend>

              {/* Name */}
              <div>
                <label
                  htmlFor="service-name"
                  className="mb-2 block text-xs font-semibold text-zinc-300"
                >
                  Service name{' '}
                  <span className="text-lime-300">*</span>
                </label>

                <input
                  {...fieldProps('name')}
                  ref={nameInputRef}
                  type="text"
                  placeholder="e.g. Strength Training"
                  maxLength={120}
                  required
                />

                {renderFieldError('name')}
              </div>

              {/* Fee */}
              <div>
                <label
                  htmlFor="service-fee"
                  className="mb-2 block text-xs font-semibold text-zinc-300"
                >
                  Monthly fee{' '}
                  <span className="text-lime-300">*</span>
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500">
                    PKR
                  </span>

                  <input
                    {...fieldProps('fee')}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="1000000000"
                    step="0.01"
                    placeholder="3000"
                    className={`${inputClass(
                      Boolean(fieldErrors.fee)
                    )} pl-14`}
                    required
                  />
                </div>

                {renderFieldError('fee')}
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="service-description"
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
                  placeholder="Describe what this service includes..."
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

              {/* Availability: existing services only */}
              {editingService && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0d1217] p-4">
                  <div>
                    <p
                      id="service-availability-label"
                      className="text-sm font-semibold text-zinc-200"
                    >
                      Available for new subscriptions
                    </p>

                    <p
                      id="service-availability-help"
                      className="mt-1 text-xs leading-relaxed text-zinc-500"
                    >
                      {form.isActive
                        ? 'Members can subscribe to this service.'
                        : 'New subscriptions are disabled for this service.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isActive}
                    aria-labelledby="service-availability-label"
                    aria-describedby="service-availability-help"
                    disabled={saving}
                    onClick={() => {
                      setForm((previous) => ({
                        ...previous,
                        isActive: !previous.isActive,
                      }));
                    }}
                    className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-1 transition-colors disabled:opacity-50 ${focusClass} ${
                      form.isActive
                        ? 'border-lime-300 bg-lime-300'
                        : 'border-zinc-600 bg-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${
                        form.isActive
                          ? 'translate-x-5 bg-zinc-950'
                          : 'translate-x-0 bg-zinc-300'
                      }`}
                    />
                  </button>
                </div>
              )}
            </fieldset>

            <div className="flex items-start gap-3 rounded-xl border border-lime-300/10 bg-lime-300/5 p-3.5">
              <Info
                size={17}
                className="mt-0.5 shrink-0 text-lime-300"
                aria-hidden="true"
              />

              <p className="text-xs leading-relaxed text-zinc-400">
                {editingService
                  ? 'Changes to this price do not change existing subscription fees. Deactivating this service does not stop existing member billing.'
                  : 'New services are created as active and become available when assigning subscriptions.'}
              </p>
            </div>
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
                ) : editingService ? (
                  <Save size={17} aria-hidden="true" />
                ) : (
                  <Plus size={17} aria-hidden="true" />
                )}

                {saving
                  ? 'Saving...'
                  : editingService
                    ? 'Save changes'
                    : 'Create service'}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </section>
  );
}

export default Services;