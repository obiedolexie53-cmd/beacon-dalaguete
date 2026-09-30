import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { NotFoundScreen } from './NotFoundScreen';
import { SplashScreen } from '../features/onboarding/SplashScreen';
import { WelcomeScreen } from '../features/onboarding/WelcomeScreen';
import { AuthPlaceholder } from '../features/auth/AuthPlaceholder';
import { HomeScreen } from '../features/home/HomeScreen';
import { ReportStartScreen } from '../features/report/ReportStartScreen';
import { MyReportsScreen } from '../features/my-reports/MyReportsScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';

/**
 * Resident flow: Splash → Welcome → Login/Registration → app (bottom nav).
 * Phase 3 adds an auth guard around the AppShell routes.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <SplashScreen /> },
  { path: '/welcome', element: <WelcomeScreen /> },
  { path: '/login', element: <AuthPlaceholder mode="login" /> },
  { path: '/register', element: <AuthPlaceholder mode="register" /> },
  {
    element: <AppShell />,
    children: [
      { path: '/home', element: <HomeScreen /> },
      { path: '/report', element: <ReportStartScreen /> },
      { path: '/my-reports', element: <MyReportsScreen /> },
      { path: '/notifications', element: <NotificationsScreen /> },
      { path: '/profile', element: <ProfileScreen /> },
    ],
  },
  { path: '*', element: <NotFoundScreen /> },
];
