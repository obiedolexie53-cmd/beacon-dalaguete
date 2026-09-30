import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  ChartColumnBig,
  FileSearch,
  History,
  LayoutDashboard,
  Map,
  Menu,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { DemoBadge, Logo, OfflineBanner, cx } from '@beacon/ui';
import { DEMO_STAFF } from '../demo/demoData';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

export const CONSOLE_NAV: readonly NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/reports', label: 'Reports', Icon: FileSearch },
  { to: '/map', label: 'Disaster Map', Icon: Map },
  { to: '/history', label: 'Historical Reports', Icon: History },
  { to: '/analysis', label: 'Pattern Analysis', Icon: ChartColumnBig },
];

/** Authorized MDRRMO layout. Phase 3 adds the staff auth guard around these routes. */
export function ConsoleShell() {
  const { pathname } = useLocation();
  // The mobile drawer stays open only on the page it was opened from, so it
  // closes automatically after navigating.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const navOpen = openedOn === pathname;
  const setNavOpen = (open: boolean) => setOpenedOn(open ? pathname : null);

  return (
    <div className={cx('m-shell', navOpen && 'm-shell--nav-open')}>
      <aside className="m-sidebar" id="console-sidebar">
        <div className="m-sidebar__brand">
          <Logo size={36} inverse />
          <span className="m-sidebar__caption">MDRRMO Console · Dalaguete</span>
        </div>
        <nav className="m-nav" aria-label="Console">
          <ul>
            {CONSOLE_NAV.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink to={to}>
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="m-sidebar__footer">
          Authorized MDRRMO personnel only.
          <br />
          <NavLink to="/login">Sign out</NavLink>
        </div>
      </aside>
      <div className="m-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="m-main">
        <header className="m-topbar">
          <button
            type="button"
            className="bcn-icon-button m-topbar__menu"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            aria-controls="console-sidebar"
            onClick={() => setNavOpen(!navOpen)}
          >
            {navOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
          <span />
          <span className="m-topbar__user">
            <UserRound size={20} aria-hidden="true" />
            {DEMO_STAFF.fullName}
            <DemoBadge>DEMO</DemoBadge>
          </span>
        </header>
        <OfflineBanner message="No internet connection. Report data may be out of date until you reconnect." />
        <main className="m-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
