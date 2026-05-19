import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

// Layout
import AppLayout from '../components/layout/AppLayout';

// Guards
import PrivateRoute from './PrivateRoute';
import RoleRoute from './RoleRoute';

// Pages
import LoginPage            from '../pages/Login/LoginPage';
import DashboardPage        from '../pages/Dashboard/DashboardPage';
import TimesheetsPage       from '../pages/Timesheets/TimesheetsPage';
import TimesheetDetailPage  from '../pages/Timesheets/TimesheetDetailPage';
import ProjectsPage         from '../pages/Projects/ProjectsPage';
import AllocationsPage      from '../pages/Allocations/AllocationsPage';
import ExceptionsPage       from '../pages/Exceptions/ExceptionsPage';
import HolidaysPage         from '../pages/Holidays/HolidaysPage';
import UsersPage            from '../pages/Users/UsersPage';
import ReportsPage          from '../pages/Reports/ReportsPage';
import SkillsPage           from '../pages/Skills/SkillsPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        {/* Protected — all authenticated users */}
        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>

            {/* Shared routes */}
            <Route path={ROUTES.DASHBOARD}     element={<DashboardPage />} />
            <Route path={ROUTES.TIMESHEETS}    element={<TimesheetsPage />} />
            <Route path={ROUTES.TIMESHEET_DETAIL} element={<TimesheetDetailPage />} />
            <Route path={ROUTES.PROJECTS}      element={<ProjectsPage />} />
            <Route path={ROUTES.ALLOCATIONS}   element={<AllocationsPage />} />
            <Route path={ROUTES.WORK_REQUESTS} element={<ExceptionsPage />} />
            <Route path={ROUTES.REPORTS}       element={<ReportsPage />} />

            {/* Resource Manager only */}
            <Route element={<RoleRoute allowedRoles={['RESOURCE_MANAGER']} />}>
              <Route path={ROUTES.USERS}    element={<UsersPage />} />
              <Route path={ROUTES.HOLIDAYS} element={<HolidaysPage />} />
              <Route path={ROUTES.SKILLS}   element={<SkillsPage />} />
            </Route>

          </Route>
        </Route>

        {/* Fallbacks */}
        <Route path={ROUTES.ROOT} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        <Route path="*"           element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
