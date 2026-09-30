import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  ChartColumnBig,
  FileSearch,
  History,
  LayoutDashboard,
  Map,
  LogOut,
  Menu,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@beacon/auth';
import { DemoBadge, Logo, OfflineBanner, cx } from '@beacon/ui';

const ROLE_LABELS = { mdrrmo: 'MDRRMO Personnel', admin: 'Administrator', resident: 'Resident' };

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

/** Authorized MDRRMO layout (wrapped in RequireStaff by the router). */
export function ConsoleShell() {
  const { user, logout } = useAuth();
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
          <button
            type="button"
            className="m-signout"
            onClick={() => void logout().catch(() => undefined)}
          >
            <LogOut size={18} aria-hidden="true" />
            Sign out
          </button>
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
          {user && (
            <span className="m-topbar__user">
              <UserRound size={20} aria-hidden="true" />
              <span>
                {user.full_name}
                <span className="m-topbar__role">{ROLE_LABELS[user.role]}</span>
              </span>
              {user.is_demo && <DemoBadge>DEMO</DemoBadge>}
            </span>
          )}
        </header>
        <OfflineBanner message="No internet connection. Report data may be out of date until you reconnect." />
        <main className="m-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
