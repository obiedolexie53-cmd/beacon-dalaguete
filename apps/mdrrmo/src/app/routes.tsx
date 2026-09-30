import { Navigate, type RouteObject } from 'react-router';
import { ConsoleShell } from './ConsoleShell';
import { NotFoundPage } from './NotFoundPage';
import { StaffLoginPage } from '../features/auth/StaffLoginPage';
import { RequireStaff } from './guards';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { MapPage } from '../features/map/MapPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { AnalysisPage } from '../features/analysis/AnalysisPage';

/** Every console route requires a signed-in MDRRMO/admin account. */
export const routes: RouteObject[] = [
  { path: '/login', element: <StaffLoginPage /> },
  {
    element: (
      <RequireStaff>
        <ConsoleShell />
      </RequireStaff>
    ),
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/map', element: <MapPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/analysis', element: <AnalysisPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
