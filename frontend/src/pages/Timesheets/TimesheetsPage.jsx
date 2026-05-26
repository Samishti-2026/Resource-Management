import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getTimesheets, createTimesheet } from '../../services/timesheetService';
import { getAllocations } from '../../services/allocationService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import StatusBadge from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate, formatDateInput, getWeekStart } from '../../utils/dateHelpers';
import { addDays, subDays, getISOWeek } from 'date-fns';
import { ROUTES, buildRoute } from '../../constants/routes';

const STATUS_TABS = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

/* ── Build the 4-week window: 2 past + current + 1 future ─────────────────── */
function buildWeekWindow() {
  const today = new Date();
  // weeks: -2, -1, 0 (current), +1
  return [-2, -1, 0, 1].map((offset) => {
    const anchor = offset >= 0
      ? addDays(today, offset * 7)
      : subDays(today, Math.abs(offset) * 7);
    const weekStart = getWeekStart(anchor);
    const weekEnd   = addDays(weekStart, 6);
    return {
      weekStart,
      weekEnd,
      weekStartStr: formatDateInput(weekStart),
      weekNumber: getISOWeek(weekStart),
      isCurrent: offset === 0,
    };
  });
}

const STATUS_STYLE = {
  DRAFT:     'border-yellow-300 bg-yellow-50',
  SUBMITTED: 'border-blue-300 bg-blue-50',
  APPROVED:  'border-green-300 bg-green-50',
  REJECTED:  'border-yellow-400 bg-yellow-50', // same as DRAFT — rebookable
};

