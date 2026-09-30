import { NavLink, Outlet } from 'react-router';
import { Bell, ClipboardList, House, Plus, UserRound, type LucideIcon } from 'lucide-react';
import { Logo, OfflineBanner } from '@beacon/ui';
import { MUNICIPALITY, PROVINCE } from '@beacon/shared';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  className?: string;
}

export const RESIDENT_NAV: readonly NavItem[] = [
  { to: '/home', label: 'Home', Icon: House },
  { to: '/report', label: 'Report', Icon: Plus, className: 'r-bottom-nav__report' },
  { to: '/my-reports', label: 'My Reports', Icon: ClipboardList },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
  { to: '/profile', label: 'Profile', Icon: UserRound },
];

/** Signed-in resident layout: top bar, page content and bottom navigation. */
export function AppShell() {
  return (
    <div className="r-shell">
      <header className="r-topbar">
        <Logo size={32} inverse />
        <span className="r-topbar__place">
          {MUNICIPALITY}, {PROVINCE}
        </span>
      </header>
      <OfflineBanner />
      <main className="r-screen">
        <Outlet />
      </main>
      <nav className="r-bottom-nav" aria-label="Main">
        <ul>
          {RESIDENT_NAV.map(({ to, label, Icon, className }) => (
            <li key={to}>
              <NavLink to={to} className={className}>
                <span className="r-bottom-nav__icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
