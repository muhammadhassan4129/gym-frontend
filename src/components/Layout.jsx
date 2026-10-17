import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useLocation } from 'react-router-dom';

import Sidebar from './Sidebar';
import Header from './Header';
import PwaControls from './PwaControls';

import './gym-layout.css';

function Layout({
  children,
  gymName = 'Gym Master',
  adminName = 'Gym Admin',
  onLogout,
}) {
  const { pathname } = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const dialogRef = useRef(null);
  const menuButtonRef = useRef(null);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Close navigation after a route change.
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  // Open/close the native modal dialog.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (sidebarOpen && !dialog.open) {
      dialog.showModal();
    } else if (!sidebarOpen && dialog.open) {
      dialog.close();
    }
  }, [sidebarOpen]);

  // Prevent the background page from scrolling on mobile.
  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  // Close the mobile drawer when switching to desktop.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');

    const handleChange = (event) => {
      if (event.matches) closeSidebar();
    };

    media.addEventListener('change', handleChange);

    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, [closeSidebar]);

  const handleDialogClose = () => {
    setSidebarOpen(false);

    if (!window.matchMedia('(min-width: 1024px)').matches) {
      menuButtonRef.current?.focus();
    }
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      closeSidebar();
    }
  };

  return (
<div className="gm-app pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <a className="gm-skip-link" href="#gym-main-content">
        Skip to content
      </a>

      {/* Desktop navigation */}
      <Sidebar
        gymName={gymName}
        adminName={adminName}
        onLogout={onLogout}
      />

      {/* Mobile navigation */}
      <dialog
        ref={dialogRef}
        id="gym-mobile-navigation"
        className="gm-mobile-dialog"
        aria-label="Gym navigation"
        onClick={handleBackdropClick}
        onCancel={(event) => {
          event.preventDefault();
          closeSidebar();
        }}
        onClose={handleDialogClose}
      >
        <Sidebar
          mobile
          gymName={gymName}
          adminName={adminName}
          onNavigate={closeSidebar}
          onClose={closeSidebar}
          onLogout={onLogout}
        />
      </dialog>

      {/* Main workspace */}
      <div className="gm-workspace">
        <div className="gm-workspace__inner">
         <Header
  adminName={adminName}
  sidebarOpen={sidebarOpen}
  menuButtonRef={menuButtonRef}
  onMenuClick={() => setSidebarOpen(true)}
  onLogout={onLogout}
/>

          <main
            id="gym-main-content"
            className="gm-main"
            tabIndex={-1}
          >
            <PwaControls />
            {children}
          </main>

          <footer className="gm-workspace-footer">
            <span>{gymName}</span>

            <span className="gm-workspace-footer__tagline">
              Built for the everyday grind.
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default Layout;