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
import { ReportWizard } from '../features/report/ReportWizard';
import { DetailsStep } from '../features/report/steps/DetailsStep';
import { EvidenceStep } from '../features/report/steps/EvidenceStep';
import { ReviewStep } from '../features/report/steps/ReviewStep';
import { SubmittedScreen } from '../features/report/SubmittedScreen';
import { ReportDetailsScreen } from '../features/reports/ReportDetailsScreen';
import { HazardStep } from '../features/report/steps/HazardStep';
import { LocationStep } from '../features/report/steps/LocationStep';
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
      {
        path: '/report/new',
        element: <ReportWizard />,
        children: [
          { path: 'hazard', element: <HazardStep /> },
          { path: 'details', element: <DetailsStep /> },
          { path: 'location', element: <LocationStep /> },
          { path: 'evidence', element: <EvidenceStep /> },
          { path: 'review', element: <ReviewStep /> },
        ],
      },
      { path: '/report/submitted/:referenceNo', element: <SubmittedScreen /> },
      { path: '/my-reports', element: <MyReportsScreen /> },
      { path: '/my-reports/:referenceNo', element: <ReportDetailsScreen /> },
      { path: '/notifications', element: <NotificationsScreen /> },
      { path: '/profile', element: <ProfileScreen /> },
    ],
  },
  { path: '*', element: <NotFoundScreen /> },
];
