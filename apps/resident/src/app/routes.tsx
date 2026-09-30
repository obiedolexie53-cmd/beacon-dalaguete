import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { NotFoundScreen } from './NotFoundScreen';
import { RedirectIfAuthenticated, RequireAuth } from './guards';
import { SplashScreen } from '../features/onboarding/SplashScreen';
import { WelcomeScreen } from '../features/onboarding/WelcomeScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { RegisterScreen } from '../features/auth/RegisterScreen';
import { PrivacyScreen } from '../features/auth/PrivacyScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { ReportStartScreen } from '../features/report/ReportStartScreen';
import { MyReportsScreen } from '../features/my-reports/MyReportsScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';

/** Resident flow: Splash → Welcome → Login/Registration → app (bottom nav, signed-in only). */
export const routes: RouteObject[] = [
  { path: '/', element: <SplashScreen /> },
  {
    path: '/welcome',
    element: (
      <RedirectIfAuthenticated>
        <WelcomeScreen />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '/login',
    element: (
      <RedirectIfAuthenticated>
        <LoginScreen />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '/register',
    element: (
      <RedirectIfAuthenticated>
        <RegisterScreen />
      </RedirectIfAuthenticated>
    ),
  },
  { path: '/privacy', element: <PrivacyScreen /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
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
