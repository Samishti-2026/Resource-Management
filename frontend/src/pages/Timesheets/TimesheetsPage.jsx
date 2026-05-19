import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getTimesheets, createTimesheet } from '../../services/timesheetService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import StatusBadge from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate, formatDateInput, getWeekStart } from '../../utils/dateHelpers';
import { ROUTES, buildRoute } from '../../constants/routes';

const STATUS_TABS = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

export default function TimesheetsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const isEmployee = user?.role === 'EMPLOYEE';

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['timesheets', { status, page }],
    queryFn: () => getTimesheets({ status: status || undefined, page, limit: 15 }),
  });

  const createMutation = useMutation({
    mutationFn: () => createTimesheet(formatDateInput(getWeekStart(new Date()))),
    onSuccess: (ts) => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet created');
      navigate(buildRoute(ROUTES.TIMESHEET_DETAIL, { id: ts.id }));
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create timesheet'),
  });

  if (isLoading) return <PageLoader />;

  const timesheets = data?.timesheets ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Timesheets</h1>
          <p className="page-subtitle">
            {isEmployee ? 'Your weekly timesheets' : 'Team timesheets for review'}
          </p>
        </div>
        {isEmployee && (
          <button
            className="btn btn-primary"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : '+ New Timesheet'}
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="filter-bar">
        <span className="text-xs font-medium text-gray-500 hidden sm:block">Status:</span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`pill-tab ${status === s ? 'active' : ''}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        {meta.total != null && (
          <span className="text-xs text-gray-400 ml-auto">{meta.total} total</span>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {!isEmployee && <th>Employee</th>}
                <th>Week Starting</th>
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
                      {isEmployee && <span>Click "New Timesheet" to get started</span>}
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
                      <span className="font-semibold text-gray-900">{totalHours}h</span>
                    </td>
                    <td><StatusBadge status={ts.status} /></td>
                    <td className="hidden sm:table-cell text-gray-400 text-xs">
                      {ts.submittedAt ? formatDate(ts.submittedAt) : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(buildRoute(ROUTES.TIMESHEET_DETAIL, { id: ts.id }))}
                      >
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
            <p className="text-xs text-gray-400">
              Page {meta.page} of {meta.totalPages}
            </p>
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
