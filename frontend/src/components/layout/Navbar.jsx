import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { logout } from '../../services/authService';
import { ROUTES } from '../../constants/routes';

const PAGE_TITLES = {
  [ROUTES.DASHBOARD]:     'Dashboard',
  [ROUTES.TIMESHEETS]:    'Timesheets',
  [ROUTES.PROJECTS]:      'Projects',
  [ROUTES.ALLOCATIONS]:   'Allocations',
  [ROUTES.WORK_REQUESTS]: 'Work Requests',
  [ROUTES.REPORTS]:       'Reports',
  [ROUTES.USERS]:         'Users & Skills',
  [ROUTES.HOLIDAYS]:      'Company Holidays',
  [ROUTES.SKILLS]:        'Skill Catalog',
};

const ROLE_LABEL = {
  RESOURCE_MANAGER: 'Resource Manager',
  PROJECT_MANAGER:  'Project Manager',
  EMPLOYEE:         'Employee',
};

const ROLE_COLOR = {
  RESOURCE_MANAGER: 'bg-purple-100 text-purple-700',
  PROJECT_MANAGER:  'bg-blue-100 text-blue-700',
  EMPLOYEE:         'bg-green-100 text-green-700',
};

export default function Navbar({ onMobileMenuClick }) {
  const { user, logout: storeLogout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close popup on route change
  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  )?.[1] ?? 'Resource Management';

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    storeLogout();
    navigate(ROUTES.LOGIN);
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <header className="
      sticky top-0 z-30 flex items-center justify-between
      h-14 px-4 sm:px-5
      bg-white border-b border-gray-200 shadow-sm flex-shrink-0
    ">
      {/* ── Left: hamburger + page title ──────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuClick}
          className="btn btn-icon btn-ghost lg:hidden"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Desktop collapse */}
        <button
          onClick={toggleSidebar}
          className="btn btn-icon btn-ghost hidden lg:flex"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="text-sm font-semibold text-gray-800 truncate">{title}</h1>
      </div>

      {/* ── Right: profile popup trigger ──────────────────────────────── */}
      <div className="relative flex-shrink-0" ref={profileRef}>
        <button
          onClick={() => setProfileOpen((o) => !o)}
          aria-label="Profile menu"
          aria-expanded={profileOpen}
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-gray-100 transition-colors"
        >
          {/* Name — hidden on xs */}
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-gray-800 leading-tight">{user?.name}</p>
            <p className="text-xs text-gray-400 leading-tight">{ROLE_LABEL[user?.role]}</p>
          </div>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-xs shadow-sm flex-shrink-0">
            {initials}
          </div>

          {/* Chevron */}
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* ── Profile dropdown popup ─────────────────────────────────── */}
        {profileOpen && (
          <div className="
            absolute right-0 top-full mt-2 w-64
            bg-white rounded-xl shadow-xl border border-gray-100
            overflow-hidden z-50
            animate-fade-in
          ">
            {/* User info header */}
            <div className="px-4 py-4 bg-gradient-to-br from-blue-600 to-blue-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {initials}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-xs text-blue-200 truncate">{user?.email}</p>
                </div>
              </div>
              <div className="mt-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOR[user?.role] ?? 'bg-gray-100 text-gray-700'}`}>
                  {ROLE_LABEL[user?.role] ?? user?.role}
                </span>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <div className="px-3 py-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</p>
              </div>

              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setProfileOpen(false)}
              >
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <p className="text-xs font-medium text-gray-800">Profile</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
              </button>

              <div className="mx-3 my-1 border-t border-gray-100" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-xs font-medium">Sign out</span>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">Resource Management v1.0.0</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
