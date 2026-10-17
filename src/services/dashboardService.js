import memberService from './memberService';
import serviceService from './serviceService';
import reportService from './reportService';

export function pakistanDate(value = new Date()) {
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

export function getMonthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Select a valid month');
  }

  const [year, monthNumber] = month.split('-').map(Number);

  if (year < 2000 || year > 2100) {
    throw new Error('Select a month between 2000 and 2100');
  }

  const lastDay = new Date(
    Date.UTC(year, monthNumber, 0)
  ).getUTCDate();

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function buildDailyCash(report) {
  const start = new Date(`${report.period.startDate}T00:00:00Z`);
  const end = new Date(`${report.period.endDate}T00:00:00Z`);

  const days = new Map();

  for (
    let date = new Date(start);
    date <= end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const key = date.toISOString().slice(0, 10);

    days.set(key, {
      date: key,
      day: key.slice(8),
      incomeCents: 0,
      expenseCents: 0,
    });
  }

  for (const receipt of report.receipts || []) {
    const day = days.get(pakistanDate(receipt.receivedAt));

    if (day) {
      day.incomeCents += Math.round(Number(receipt.amount) * 100);
    }
  }

  for (const expense of report.expenses || []) {
    const day = days.get(pakistanDate(expense.date));

    if (day) {
      day.expenseCents += Math.round(Number(expense.amount) * 100);
    }
  }

  const today = pakistanDate();

  return [...days.values()].map((day) => {
    const future = day.date > today;

    return {
      date: day.date,
      day: day.day,

      // Future dates remain gaps rather than appearing as actual cash.
      income: future ? null : day.incomeCents / 100,
      expenses: future ? null : day.expenseCents / 100,
    };
  });
}

function buildPendingMembers(invoices) {
  const groups = new Map();

  for (const invoice of invoices) {
    const member =
      typeof invoice.memberId === 'object' && invoice.memberId
        ? invoice.memberId
        : {};

    const key = String(
      member._id || invoice.memberId || invoice._id
    );

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: member.fullName || 'Member unavailable',
        phone: member.phone || '',
        invoiceCount: 0,
        balanceCents: 0,
      });
    }

    const group = groups.get(key);

    group.invoiceCount += 1;
    group.balanceCents += Math.round(
      Number(invoice.remainingBalance || 0) * 100
    );
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      balance: group.balanceCents / 100,
    }))
    .sort((a, b) => b.balance - a.balance);
}

const dashboardService = {
  async getDashboardData(month) {
    const range = getMonthRange(month);

    const [report, members, services] = await Promise.all([
      reportService.getSummary(range),
      memberService.getMembers(),
      serviceService.getServices(),
    ]);

    const statusCounts = report.invoiceStatusCounts || {};

    const invoiceStatus = [
      {
        name: 'Paid',
        value: statusCounts.paid || 0,
        color: '#bef264',
      },
      {
        name: 'Partial',
        value: statusCounts.partial || 0,
        color: '#fbbf24',
      },
      {
        name: 'Pending',
        value: statusCounts.unpaid || 0,
        color: '#fb7185',
      },
    ];

    const pendingMembers = buildPendingMembers(
      report.outstandingInvoices || []
    );

    const recentReceipts = [...(report.receipts || [])]
      .sort(
        (a, b) =>
          new Date(b.receivedAt) - new Date(a.receivedAt)
      )
      .slice(0, 5);

    const recentMembers = [...members]
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.registrationDate) -
          new Date(a.createdAt || a.registrationDate)
      )
      .slice(0, 5);

    const expenseCategories = [
      ...(report.expensesByCategory || []),
    ]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    return {
      month,
      report,
      dailyCash: buildDailyCash(report),
      invoiceStatus,
      expenseCategories,
      pendingMembers,
      recentReceipts,
      recentMembers,

      totalServices: services.length,
      activeServices: services.filter(
        (service) => service.isActive !== false
      ).length,
    };
  },
};

export default dashboardService;