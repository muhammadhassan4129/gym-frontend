import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  BarChart3,
  Download,
  CalendarDays,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Users,
  Info,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

import reportService from '../services/reportService';

// ─────────────────────────────────────────────
// Date helpers
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

function monthRange(offset = 0) {
  const [year, month] = pakistanDate().split('-').map(Number);

  const start = new Date(Date.UTC(year, month - 1 + offset, 1));
  const end = new Date(Date.UTC(year, month + offset, 0));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function displayDate(value, includeTime = false) {
  if (!value) return '—';

  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00+05:00`
      : value;

  const date = new Date(normalized);

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

function validateRange(range) {
  for (const [key, label] of [
    ['startDate', 'Start date'],
    ['endDate', 'End date'],
  ]) {
    const value = range[key];
    const parsed = new Date(`${value}T00:00:00+05:00`);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(parsed.getTime()) ||
      pakistanDate(parsed) !== value
    ) {
      return `${label} is required and must be valid.`;
    }
  }

  if (range.startDate > range.endDate) {
    return 'End date must be on or after start date.';
  }

  return '';
}

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'Something went wrong. Please try again.';

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
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  focusClass;

const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 ' +
  'rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 ' +
  'text-sm font-medium text-zinc-200 transition hover:bg-white/10 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  focusClass;

const inputClass =
  'min-h-11 w-full min-w-0 rounded-xl border border-white/10 ' +
  'bg-[#0d1217] px-3.5 py-3 text-sm text-zinc-100 outline-none ' +
  'focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/10 ' +
  'disabled:opacity-50 [color-scheme:dark]';

const panelClass =
  'overflow-hidden rounded-2xl border border-white/10 bg-[#14191e]';

// ─────────────────────────────────────────────
// Reusable table with client-side pagination
// ─────────────────────────────────────────────

function ReportTable({
  title,
  description,
  columns,
  rows,
  emptyMessage = 'No records in this period.',
}) {
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  const visibleRows = rows.slice(start, start + pageSize);

  return (
    <section className={panelClass} aria-label={title}>
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>

          <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-400">
            {rows.length}
          </span>
        </div>

        {description && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            {description}
          </p>
        )}
      </div>

      <div
        role="region"
        aria-label={`${title} table`}
        tabIndex={0}
        className={`overflow-x-auto ${focusClass}`}
      >
        <table className="w-full min-w-[560px] border-collapse text-left">
          <caption className="sr-only">{title}</caption>

          <thead className="border-b border-white/10 bg-white/[0.02]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ${
                    column.right ? 'text-right' : ''
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {!rows.length ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-12 text-center text-sm text-zinc-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr
                  key={row._id || row.receiptNumber || start + index}
                  className="hover:bg-white/[0.02]"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-5 py-4 text-xs leading-relaxed text-zinc-300 align-top ${
                        column.right
                          ? 'whitespace-nowrap text-right tabular-nums'
                          : ''
                      }`}
                    >
                      {column.render
                        ? column.render(row)
                        : row[column.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <p className="text-xs text-zinc-500" aria-live="polite">
            {start + 1}–{Math.min(start + pageSize, rows.length)}
            {' '}of {rows.length}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label={`Previous ${title} page`}
              className={`rounded-lg border border-white/10 p-2 disabled:opacity-30 ${focusClass}`}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            <span className="text-xs text-zinc-400">
              {currentPage}/{totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label={`Next ${title} page`}
              className={`rounded-lg border border-white/10 p-2 disabled:opacity-30 ${focusClass}`}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// Reports page
// ─────────────────────────────────────────────

function Reports() {
  const [draftRange, setDraftRange] = useState(() => monthRange());

  const [report, setReport] = useState(null);
  const [reportVersion, setReportVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [filterError, setFilterError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [notice, setNotice] = useState('');

  const [detailsTab, setDetailsTab] = useState('receipts');

  const initialRangeRef = useRef(draftRange);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const downloadLockRef = useRef(false);

  const loadReport = useCallback(async (range) => {
    const validationError = validateRange(range);

    if (validationError) {
      setFilterError(validationError);
      return;
    }

    const requestId = ++requestRef.current;

    setFilterError('');
    setLoadError('');
    setDownloadError('');
    setNotice('');
    setLoading(true);

    try {
      const data = await reportService.getSummary(range);

      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setReport(data);
        setReportVersion((previous) => previous + 1);
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
    loadReport(initialRangeRef.current);

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadReport]);

  function applyPreset(type) {
    let range;

    if (type === 'today') {
      const today = pakistanDate();
      range = { startDate: today, endDate: today };
    } else {
      range = monthRange(type === 'last-month' ? -1 : 0);
    }

    setDraftRange(range);
    loadReport(range);
  }

  function handleGenerate(event) {
    event.preventDefault();
    loadReport({ ...draftRange });
  }

  async function handleDownload() {
    if (!report || loading || downloadLockRef.current) return;

    downloadLockRef.current = true;
    setDownloading(true);
    setDownloadError('');
    setNotice('');

    // Export the displayed report period, not unsubmitted inputs.
    const range = {
      startDate: report.period.startDate,
      endDate: report.period.endDate,
    };

    let objectUrl = null;
    let anchor = null;

    try {
      const blob = await reportService.downloadPdf(range);

      if (!mountedRef.current) return;

      objectUrl = window.URL.createObjectURL(blob);

      anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download =
        `gym-report-${range.startDate}-to-${range.endDate}.pdf`;

      document.body.appendChild(anchor);
      anchor.click();

      setNotice('PDF download started.');
    } catch (error) {
      if (mountedRef.current) {
        setDownloadError(errorMessage(error));
      }
    } finally {
      anchor?.remove();

      if (objectUrl) {
        const urlToRelease = objectUrl;

        window.setTimeout(() => {
          window.URL.revokeObjectURL(urlToRelease);
        }, 30_000);
      }

      downloadLockRef.current = false;

      if (mountedRef.current) {
        setDownloading(false);
      }
    }
  }

  const currency = report?.currency || 'PKR';

  const money = (value) =>
    `${currency} ${Number(value || 0).toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  const hasUnappliedDates =
    report &&
    (
      draftRange.startDate !== report.period.startDate ||
      draftRange.endDate !== report.period.endDate
    );

  const current = report?.current || {};

  const receipts = report?.receipts || [];
  const expenses = report?.expenses || [];
  const outstanding = report?.outstandingInvoices || [];

  const details = {
    receipts: {
      title: 'Receipt details',
      description:
        'Money received during the selected period, including payments against older invoices.',
      rows: receipts,
      columns: [
        {
          key: 'date',
          label: 'Received',
          render: (row) => displayDate(row.receivedAt, true),
        },
        {
          key: 'member',
          label: 'Member / receipt',
          render: (row) => (
            <div className="max-w-[260px]">
              <p className="font-medium text-zinc-100">
                {row.member?.fullName || 'Member unavailable'}
              </p>

              <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">
                {row.receiptNumber}
              </p>

              <p className="mt-1 break-all text-[10px] text-zinc-500">
                {row.invoiceNumber}
              </p>
            </div>
          ),
        },
        {
          key: 'method',
          label: 'Method',
          render: (row) => (
            <span className="capitalize">{row.method}</span>
          ),
        },
        {
          key: 'amount',
          label: 'Amount',
          right: true,
          render: (row) => (
            <span className="font-semibold text-lime-300">
              {money(row.amount)}
            </span>
          ),
        },
      ],
    },

    expenses: {
      title: 'Expense details',
      description:
        'Expense records dated within the selected period.',
      rows: expenses,
      columns: [
        {
          key: 'date',
          label: 'Date',
          render: (row) => displayDate(row.date),
        },
        { key: 'category', label: 'Category' },
        {
          key: 'description',
          label: 'Description',
          render: (row) => (
            <p className="max-w-sm whitespace-pre-wrap break-words text-zinc-400">
              {row.description || '—'}
            </p>
          ),
        },
        {
          key: 'amount',
          label: 'Amount',
          right: true,
          render: (row) => (
            <span className="font-semibold text-amber-300">
              {money(row.amount)}
            </span>
          ),
        },
      ],
    },

    outstanding: {
      title: 'Current pending invoices',
      description:
        'All outstanding invoices at report generation time. This list is not restricted to the selected date range.',
      rows: outstanding,
      columns: [
        {
          key: 'member',
          label: 'Member / invoice',
          render: (row) => (
            <div className="max-w-[270px]">
              <p className="font-medium text-zinc-100">
                {row.memberId?.fullName || 'Member unavailable'}
              </p>

              <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">
                {row.invoiceNumber}
              </p>
            </div>
          ),
        },
        {
          key: 'billingMonth',
          label: 'Billing month',
          render: (row) => row.billingMonth || 'Legacy / unallocated',
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <span className="capitalize">
              {row.status === 'unpaid' ? 'Pending' : row.status}
            </span>
          ),
        },
        {
          key: 'balance',
          label: 'Balance',
          right: true,
          render: (row) => (
            <span className="font-semibold text-amber-300">
              {money(row.remainingBalance)}
            </span>
          ),
        },
      ],
    },
  };

  const selectedDetails = details[detailsTab];

  return (
    <section
      className="min-w-0 space-y-5 text-zinc-100"
      aria-label="Financial reports"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300">
            <BarChart3 size={24} aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Financial reports
            </h2>

            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Collections, costs and outstanding balances.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={!report || loading || downloading}
          className={primaryButtonClass}
        >
          {downloading ? (
            <Loader2
              size={17}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Download size={17} aria-hidden="true" />
          )}

          {downloading ? 'Preparing PDF...' : 'Download PDF'}
        </button>
      </div>

      {/* Date filters */}
      <div className={`${panelClass} p-4 sm:p-5`}>
        <div
          className="mb-5 flex flex-wrap gap-2"
          role="group"
          aria-label="Date range shortcuts"
        >
          {[
            ['today', 'Today'],
            ['this-month', 'This month'],
            ['last-month', 'Last month'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyPreset(value)}
              disabled={loading || downloading}
              className={`rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-lime-300/30 hover:text-lime-300 disabled:opacity-40 ${focusClass}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleGenerate}
          noValidate
          className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <div>
            <label
              htmlFor="report-start-date"
              className="mb-2 block text-xs font-semibold text-zinc-300"
            >
              Start date
            </label>

            <input
              id="report-start-date"
              type="date"
              value={draftRange.startDate}
              disabled={loading || downloading}
              onChange={(event) => {
                setDraftRange((previous) => ({
                  ...previous,
                  startDate: event.target.value,
                }));
                setFilterError('');
              }}
              className={inputClass}
              required
              aria-describedby={filterError ? 'report-filter-error' : undefined}
            />
          </div>

          <div>
            <label
              htmlFor="report-end-date"
              className="mb-2 block text-xs font-semibold text-zinc-300"
            >
              End date
            </label>

            <input
              id="report-end-date"
              type="date"
              value={draftRange.endDate}
              min={draftRange.startDate || undefined}
              disabled={loading || downloading}
              onChange={(event) => {
                setDraftRange((previous) => ({
                  ...previous,
                  endDate: event.target.value,
                }));
                setFilterError('');
              }}
              className={inputClass}
              required
              aria-describedby={filterError ? 'report-filter-error' : undefined}
            />
          </div>

          <button
            type="submit"
            disabled={loading || downloading}
            className={`${secondaryButtonClass} sm:col-span-2 xl:col-span-1`}
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

            {loading ? 'Generating...' : 'Generate report'}
          </button>
        </form>

        {filterError && (
          <p
            id="report-filter-error"
            role="alert"
            className="mt-3 text-xs text-red-300"
          >
            {filterError}
          </p>
        )}

        {hasUnappliedDates && (
          <p className="mt-3 text-xs text-amber-300">
            Dates changed. Generate the report to apply them.
            PDF export uses the displayed report period.
          </p>
        )}
      </div>

      {/* Messages */}
      {(loadError || downloadError) && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-300/20 bg-red-300/5 p-4 text-sm text-red-200"
        >
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <div>
            {loadError && (
              <p>
                Report could not be refreshed: {loadError}
                {report && ' The previous report remains displayed.'}
              </p>
            )}

            {downloadError && (
              <p className={loadError ? 'mt-2' : ''}>
                PDF download failed: {downloadError}
              </p>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-lime-300/20 bg-lime-300/5 p-4 text-sm text-lime-200"
        >
          <CheckCircle2 size={18} aria-hidden="true" />
          <p className="flex-1">{notice}</p>

          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Dismiss download message"
            className={`rounded p-1 ${focusClass}`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {loading && !report && (
        <div
          role="status"
          className={`${panelClass} flex min-h-64 flex-col items-center justify-center gap-4 p-8`}
        >
          <Loader2
            size={32}
            className="animate-spin text-lime-300 motion-reduce:animate-none"
            aria-hidden="true"
          />

          <p className="text-sm text-zinc-400">
            Preparing your financial report...
          </p>
        </div>
      )}

      {report && (
        <div
          className="space-y-5"
          aria-busy={loading}
        >
          {/* Applied period */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <CalendarDays
                size={16}
                className="text-lime-300"
                aria-hidden="true"
              />

              <span>
                {displayDate(report.period.startDate)}
                {' — '}
                {displayDate(report.period.endDate)}
              </span>
            </div>

            <p className="text-[10px] text-zinc-500">
              Generated {displayDate(report.generatedAt, true)} · Pakistan time
            </p>
          </div>

          {/* Cash summary */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              {
                label: 'Income received',
                value: report.totalIncome,
                note: `${report.paymentsCount} receipt(s) in this period`,
                icon: TrendingUp,
                color: 'text-lime-300',
                background: 'border-lime-300/20 bg-lime-300/10',
              },
              {
                label: 'Recorded expenses',
                value: report.totalExpenses,
                note: `${report.expensesCount} expense record(s)`,
                icon: TrendingDown,
                color: 'text-amber-300',
                background: 'border-amber-300/20 bg-amber-300/10',
              },
              {
                label:
                  report.netProfit >= 0
                    ? 'Net cash surplus'
                    : 'Net cash deficit',
                value: report.netProfit,
                note: 'Income received minus recorded expenses',
                icon: Wallet,
                color:
                  report.netProfit >= 0
                    ? 'text-sky-300'
                    : 'text-red-300',
                background:
                  report.netProfit >= 0
                    ? 'border-sky-300/20 bg-sky-300/10'
                    : 'border-red-300/20 bg-red-300/10',
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className={`${panelClass} p-5`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-zinc-400">
                      {item.label}
                    </p>

                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${item.background} ${item.color}`}
                    >
                      <Icon size={19} aria-hidden="true" />
                    </div>
                  </div>

                  <p className={`mt-5 break-words text-2xl font-bold tabular-nums tracking-tight ${item.color}`}>
                    {money(item.value)}
                  </p>

                  <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                    {item.note}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Invoice billing summary */}
          <div className={`${panelClass} p-5`}>
            <div className="flex items-center gap-2">
              <Receipt
                size={18}
                className="text-lime-300"
                aria-hidden="true"
              />

              <h3 className="text-sm font-semibold">
                Invoices for the selected period
              </h3>
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              Based on invoice period start dates. Status counts reflect their current payment state.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-5">
              {[
                ['Total billed', money(report.totalBilled)],
                ['Invoices', report.invoicesCount ?? 0],
                ['Paid', report.invoiceStatusCounts?.paid ?? 0],
                ['Partial', report.invoiceStatusCounts?.partial ?? 0],
                ['Pending', report.invoiceStatusCounts?.unpaid ?? 0],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] text-zinc-500">{label}</p>
                  <p className="mt-2 break-words text-base font-semibold text-zinc-200">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly breakdown */}
          <ReportTable
            key={`monthly-${reportVersion}`}
            title="Monthly cash breakdown"
            description="Only activity within the selected date range is included. Partial-month selections show partial-month totals."
            rows={report.monthly || []}
            columns={[
              { key: 'month', label: 'Month' },
              {
                key: 'income',
                label: 'Income',
                right: true,
                render: (row) => (
                  <span className="text-lime-300">{money(row.income)}</span>
                ),
              },
              {
                key: 'expenses',
                label: 'Expenses',
                right: true,
                render: (row) => (
                  <span className="text-amber-300">{money(row.expenses)}</span>
                ),
              },
              {
                key: 'netProfit',
                label: 'Net cash',
                right: true,
                render: (row) => (
                  <span
                    className={
                      row.netProfit >= 0
                        ? 'text-sky-300'
                        : 'text-red-300'
                    }
                  >
                    {money(row.netProfit)}
                  </span>
                ),
              },
            ]}
          />

          {/* Breakdown lists */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              {
                title: 'Expenses by category',
                rows: report.expensesByCategory || [],
                label: 'category',
                color: 'text-amber-300',
              },
              {
                title: 'Income by payment method',
                rows: report.incomeByMethod || [],
                label: 'method',
                color: 'text-lime-300',
              },
            ].map((section) => (
              <section key={section.title} className={panelClass}>
                <h3 className="border-b border-white/10 px-5 py-4 text-sm font-semibold">
                  {section.title}
                </h3>

                <div className="divide-y divide-white/5">
                  {!section.rows.length && (
                    <p className="px-5 py-8 text-sm text-zinc-500">
                      No activity in this period.
                    </p>
                  )}

                  {section.rows.map((row) => (
                    <div
                      key={row[section.label]}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <span className="break-words text-xs capitalize text-zinc-300">
                        {row[section.label]}
                      </span>

                      <span className={`shrink-0 text-sm font-semibold ${section.color}`}>
                        {money(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Current snapshot */}
          <section className={`${panelClass} p-5`}>
            <div className="flex items-center gap-2">
              <Users
                size={18}
                className="text-lime-300"
                aria-hidden="true"
              />

              <h3 className="text-sm font-semibold">
                Current gym snapshot
              </h3>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              As of {displayDate(current.asOf || report.generatedAt, true)}.
              These figures are current balances and counts, not historical balances at the selected end date.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-3">
              {[
                ['Total members', current.totalMembers ?? 0],
                ['Active subscriptions', current.activeSubscriptions ?? 0],
                ['Pending invoices', current.outstandingInvoicesCount ?? 0],
                ['Total outstanding', money(current.outstandingBalance)],
                ['Previous months due', money(current.previousMonthsDue)],
                ['Legacy / unallocated dues', money(current.legacyUnallocatedDue)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    {label}
                  </p>

                  <p className="mt-2 break-words text-base font-semibold text-zinc-200">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Details selector */}
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Report details"
          >
            {[
              ['receipts', 'Receipts', receipts.length],
              ['expenses', 'Expenses', expenses.length],
              ['outstanding', 'Current pending', outstanding.length],
            ].map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDetailsTab(value)}
                aria-pressed={detailsTab === value}
                className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${focusClass} ${
                  detailsTab === value
                    ? 'border-lime-300/25 bg-lime-300/10 text-lime-300'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                {label}
                <span className="ml-2 opacity-60">{count}</span>
              </button>
            ))}
          </div>

          <ReportTable
            key={`${detailsTab}-${reportVersion}`}
            {...selectedDetails}
          />

          {/* Reporting notes */}
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <Info
              size={18}
              className="mt-0.5 shrink-0 text-lime-300"
              aria-hidden="true"
            />

            <div className="space-y-2 text-xs leading-relaxed text-zinc-400">
              <p>
                Income uses actual receipt dates; expenses use their
                recorded expense dates. Net cash is not an accrual
                accounting profit calculation.
              </p>

              {Number(report.historicalReceivedWithoutDates) > 0 && (
                <p className="text-amber-200">
                  Historical receipts without installment dates:
                  {' '}
                  {money(report.historicalReceivedWithoutDates)}.
                  This amount is excluded from date-filtered income.
                </p>
              )}

              <p>
                PDF export includes the complete detail lists, not
                just the visible table page. It generates a fresh
                report for the displayed dates, so changes made since
                the on-screen report was loaded can appear in the PDF.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Reports;