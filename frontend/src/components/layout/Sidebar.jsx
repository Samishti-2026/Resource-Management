import { NavLink, useNavigate } from 'react-router-dom';
import { useRBAC } from '../../hooks/useRBAC';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { logout } from '../../services/authService';
import { ROUTES } from '../../constants/routes';

/* ─── Nav config per role ─────────────────────────────────────────────────── */
const NAV = {
  EMPLOYEE: [
    // { to: ROUTES.DASHBOARD,     label: 'Dashboard',     icon: IconHome },   // TODO: re-enable dashboard
    { to: ROUTES.TIMESHEETS,    label: 'My Timesheets', icon: IconTimesheet },
    { to: ROUTES.REPORTS,       label: 'Reports',       icon: IconReport },
    // { to: ROUTES.WORK_REQUESTS, label: 'Work Requests', icon: IconRequest }, // TODO: re-enable work requests
  ],
  PROJECT_MANAGER: [
    // { to: ROUTES.DASHBOARD,     label: 'Dashboard',     icon: IconHome },   // TODO: re-enable dashboard
    { to: ROUTES.TIMESHEETS,    label: 'Timesheets',    icon: IconTimesheet },
    { to: ROUTES.PROJECTS,      label: 'Projects',      icon: IconProject },
    { to: ROUTES.ALLOCATIONS,   label: 'Allocations',   icon: IconAlloc },
    // { to: ROUTES.WORK_REQUESTS, label: 'Work Requests', icon: IconRequest }, // TODO: re-enable work requests
    { to: ROUTES.REPORTS,       label: 'Reports',       icon: IconReport },
  ],
  RESOURCE_MANAGER: [
    // { to: ROUTES.DASHBOARD,     label: 'Dashboard',     icon: IconHome },   // TODO: re-enable dashboard
    { to: ROUTES.PROJECTS,      label: 'Projects',      icon: IconProject },
    { to: ROUTES.USERS,         label: 'Users & Skills',icon: IconUsers },
    { to: ROUTES.ALLOCATIONS,   label: 'Allocations',   icon: IconAlloc },
    { to: ROUTES.TIMESHEETS,    label: 'Timesheets',    icon: IconTimesheet },
    // { to: ROUTES.WORK_REQUESTS, label: 'Work Requests', icon: IconRequest }, // TODO: re-enable work requests
    { to: ROUTES.HOLIDAYS,      label: 'Holidays',      icon: IconCalendar },
    { to: ROUTES.REPORTS,       label: 'Reports',       icon: IconReport },
  ],
};

const ROLE_LABEL = {
  RESOURCE_MANAGER: 'Resource Manager',
  PROJECT_MANAGER:  'Project Manager',
  EMPLOYEE:         'Employee',
};

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
export default function Sidebar({ onClose }) {
  const { role } = useRBAC();
  const { user, logout: storeLogout } = useAuthStore();
  const { sidebarOpen } = useUIStore();
  const navigate = useNavigate();
  const items = NAV[role] || [];

  const handleLogout = async () => {
    await logout();
    storeLogout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <aside
      className={`
        flex flex-col h-full bg-gray-900 text-white
        transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0
        ${sidebarOpen ? 'w-60' : 'w-14'}
      `}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3.5 py-4 border-b border-white/10 flex-shrink-0">
        <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 shadow">
          TS
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden">
            <p className="font-semibold text-sm leading-tight">Resource Management</p>
            <p className="text-xs text-gray-400 leading-tight">Enterprise</p>
          </div>
        )}
      </div>

      {/* ── Nav links ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-2 px-2">
        <div className="space-y-0.5">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center' : ''}`
              }
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Profile + Logout (bottom) ──────────────────────────────────── */}
      <div className="border-t border-white/10 flex-shrink-0">
        {/* Profile row */}
        <div
          className={`flex items-center gap-2.5 px-3.5 py-3 ${!sidebarOpen ? 'justify-center' : ''}`}
          title={!sidebarOpen ? `${user?.name} · ${ROLE_LABEL[role]}` : undefined}
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 shadow">
            {user?.name?.[0]?.toUpperCase()}
          </div>

          {sidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate leading-tight">{ROLE_LABEL[role]}</p>
            </div>
          )}

          {/* Logout button — only visible when sidebar is open */}
          {sidebarOpen && (
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="
                flex-shrink-0 w-7 h-7 rounded-lg
                flex items-center justify-center
                text-gray-400 hover:text-white hover:bg-red-500/20
                transition-colors
              "
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>

        {/* Collapsed: show logout icon below avatar */}
        {!sidebarOpen && (
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="
              w-full flex items-center justify-center py-2.5
              text-gray-400 hover:text-white hover:bg-red-500/20
              transition-colors
            "
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */
function IconHome({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
}
function IconTimesheet({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
}
function IconProject({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
}
function IconAlloc({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function IconRequest({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>;
}
function IconUsers({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function IconCalendar({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function IconReport({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
