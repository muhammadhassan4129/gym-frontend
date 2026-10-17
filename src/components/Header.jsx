import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  Menu,
  ChevronRight,
  CalendarDays,
  LogOut,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  Users,
  SlidersHorizontal,
  Receipt,
  Wallet,
  BarChart3,
} from 'lucide-react';

import { getPageDetails } from './gymNavigation';

const pageIcons = {
  dashboard: LayoutDashboard,
  members: Users,
  services: SlidersHorizontal,
  subscriptions: CalendarDays,
  payments: Receipt,
  expenses: Wallet,
  reports: BarChart3,
};

const focusClass =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-lime-300 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[#0b0e11]';

function Header({
  onMenuClick,
  menuButtonRef,
  sidebarOpen = false,
  adminName = 'Gym Admin',
  onLogout,
}) {
  const { pathname } = useLocation();
  const page = getPageDetails(pathname);

  const [now, setNow] = useState(() => new Date());
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const logoutLockRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, []);

  const displayName =
    typeof adminName === 'string' && adminName.trim()
      ? adminName.trim()
      : 'Gym Admin';

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const PageIcon = pageIcons[page.icon] || LayoutDashboard;

  const dateText = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  const dayText = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    weekday: 'long',
  }).format(now);

  async function handleLogout() {
    if (!onLogout || logoutLockRef.current) return;

    logoutLockRef.current = true;
    setLoggingOut(true);
    setLogoutError('');

    try {
      await onLogout();
    } catch {
      if (mountedRef.current) {
        setLogoutError('Could not sign out. Please try again.');
      }
    } finally {
      logoutLockRef.current = false;

      if (mountedRef.current) {
        setLoggingOut(false);
      }
    }
  }

  return (
    <header className="mb-7">
      {/* Top bar */}
      <div className="flex min-h-20 items-center justify-between gap-3 border-b border-white/10 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {onMenuClick && (
            <button
              ref={menuButtonRef}
              type="button"
              onClick={onMenuClick}
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
              aria-controls="gym-mobile-navigation"
              aria-haspopup="dialog"
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-lime-300 lg:hidden ${focusClass}`}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          )}

          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-wrap items-center gap-2 text-xs"
          >
            <Link
              to="/"
              className={`hidden rounded text-zinc-500 hover:text-lime-300 sm:inline ${focusClass}`}
            >
              Workspace
            </Link>

            <ChevronRight
              size={13}
              className="hidden text-zinc-600 sm:block"
              aria-hidden="true"
            />

            <span
              aria-current="page"
              className="font-medium text-zinc-300"
            >
              {page.label}
            </span>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {/* Date */}
          <div className="hidden items-center gap-2.5 xl:flex">
            <CalendarDays
              size={18}
              className="text-zinc-500"
              aria-hidden="true"
            />

            <div>
              <p className="text-[10px] text-zinc-500">{dayText}</p>
              <p className="mt-0.5 text-xs text-zinc-300">{dateText}</p>
            </div>
          </div>

          <span
            className="hidden h-8 w-px bg-white/10 xl:block"
            aria-hidden="true"
          />

          {/* Identity */}
          <div className="hidden items-center gap-2.5 sm:flex">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/10 text-xs font-bold text-lime-300"
              title={displayName}
              aria-label={displayName}
            >
              {initials}
            </div>

            <div className="hidden max-w-[140px] md:block">
              <p className="break-words text-xs font-semibold text-zinc-200">
                {displayName}
              </p>

              <p className="mt-1 text-[10px] text-zinc-500">
                Management
              </p>
            </div>
          </div>

          {/* Logout */}
          {onLogout && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label={loggingOut ? 'Signing out' : 'Sign out'}
              title="Sign out"
              className={`group inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-300/15 bg-red-300/5 px-3 py-2 text-xs font-semibold text-red-300 transition hover:border-red-300/35 hover:bg-red-300/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5 ${focusClass}`}
            >
              {loggingOut ? (
                <Loader2
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <LogOut size={16} aria-hidden="true" />
              )}

              <span className="hidden sm:inline">
                {loggingOut ? 'Signing out...' : 'Sign out'}
              </span>
            </button>
          )}
        </div>
      </div>

      {logoutError && (
        <div
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-xs text-red-200"
        >
          <AlertCircle size={16} aria-hidden="true" />
          {logoutError}
        </div>
      )}

      {/* Page heading */}
      <div className="flex items-center justify-between gap-5 pt-7 sm:pt-8">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-sm bg-lime-300"
              aria-hidden="true"
            />

            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-lime-300">
              Your space. Your pace.
            </p>
          </div>

          <h1 className="text-2xl font-bold leading-tight tracking-tight text-zinc-100 sm:text-3xl">
            {page.title}
          </h1>

          <p className="mt-3 max-w-2xl text-xs leading-7 text-zinc-400">
            {page.description}
          </p>
        </div>

        <div
          aria-hidden="true"
          className="hidden h-16 w-16 shrink-0 -rotate-6 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300 sm:flex"
        >
          <PageIcon size={29} className="rotate-6" strokeWidth={1.6} />
        </div>
      </div>
    </header>
  );
}

export default Header;