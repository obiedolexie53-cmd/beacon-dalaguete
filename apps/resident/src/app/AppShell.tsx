import { NavLink, Outlet } from 'react-router';
import { Bell, ClipboardList, House, Plus, UserRound, type LucideIcon } from 'lucide-react';
import { useAuth } from '@beacon/auth';
import { Logo, OfflineBanner } from '@beacon/ui';
import { MUNICIPALITY, PROVINCE } from '@beacon/shared';
import { ReportDraftProvider } from '../features/report/draft/ReportDraftProvider';
import {
  NotificationsProvider,
  useNotifications,
} from '../features/notifications/NotificationsProvider';

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
  const { user } = useAuth();
  return (
    <NotificationsProvider>
      <div className="r-shell">
        <header className="r-topbar">
          <Logo size={32} inverse />
          <span className="r-topbar__place">
            {MUNICIPALITY}, {PROVINCE}
          </span>
        </header>
        <OfflineBanner />
        <main className="r-screen">
          {user && (
            // Keyed by user so a different resident on the same device never sees another's draft.
            <ReportDraftProvider key={user.id} userId={user.id}>
              <Outlet />
            </ReportDraftProvider>
          )}
        </main>
        <BottomNav />
      </div>
    </NotificationsProvider>
  );
}

function BottomNav() {
  const { unread } = useNotifications();
  return (
    <nav className="r-bottom-nav" aria-label="Main">
      <ul>
        {RESIDENT_NAV.map(({ to, label, Icon, className }) => {
          const badge = to === '/notifications' && unread > 0 ? unread : 0;
          return (
            <li key={to}>
              <NavLink
                to={to}
                className={className}
                aria-label={badge ? `${label}, ${badge} unread` : undefined}
              >
                <span className="r-bottom-nav__icon">
                  <Icon size={22} aria-hidden="true" />
                  {badge > 0 && (
                    <span className="r-bottom-nav__badge" aria-hidden="true">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                {label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
