export const navigationGroups = [
  {
    label: 'Workspace',
    items: [
      {
        label: 'Dashboard',
        path: '/',
        icon: 'dashboard',
        title: 'A stronger gym starts here.',
        description:
          'Your members, collections and daily priorities in one place.',
      },
      {
        label: 'Members',
        path: '/members',
        icon: 'members',
        title: 'Built around your members.',
        description:
          'Manage member profiles, contact details and account history.',
      },
      {
        label: 'Services & Fees',
        path: '/services',
        icon: 'services',
        title: 'Great training starts here.',
        description:
          'Organize your gym services, training options and pricing.',
      },
      {
        label: 'Subscriptions',
        path: '/subscriptions',
        icon: 'subscriptions',
        title: 'Keep every member moving.',
        description:
          'Manage memberships, monthly plans and subscription activity.',
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        label: 'Payments & Invoices',
        path: '/payments',
        icon: 'payments',
        title: 'Every payment. In focus.',
        description:
          'Track monthly invoices, collect payments and review pending dues.',
      },
      {
        label: 'Expenses',
        path: '/expenses',
        icon: 'expenses',
        title: 'Stay in control of spending.',
        description:
          'Record operating costs and keep your gym expenses organized.',
      },
      {
        label: 'Reports & Profit',
        path: '/reports',
        icon: 'reports',
        title: 'Know your numbers.',
        description:
          'Review collections, expenses and financial performance.',
      },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap(
  (group) => group.items
);

export function isNavigationActive(pathname, path) {
  if (path === '/') {
    return pathname === '/';
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

export function getPageDetails(pathname) {
  return (
    navigationItems.find((item) =>
      isNavigationActive(pathname, item.path)
    ) || {
      label: 'Workspace',
      title: 'Your gym workspace.',
      description: 'Everything you need to manage your gym.',
      icon: 'dashboard',
    }
  );
}