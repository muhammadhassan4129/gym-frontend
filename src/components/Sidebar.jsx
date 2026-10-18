import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import GymIcon from './GymIcon';

import {
  isNavigationActive,
  navigationGroups,
} from './gymNavigation';

function Sidebar({
  mobile = false,
  onNavigate,
  onClose,
  gymName = 'Yaseen Gym',
  adminName = 'Gym Admin',
}) {
  const { pathname } = useLocation();

  const initials =
    adminName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'GA';

  return (
    <aside
      className={`gm-sidebar ${
        mobile ? 'gm-sidebar--mobile' : 'gm-sidebar--desktop'
      }`}
      aria-label={mobile ? 'Mobile sidebar' : 'Sidebar'}
    >
      {/* Brand */}
      <div className="gm-sidebar__brand-row">
        <Link
          to="/"
          className="gm-brand"
          onClick={onNavigate}
          aria-label={`${gymName} dashboard`}
        >
          <span className="gm-brand__icon">
            <GymIcon name="dumbbell" size={25} />
          </span>

          <span className="gm-brand__text">
            <span className="gm-brand__name">{gymName}</span>
            <span className="gm-brand__caption">
              MANAGEMENT STUDIO
            </span>
          </span>
        </Link>

        {mobile && (
          <button
            type="button"
            className="gm-icon-button gm-sidebar__close"
            onClick={onClose}
            aria-label="Close navigation"
            autoFocus
          >
            <GymIcon name="close" size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="gm-sidebar__scroll">
        <nav aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}>
          {navigationGroups.map((group) => (
            <div className="gm-nav-group" key={group.label}>
              <p className="gm-nav-group__label">
                {group.label}
              </p>

              <ul className="gm-nav-list">
                {group.items.map((item) => {
                  const active = isNavigationActive(
                    pathname,
                    item.path
                  );

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={`gm-nav-link ${
                          active ? 'gm-nav-link--active' : ''
                        }`}
                      >
                        <span className="gm-nav-link__icon">
                          <GymIcon name={item.icon} size={20} />
                        </span>

                        <span className="gm-nav-link__label">
                          {item.label}
                        </span>

                        {active && (
                          <span
                            className="gm-nav-link__indicator"
                            aria-hidden="true"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Brand detail */}
        <div className="gm-sidebar-card">
          <div className="gm-sidebar-card__top">
            <span className="gm-sidebar-card__eyebrow">
              THE DAILY STANDARD
            </span>

            <GymIcon name="arrow" size={17} />
          </div>

          <p className="gm-sidebar-card__title">
            Stronger members.
            <br />
            Stronger business.
          </p>

          <div className="gm-sidebar-card__bars" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      {/* Admin identity */}
      <div className="gm-sidebar__footer">
        <div className="gm-avatar">{initials}</div>

        <div className="gm-sidebar__admin">
          <span className="gm-sidebar__admin-name">
            {adminName}
          </span>

          <span className="gm-sidebar__admin-role">
            Gym management
          </span>
        </div>

        <span className="gm-sidebar__footer-mark" aria-hidden="true">
          <GymIcon name="dumbbell" size={18} />
        </span>
      </div>
    </aside>
  );
}

export default Sidebar;