import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Link } from 'react-router-dom';

import {
  Users,
  Dumbbell,
  CalendarDays,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  Receipt,
  UserPlus,
  CreditCard,
  BarChart3,
  Clock,
  CheckCircle2,
} from 'lucide-react';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

import dashboardService, {
  pakistanDate,
} from '../services/dashboardService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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
    ...(includeTime
      ? { hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric' }),
  }).format(date);
}

function monthLabel(month) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T00:00:00+05:00`));
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

function compactNumber(value) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

const errorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'Unable to load dashboard data.';

// ─────────────────────────────────────────────
// Tailwind classes
// ─────────────────────────────────────────────

const focusClass =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-lime-300 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[#14191e]';

const panelClass =
  'min-w-0 overflow-hidden rounded-2xl border border-white/10 ' +
  'bg-[#14191e]';

const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 ' +
  'rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 ' +
  'text-sm font-medium text-zinc-200 transition hover:bg-white/10 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  focusClass;

// ─────────────────────────────────────────────
// Small shared components
// ─────────────────────────────────────────────

function EmptyState({ text }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center">
      <BarChart3
        size={28}
        className="text-zinc-600"
        aria-hidden="true"
      />

      <p className="mt-3 max-w-xs text-xs leading-relaxed text-zinc-500">
        {text}
      </p>
    </div>
  );
}

function PanelHeading({ title, description, to, linkText = 'View all' }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-white">
          {title}
        </h3>

        {description && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
            {description}
          </p>
        )}
      </div>

      {to && (
        <Link
          to={to}
          className={`inline-flex shrink-0 items-center gap-1 rounded text-[11px] font-semibold text-lime-300 hover:text-lime-200 ${focusClass}`}
        >
          {linkText}
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function CashTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;

  const date = payload[0]?.payload?.date;

  return (
    <div className="rounded-xl border border-white/15 bg-[#10151a] p-3 shadow-xl">
      <p className="mb-2 text-xs font-semibold text-zinc-300">
        {date ? displayDate(date) : label}
      </p>

      {payload.map((item) => (
        <p
          key={item.dataKey}
          className="mt-1 text-xs text-zinc-300"
        >
          {item.name}:{' '}
          <span className="font-semibold text-white">
            {currency}{' '}
            {Number(item.value || 0).toLocaleString('en-PK', {
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
      ))}
    </div>
  );
}

function CategoryTooltip({ active, payload, money }) {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;

  return (
    <div className="max-w-xs rounded-xl border border-white/15 bg-[#10151a] p-3 shadow-xl">
      <p className="break-words text-xs text-zinc-300">
        {row.category}
      </p>

      <p className="mt-1 text-sm font-bold text-amber-300">
        {money(row.amount)}
      </p>
    </div>
  );
}

function InvoiceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const row = payload[0];

  return (
    <div className="rounded-xl border border-white/15 bg-[#10151a] p-3 text-xs text-zinc-200 shadow-xl">
      {row.name}: <strong>{row.value}</strong> invoice(s)
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────

function Dashboard() {
  const [month, setMonth] = useState(() =>
    pakistanDate().slice(0, 7)
  );

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const initialMonthRef = useRef(month);

  const loadDashboard = useCallback(async (selectedMonth) => {
    const requestId = ++requestRef.current;

    setLoading(true);
    setError('');

    try {
      const result =
        await dashboardService.getDashboardData(selectedMonth);

      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setData(result);
      }
    } catch (requestError) {
      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setError(errorMessage(requestError));
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
    loadDashboard(initialMonthRef.current);

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadDashboard]);

  function changeMonth(value) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;

    setMonth(value);
    loadDashboard(value);
  }

  const report = data?.report;
  const current = report?.current || {};
  const currency = report?.currency || 'PKR';

  const money = (value) =>
    `${currency} ${Number(value || 0).toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  const invoiceCount = data
    ? data.invoiceStatus.reduce((total, item) => total + item.value, 0)
    : 0;

  const hasCashActivity = Boolean(
    report &&
    (
      Number(report.paymentsCount) > 0 ||
      Number(report.expensesCount) > 0
    )
  );

  const snapshotCards = [
    {
      label: 'Total members',
      value: current.totalMembers ?? 0,
      caption: 'Registered members',
      icon: Users,
      color: 'text-sky-300 border-sky-300/15 bg-sky-300/10',
      to: '/members',
    },
    {
      label: 'Active subscriptions',
      value: current.activeSubscriptions ?? 0,
      caption: 'Started and currently active',
      icon: CalendarDays,
      color: 'text-lime-300 border-lime-300/15 bg-lime-300/10',
      to: '/subscriptions',
    },
    {
      label: 'Available services',
      value: data?.activeServices ?? 0,
      caption: `${data?.totalServices ?? 0} services in total`,
      icon: Dumbbell,
      color: 'text-violet-300 border-violet-300/15 bg-violet-300/10',
      to: '/services',
    },
  ];

  return (
    <section
      className="min-w-0 space-y-6 text-zinc-100"
      aria-label="Gym dashboard"
      aria-busy={loading}
    >
      {/* Dashboard toolbar */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
    
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#14191e] px-3">
            <CalendarDays
              size={17}
              className="text-zinc-500"
              aria-hidden="true"
            />

            <input
              type="month"
              value={month}
              min="2000-01"
              max="2100-12"
              onChange={(event) => changeMonth(event.target.value)}
              aria-label="Dashboard financial month"
              className="min-w-0 bg-transparent py-2.5 text-sm text-zinc-200 outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-lime-300"
            />
          </div>

          <button
            type="button"
            onClick={() => loadDashboard(month)}
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
      </div>

      {/* Error state */}
      {error && (
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
            <p>{error}</p>

            {data && (
              <p className="mt-1 text-xs">
                Previously loaded figures for {monthLabel(data.month)}
                {' '}remain displayed.
              </p>
            )}
          </div>
        </div>
      )}

      {loading && !data && (
        <div
          role="status"
          className={`${panelClass} flex min-h-72 flex-col items-center justify-center gap-4 p-8`}
        >
          <Loader2
            size={34}
            className="animate-spin text-lime-300 motion-reduce:animate-none"
            aria-hidden="true"
          />

          <p className="text-sm text-zinc-400">
            Preparing your gym overview...
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Current operational counts */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {snapshotCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.label}
                  to={card.to}
                  className={`${panelClass} group block p-5 transition hover:border-lime-300/25 ${focusClass}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-400">
                      {card.label}
                    </span>

                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${card.color}`}
                    >
                      <Icon size={20} aria-hidden="true" />
                    </div>
                  </div>

                  <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-white">
                    {card.value}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-500">
                      {card.caption}
                    </p>

                    <ArrowUpRight
                      size={16}
                      className="text-zinc-600 group-hover:text-lime-300"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Financial period label */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-200">
              {monthLabel(data.month)} · Cash overview
            </h3>

            <p className="text-[10px] text-zinc-500">
              Loaded {displayDate(report.generatedAt, true)} · Pakistan time
            </p>
          </div>

          {/* Financial cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              {
                label: 'Income received',
                amount: report.totalIncome,
                note: `${report.paymentsCount} receipt(s) in this month`,
                icon: TrendingUp,
                color: 'text-lime-300',
                background: 'border-lime-300/20 bg-lime-300/10',
              },
              {
                label: 'Recorded expenses',
                amount: report.totalExpenses,
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
                amount: report.netProfit,
                note: 'Received income minus recorded expenses',
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
            ].map((card) => {
              const Icon = card.icon;

              return (
                <div key={card.label} className={`${panelClass} p-5`}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-zinc-400">{card.label}</p>

                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${card.background} ${card.color}`}
                    >
                      <Icon size={19} aria-hidden="true" />
                    </span>
                  </div>

                  <p
                    className={`mt-5 break-words text-2xl font-bold tabular-nums tracking-tight ${card.color}`}
                  >
                    {money(card.amount)}
                  </p>

                  <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                    {card.note}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Main charts */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Daily cash */}
            <section
              className={`${panelClass} xl:col-span-2`}
              aria-label="Daily income and expense graph"
            >
              <PanelHeading
                title="Cash activity"
                description={`Daily receipts and expenses · ${monthLabel(data.month)} · ${currency}`}
                to="/reports"
                linkText="Reports"
              />

              <div className="flex flex-wrap gap-4 px-5 pt-4 text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-lime-300" />
                  Income
                </span>

                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Expenses
                </span>
              </div>

              {hasCashActivity ? (
                <div className="h-72 min-w-0 px-2 pb-3 pt-5 sm:h-80 sm:px-4">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart
                      data={data.dailyCash}
                      margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
                      accessibilityLayer
                    >
                      <CartesianGrid
                        stroke="#26303a"
                        strokeDasharray="3 5"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#87939f', fontSize: 10 }}
                        minTickGap={18}
                        dy={8}
                      />

                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#87939f', fontSize: 10 }}
                        tickFormatter={compactNumber}
                        width={48}
                        domain={[0, 'auto']}
                      />

                      <Tooltip
                        content={<CashTooltip currency={currency} />}
                        cursor={{ stroke: '#52606d', strokeDasharray: '4 4' }}
                      />

                      <Area
                        type="linear"
                        dataKey="income"
                        name="Income"
                        stroke="#bef264"
                        fill="#bef264"
                        fillOpacity={0.1}
                        strokeWidth={2.5}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                        connectNulls={false}
                      />

                      <Area
                        type="linear"
                        dataKey="expenses"
                        name="Expenses"
                        stroke="#fbbf24"
                        fill="#fbbf24"
                        fillOpacity={0.05}
                        strokeWidth={2}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="No receipts or expenses recorded for this month yet." />
              )}

              <p className="border-t border-white/5 px-5 py-3 text-[10px] leading-relaxed text-zinc-500">
                Receipts use the actual received date. Future dates are left blank.
              </p>
            </section>

            {/* Invoice donut */}
            <section
              className={panelClass}
              aria-label="Invoice payment status"
            >
              <PanelHeading
                title="Invoice status"
                description="Current status of invoices whose billing period starts in the selected month."
              />

              {invoiceCount > 0 ? (
                <>
                  <div className="relative h-56 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie
                          data={data.invoiceStatus.filter((item) => item.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={62}
                          outerRadius={83}
                          paddingAngle={3}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {data.invoiceStatus
                            .filter((item) => item.value > 0)
                            .map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                        </Pie>

                        <Tooltip content={<InvoiceTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-3xl font-bold text-white">
                        {invoiceCount}
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Invoices
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 px-5 pb-5">
                    {data.invoiceStatus.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2 text-zinc-400">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              index === 0
                                ? 'bg-lime-300'
                                : index === 1
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                            }`}
                          />
                          {item.name}
                        </span>

                        <span className="font-semibold tabular-nums text-zinc-100">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState text="No invoices issued for this billing month." />
              )}
            </section>
          </div>

          {/* Current balances and quick actions */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section className={`${panelClass} p-5 xl:col-span-2`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                    Current outstanding
                  </p>

                  <p className="mt-3 break-words text-3xl font-bold tracking-tight text-white">
                    {money(current.outstandingBalance)}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    {current.outstandingInvoicesCount ?? 0} unpaid invoice(s)
                    {' · '}
                    {data.pendingMembers.length} member(s)
                  </p>
                </div>

                <Link
                  to="/payments"
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl bg-lime-300 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-lime-200 ${focusClass}`}
                >
                  <CreditCard size={16} aria-hidden="true" />
                  Open payments
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-zinc-500">
                    Before the current calendar month
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-amber-300">
                    {money(current.previousMonthsDue)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-zinc-500">
                    Legacy balance without a verified month
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-zinc-300">
                    {money(current.legacyUnallocatedDue)}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[10px] leading-relaxed text-zinc-500">
                All balances are current as of {displayDate(current.asOf || report.generatedAt, true)}.
                They are not limited to the selected financial month.
              </p>
            </section>

            <section className={panelClass}>
              <PanelHeading
                title="Quick actions"
                description="Go straight to the work that matters."
              />

              <div className="grid grid-cols-2 gap-3 p-5">
                {[
                  ['/members', 'Members', UserPlus],
                  ['/subscriptions', 'Subscriptions', CalendarDays],
                  ['/expenses', 'Expenses', Wallet],
                  ['/reports', 'Reports & PDF', BarChart3],
                ].map(([to, label, Icon]) => (
                  <Link
                    key={to}
                    to={to}
                    className={`group rounded-xl border border-white/10 bg-[#10151a] p-4 transition hover:border-lime-300/25 hover:bg-lime-300/5 ${focusClass}`}
                  >
                    <Icon
                      size={20}
                      className="text-zinc-400 group-hover:text-lime-300"
                      aria-hidden="true"
                    />

                    <p className="mt-3 text-[11px] font-semibold text-zinc-300">
                      {label}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Expenses and debtors */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className={panelClass} aria-label="Expense category chart">
              <PanelHeading
                title="Where the money goes"
                description={`Top six expense categories · ${monthLabel(data.month)} · ${currency}`}
                to="/expenses"
                linkText="Expenses"
              />

              {data.expenseCategories.length ? (
                <div className="h-72 min-w-0 px-2 pb-4 pt-5">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart
                      data={data.expenseCategories}
                      layout="vertical"
                      margin={{ top: 5, right: 24, bottom: 5, left: 0 }}
                      accessibilityLayer
                    >
                      <CartesianGrid
                        stroke="#26303a"
                        strokeDasharray="3 5"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#87939f', fontSize: 10 }}
                        tickFormatter={compactNumber}
                      />

                      <YAxis
                        type="category"
                        dataKey="category"
                        axisLine={false}
                        tickLine={false}
                        width={110}
                        tick={{ fill: '#a1abb6', fontSize: 10 }}
                        tickFormatter={(value) =>
                          value.length > 16
                            ? `${value.slice(0, 16)}…`
                            : value
                        }
                      />

                      <Tooltip
                        content={<CategoryTooltip money={money} />}
                        cursor={false}
                      />

                      <Bar
                        dataKey="amount"
                        name="Expenses"
                        fill="#fbbf24"
                        radius={[0, 5, 5, 0]}
                        maxBarSize={22}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="No expenses recorded in the selected month." />
              )}
            </section>

            <section className={panelClass}>
              <PanelHeading
                title="Members with outstanding dues"
                description="Top five by current unpaid balance across all months."
                to="/payments"
                linkText="Payments"
              />

              {data.pendingMembers.length ? (
                <div className="divide-y divide-white/5 px-5 py-2">
                  {data.pendingMembers.slice(0, 5).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-4 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/15 bg-amber-300/5 text-[10px] font-bold text-amber-300">
                          {initials(member.name)}
                        </div>

                        <div className="min-w-0">
                          <p className="break-words text-xs font-semibold text-zinc-200">
                            {member.name}
                          </p>

                          <p className="mt-1 text-[10px] text-zinc-500">
                            {member.invoiceCount} pending invoice(s)
                          </p>
                        </div>
                      </div>

                      <p className="shrink-0 text-xs font-bold tabular-nums text-amber-300">
                        {money(member.balance)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
                  <CheckCircle2
                    size={31}
                    className="text-lime-300"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm text-zinc-300">
                    No outstanding balances.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Receipts and members */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className={panelClass}>
              <PanelHeading
                title="Recent receipts"
                description={`Latest five payments received in ${monthLabel(data.month)}.`}
                to="/payments"
              />

              {data.recentReceipts.length ? (
                <div className="divide-y divide-white/5 px-5 py-2">
                  {data.recentReceipts.map((receipt) => (
                    <div
                      key={receipt._id || receipt.receiptNumber}
                      className="flex items-start justify-between gap-4 py-4"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-300/10 text-lime-300">
                          <Receipt size={16} aria-hidden="true" />
                        </div>

                        <div className="min-w-0">
                          <p className="break-words text-xs font-semibold text-zinc-200">
                            {receipt.member?.fullName || 'Member unavailable'}
                          </p>

                          <p className="mt-1 text-[10px] text-zinc-500">
                            {displayDate(receipt.receivedAt, true)}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-lime-300">
                          {money(receipt.amount)}
                        </p>

                        <p className="mt-1 text-[10px] capitalize text-zinc-500">
                          {receipt.method}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No receipts recorded for this month." />
              )}
            </section>

            <section className={panelClass}>
              <PanelHeading
                title="Latest members"
                description="Five most recently created member profiles, across all dates."
                to="/members"
              />

              {data.recentMembers.length ? (
                <div className="divide-y divide-white/5 px-5 py-2">
                  {data.recentMembers.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center justify-between gap-4 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[10px] font-bold text-zinc-300">
                          {initials(member.fullName)}
                        </div>

                        <div className="min-w-0">
                          <p className="break-words text-xs font-semibold text-zinc-200">
                            {member.fullName}
                          </p>

                          <p className="mt-1 text-[10px] text-zinc-500">
                            {member.phone || 'No phone'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-zinc-500">
                          Registered
                        </p>

                        <p className="mt-1 text-[10px] text-zinc-300">
                          {displayDate(member.registrationDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No members registered yet." />
              )}
            </section>
          </div>

          {/* Scope note */}
          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <Clock
              size={17}
              className="mt-0.5 shrink-0 text-zinc-500"
              aria-hidden="true"
            />

            <div className="space-y-2 text-[11px] leading-relaxed text-zinc-500">
              <p>
                Financial charts follow the selected month.
                Membership counts and outstanding balances show the
                current state. Income includes payments received this
                month against older invoices.
              </p>

              {Number(report.historicalReceivedWithoutDates) > 0 && (
                <p className="text-amber-200">
                  Historical receipts without installment dates:
                  {' '}
                  {money(report.historicalReceivedWithoutDates)}.
                  These are excluded from monthly income.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default Dashboard;