export default function TimesheetsPage() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const toast     = useToast();
  const qc        = useQueryClient();
  const isEmployee = user?.role === 'EMPLOYEE';
  const isRM = user?.role === 'RESOURCE_MANAGER';
  const isPM = user?.role === 'PROJECT_MANAGER';

  // RM and PM default to SUBMITTED so they see pending approvals first
  const [status, setStatus] = useState(isEmployee ? '' : 'SUBMITTED');
  const [page,   setPage]   = useState(1);
  const [openingWeek, setOpeningWeek] = useState(null); // track which card is loading

  /* ── Fetch all timesheets (for list + to check week status) ─────────────── */
  const { data, isLoading } = useQuery({
    queryKey: ['timesheets', { status, page }],
    queryFn: () => getTimesheets({ status: status || undefined, page, limit: 15 }),
  });

  /* Fetch recent timesheets without filter to map week → existing timesheet */
  const { data: recentData } = useQuery({
    queryKey: ['timesheets', { limit: 20 }],
    queryFn: () => getTimesheets({ limit: 20 }),
    enabled: isEmployee,
  });

  /* Fetch employee's allocations for the budget summary */
  const { data: myAllocations = [] } = useQuery({
    queryKey: ['my-allocations'],
    queryFn:  () => getAllocations({}),
    enabled:  isEmployee,
  });

  const createMutation = useMutation({
    mutationFn: (weekStartStr) => createTimesheet(weekStartStr),
    onSuccess: (ts) => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      navigate(buildRoute(ROUTES.TIMESHEET_DETAIL, { id: ts.id }));
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Failed');
      setOpeningWeek(null);
    },
  });

  if (isLoading) return <PageLoader />;

  const timesheets  = data?.timesheets ?? [];
  const meta        = data?.meta ?? {};
  const recentList  = recentData?.timesheets ?? [];

  /* Map weekStartStr → existing timesheet for the week cards */
  const weekMap = Object.fromEntries(
    recentList.map((ts) => [formatDateInput(ts.weekStart), ts])
  );

  const weeks = buildWeekWindow();

  const handleWeekClick = (week) => {
    const existing = weekMap[week.weekStartStr];
    if (existing) {
      navigate(buildRoute(ROUTES.TIMESHEET_DETAIL, { id: existing.id }));
    } else {
      setOpeningWeek(week.weekStartStr);
      createMutation.mutate(week.weekStartStr);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Timesheets</h1>
          <p className="page-subtitle">
            {isEmployee ? 'Select a week to fill or view your timesheet' : 'Team timesheets for review'}
          </p>
        </div>
      </div>

      {/* ── Week selector (Employee only) ────────────────────────────────── */}
      {isEmployee && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-0.5">
            Fill / Open Timesheet — Select a Week
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {weeks.map((week) => {
              const existing  = weekMap[week.weekStartStr];
              const status    = existing?.status;
              const isLoading = openingWeek === week.weekStartStr && createMutation.isPending;
              const totalHours = existing?.entries?.reduce((s, e) => s + e.hours, 0) ?? 0;

              return (
                <button
                  key={week.weekStartStr}
                  onClick={() => handleWeekClick(week)}
                  disabled={isLoading}
                  className={`
                    relative text-left rounded-xl border-2 p-3.5 transition-all
                    hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                    focus:outline-none focus:ring-2 focus:ring-blue-400
                    ${week.isCurrent ? 'ring-2 ring-blue-400' : ''}
                    ${status ? STATUS_STYLE[status] : 'border-gray-200 bg-white hover:border-blue-300'}
                    ${isLoading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
                  `}
                >
                  {/* Current week badge */}
                  {week.isCurrent && (
                    <span className="absolute top-2 right-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold leading-tight">
                      This week
                    </span>
                  )}

                  <p className="text-xs text-gray-400 mb-0.5">Week {week.weekNumber}</p>
                  <p className="text-xs font-semibold text-gray-800 leading-snug">
                    {formatDate(week.weekStart, 'dd MMM')} – {formatDate(week.weekEnd, 'dd MMM yyyy')}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between">
                    {status ? (
                      <StatusBadge status={status} />
                    ) : (
                      <span className="text-xs text-gray-400 italic">Not started</span>
                    )}
                    {status && totalHours > 0 && (
                      <span className="text-xs font-bold text-gray-700">{totalHours}H</span>
                    )}
                  </div>

                  {isLoading && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600">
                      <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin inline-block" />
                      Opening…
                    </div>
                  )}
                  {!isLoading && !status && (
                    <p className="mt-2 text-xs text-blue-500 font-medium">+ Click to start →</p>
                  )}
                  {!isLoading && status && (
                    <p className="mt-2 text-xs text-gray-500">
                      {['DRAFT', 'REJECTED'].includes(status) ? '✏️ Click to edit' : '👁 Click to view'}
                    </p>
                  )}                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Allocation Budget Summary (Employee only) ───────────────────── */}
      {isEmployee && myAllocations.length > 0 && (
        <div className="card card-sm">
          <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            My Project Allocation Budget
          </h3>
          <div className="space-y-3">
            {myAllocations.map((a) => {
              const allocated = a.allocatedHours ?? 0;
              const used      = a.usedHours ?? 0;
              const remaining = a.remainingHours ?? Math.max(0, allocated - used);
              const pct       = allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0;
              const isLow     = remaining < allocated * 0.2;
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[150px]"
                      title={a.project?.name}>{a.project?.name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Allocated: <strong className="text-gray-800">{allocated}H</strong></span>
                      <span className="text-gray-500">Used: <strong className="text-blue-700">{used}H</strong></span>
                      <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                        Remaining: {remaining}H
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{pct}% used
                    <span className="ml-2 text-gray-300">
                      {formatDate(a.startDate, 'dd MMM')} – {formatDate(a.endDate, 'dd MMM yyyy')}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Status filter ────────────────────────────────────────────────── */}
      <div className="filter-bar">
        <span className="text-xs font-medium text-gray-500 hidden sm:block">
          {isEmployee ? 'History:' : 'Status:'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`pill-tab ${status === s ? 'active' : ''}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        {meta.total != null && (
          <span className="text-xs text-gray-400 ml-auto">{meta.total} total</span>
        )}
      </div>

      {/* ── Timesheets table ─────────────────────────────────────────────── */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {!isEmployee && <th>Employee</th>}
                <th>Week</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {timesheets.length === 0 ? (
                <tr>
                  <td colSpan={isEmployee ? 5 : 6}>
                    <div className="empty-state">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p>No timesheets found</p>
                      {isEmployee && <span>Use the week cards above to start a timesheet</span>}
                    </div>
                  </td>
                </tr>
              ) : timesheets.map((ts) => {
                const totalHours = ts.entries?.reduce((s, e) => s + e.hours, 0) ?? 0;
                return (
                  <tr key={ts.id}>
                    {!isEmployee && (
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-sm flex-shrink-0">{ts.employee?.name?.[0]}</div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{ts.employee?.name}</p>
                            <p className="text-xs text-gray-400 truncate hidden sm:block">{ts.employee?.email}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    <td>
                      <p className="font-medium text-gray-900">{formatDate(ts.weekStart, 'dd MMM yyyy')}</p>
                      <p className="text-xs text-gray-400">Week {ts.weekNumber ?? ''}</p>
                    </td>
                    <td>
                      <span className="font-semibold text-gray-900">{totalHours}H</span>
                    </td>
                    <td><StatusBadge status={ts.status} /></td>
                    <td className="hidden sm:table-cell text-gray-400 text-xs">
                      {ts.submittedAt ? formatDate(ts.submittedAt) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => navigate(buildRoute(ROUTES.TIMESHEET_DETAIL, { id: ts.id }))}>
                        {isEmployee && ['DRAFT', 'REJECTED'].includes(ts.status) ? 'Edit' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Page {meta.page} of {meta.totalPages}</p>
            <div className="flex gap-1.5">
              <button className="btn btn-secondary btn-sm" disabled={!meta.hasPrev} onClick={() => setPage(p => p - 1)}>Prev</button>
              <button className="btn btn-secondary btn-sm" disabled={!meta.hasNext} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
