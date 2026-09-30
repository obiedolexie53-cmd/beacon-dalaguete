import { Navigate, type RouteObject } from 'react-router';
import { ConsoleShell } from './ConsoleShell';
import { NotFoundPage } from './NotFoundPage';
import { StaffLoginPlaceholder } from '../features/auth/StaffLoginPlaceholder';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { MapPage } from '../features/map/MapPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { AnalysisPage } from '../features/analysis/AnalysisPage';

/** Phase 3 adds a staff-only auth guard around the ConsoleShell routes. */
export const routes: RouteObject[] = [
  { path: '/login', element: <StaffLoginPlaceholder /> },
  {
    element: <ConsoleShell />,
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
