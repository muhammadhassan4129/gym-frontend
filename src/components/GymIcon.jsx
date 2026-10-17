import React from 'react';

const paths = {
  dumbbell: [
    'm6.5 6.5 11 11',
    'm4 9 5-5',
    'm15 20 5-5',
    'm2 7 5-5',
    'm17 22 5-5',
    'm3 8 5-5',
    'm16 21 5-5',
  ],

  dashboard: [
    'M3 3h7v7H3z',
    'M14 3h7v7h-7z',
    'M3 14h7v7H3z',
    'M14 14h7v7h-7z',
  ],

  members: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M16 3a4 4 0 0 1 0 8',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  ],

  services: [
    'M4 7h16',
    'M4 17h16',
    'M7 4v6',
    'M17 14v6',
    'M4 12h16',
  ],

  subscriptions: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
    'm9 16 2 2 4-4',
  ],

  payments: [
    'M4 3h16v18l-4-2-4 2-4-2-4 2V3',
    'M8 7h8',
    'M8 11h8',
    'M8 15h4',
  ],

  expenses: [
    'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6',
    'M20 12h-4v4h4',
  ],

  reports: [
    'M3 3v18h18',
    'M7 16v-5',
    'M12 16V7',
    'M17 16v-8',
  ],

  menu: [
    'M4 6h16',
    'M4 12h16',
    'M4 18h16',
  ],

  close: [
    'm6 6 12 12',
    'M18 6 6 18',
  ],

  chevron: [
    'm9 5 7 7-7 7',
  ],

  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  ],

  arrow: [
    'M7 17 17 7',
    'M7 7h10v10',
  ],
};

function GymIcon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className = '',
  ...props
}) {
  const iconPaths = paths[name] || paths.dumbbell;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {iconPaths.map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}

export default GymIcon;