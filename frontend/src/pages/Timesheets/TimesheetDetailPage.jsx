import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTimesheetById, saveEntries, submitTimesheet,
  approveTimesheet, rejectTimesheet, copyPreviousWeek,
} from '../../services/timesheetService';
import { getProjects } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import {
  formatDate, getWeekDays, getDayName,
  isWeekendDay, formatDateInput, getWeekLabel,
} from '../../utils/dateHelpers';
import { ROUTES } from '../../constants/routes';
import { VALIDATION } from '../../constants';

const MAX = VALIDATION.MAX_HOURS_PER_DAY; // 12

export default function TimesheetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToast();
  const qc = useQueryClient();

  const isEmployee = user?.role === 'EMPLOYEE';
  const canApprove = ['PROJECT_MANAGER', 'RESOURCE_MANAGER'].includes(user?.role);

  const [entries, setEntries] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  /* ── Data fetching ──────────────────────────────────────────────────────── */
  const { data: ts, isLoading } = useQuery({
    queryKey: ['timesheet', id],
    queryFn: () => getTimesheetById(parseInt(id)),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', { status: 'ACTIVE', limit: 100 }],
    queryFn: () => getProjects({ status: 'ACTIVE', limit: 100 }),
    enabled: isEmployee,
  });

  /* ── Initialise entries from loaded timesheet ───────────────────────────── */
  useEffect(() => {
    if (!ts?.entries) return;
    const map = {};
    ts.entries.forEach((e) => {
      map[`${e.projectId}_${formatDateInput(e.entryDate)}`] = {
        hours: e.hours,
        notes: e.notes ?? '',
      };
    });
    setEntries(map);
    setIsDirty(false);
  }, [ts]);

  /* ── Mutations ──────────────────────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: () => {
      const arr = Object.entries(entries)
        .filter(([, v]) => v.hours > 0)
        .map(([key, v]) => {
          const [projectId, entryDate] = key.split('_');
          return { projectId: parseInt(projectId), entryDate, hours: v.hours, notes: v.notes };
        });
      return saveEntries(parseInt(id), arr);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheet', id] });
      toast.success('Draft saved');
      setIsDirty(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitTimesheet(parseInt(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheet', id] });
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet submitted for approval');
    },
    onError: (e) => {
      const ve = e.response?.data?.validationErrors;
      toast.error(ve?.length ? ve[0].errors[0] : (e.response?.data?.message || 'Submission failed'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTimesheet(parseInt(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheet', id] });
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet approved');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectTimesheet(parseInt(id), rejectReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheet', id] });
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet rejected');
      setShowRejectModal(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const copyMutation = useMutation({
    mutationFn: () => copyPreviousWeek(parseInt(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheet', id] });
      toast.success('Previous week entries copied');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'No previous week found'),
  });

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  if (isLoading) return <PageLoader />;
  if (!ts) return <div className="card"><p className="text-sm text-gray-500">Timesheet not found</p></div>;

  const weekDays = getWeekDays(ts.weekStart);
  const canEdit = isEmployee && ['DRAFT', 'REJECTED'].includes(ts.status);

  // Projects to show: employee sees their allocated projects; PM/RM sees projects from entries
  const projects = isEmployee
    ? (projectsData?.projects ?? [])
    : [...new Map((ts.entries ?? []).map((e) => [e.projectId, e.project])).entries()]
        .map(([, p]) => p)
        .filter(Boolean);

  // Sum hours for a specific date across all projects
  const getDailyTotal = (date) => {
    const ds = formatDateInput(date);
    return Object.entries(entries)
      .filter(([k]) => k.endsWith(`_${ds}`))
      .reduce((s, [, v]) => s + (parseFloat(v.hours) || 0), 0);
  };

  // Sum hours for a specific project across all days
  const getProjectTotal = (projectId) =>
    weekDays.reduce((s, d) => {
      const k = `${projectId}_${formatDateInput(d)}`;
      return s + (parseFloat(entries[k]?.hours) || 0);
    }, 0);

  const weekTotal = Object.values(entries).reduce((s, v) => s + (parseFloat(v.hours) || 0), 0);

  // Days that exceed 12h limit
  const overLimitDays = weekDays.filter((d) => getDailyTotal(d) > MAX);

  const handleChange = (projectId, date, value) => {
    const key = `${projectId}_${formatDateInput(date)}`;
    const hours = parseFloat(value) || 0;
    setEntries((prev) => ({
      ...prev,
      [key]: { ...prev[key], hours, notes: prev[key]?.notes ?? '' },
    }));
    setIsDirty(true);
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <button
            onClick={() => navigate(ROUTES.TIMESHEETS)}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1"
          >
            ← Back to Timesheets
          </button>
          <h1 className="page-title">
            Weekly Timesheet
          </h1>
          <p className="page-subtitle">
            {/* Week range */}
            <span className="font-medium text-gray-700">
              {getWeekLabel(ts.weekStart)}
            </span>
            {/* Employee name for PM/RM view */}
            {!isEmployee && (
              <span className="ml-2 text-gray-400">· {ts.employee?.name}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={ts.status} />
          {canEdit && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => copyMutation.mutate()}
              disabled={copyMutation.isPending}
            >
              📋 Copy Previous Week
            </button>
          )}
        </div>
      </div>

      {/* ── Rejection banner ────────────────────────────────────────────── */}
      {ts.status === 'REJECTED' && ts.rejectReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-red-800 mb-0.5">Rejection Reason</p>
          <p className="text-xs text-red-700">{ts.rejectReason}</p>
        </div>
      )}

      {/* ── Over-limit warning ──────────────────────────────────────────── */}
      {overLimitDays.length > 0 && canEdit && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-red-800">Daily limit exceeded (max {MAX}h/day)</p>
            <p className="text-xs text-red-600 mt-0.5">
              {overLimitDays.map((d) => `${getDayName(d)} ${formatDate(d, 'dd-MMM')} (${getDailyTotal(d)}h)`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Timesheet grid ──────────────────────────────────────────────── */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="table" style={{ minWidth: '700px' }}>
            <thead>
              {/* Row 1: column labels */}
              <tr>
                {/* User Name column — shown for PM/RM, or current user for employee */}
                <th className="text-left" style={{ minWidth: '110px' }}>User Name</th>
                <th className="text-left" style={{ minWidth: '130px' }}>Project</th>

                {weekDays.map((day) => {
                  const isWE = isWeekendDay(day);
                  const dayTotal = getDailyTotal(day);
                  const isOver = dayTotal > MAX;
                  const isWarn = dayTotal >= 10 && dayTotal <= MAX;

                  return (
                    <th
                      key={day.toISOString()}
                      className={`text-center ${isWE ? 'bg-slate-100' : ''}`}
                      style={{ minWidth: '72px' }}
                    >
                      {/* Day name */}
                      <div className={`text-xs font-semibold ${isWE ? 'text-slate-400' : 'text-gray-700'}`}>
                        {getDayName(day)}
                      </div>
                      {/* Date — format: 18-May */}
                      <div className={`text-xs font-normal ${isWE ? 'text-slate-400' : 'text-gray-500'}`}>
                        {formatDate(day, 'dd-MMM')}
                      </div>
                      {/* Weekend label */}
                      {isWE && (
                        <div className="text-xs text-orange-400 font-normal leading-tight">Weekend</div>
                      )}
                    </th>
                  );
                })}

                <th className="text-center" style={{ minWidth: '60px' }}>Total</th>
              </tr>
            </thead>

            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400 text-xs">
                    No allocated projects found for this week
                  </td>
                </tr>
              ) : (
                projects.map((project, idx) => {
                  const projTotal = getProjectTotal(project.id);
                  // Show user name only on first project row, then blank (like Excel merge)
                  const showUserName = idx === 0;

                  return (
                    <tr key={project.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* User Name — shown once, vertically centred across rows */}
                      <td className="align-middle">
                        {showUserName ? (
                          <span className="text-xs font-semibold text-gray-800">
                            {isEmployee ? user?.name : ts.employee?.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">↑</span>
                        )}
                      </td>

                      {/* Project name */}
                      <td>
                        <span className="text-xs font-medium text-gray-800 truncate block max-w-[120px]" title={project.name}>
                          {project.name}
                        </span>
                      </td>

                      {/* Hour cells — one per day */}
                      {weekDays.map((day) => {
                        const isWE = isWeekendDay(day);
                        const key = `${project.id}_${formatDateInput(day)}`;
                        const val = entries[key]?.hours;
                        const displayVal = val !== undefined && val !== null ? val : '';
                        const dayTotal = getDailyTotal(day);
                        const isOver = dayTotal > MAX;

                        return (
                          <td
                            key={day.toISOString()}
                            className={`text-center p-1 ${isWE ? 'bg-slate-50' : ''}`}
                          >
                            {canEdit && !isWE ? (
                              /* Editable input */
                              <input
                                type="number"
                                min="0"
                                max="12"
                                step="0.5"
                                value={displayVal}
                                onChange={(e) => handleChange(project.id, day, e.target.value)}
                                className={`
                                  w-14 text-center text-xs border rounded-md px-1 py-1.5
                                  outline-none transition-colors
                                  focus:ring-2 focus:ring-blue-400 focus:border-blue-400
                                  ${isOver
                                    ? 'border-red-400 bg-red-50 text-red-700 font-semibold'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                  }
                                `}
                                placeholder="0"
                              />
                            ) : (
                              /* Read-only display */
                              <span className={`
                                text-xs font-medium
                                ${isWE ? 'text-gray-300' : (displayVal > 0 ? 'text-gray-800' : 'text-gray-400')}
                              `}>
                                {isWE ? '—' : (displayVal !== '' ? displayVal : '0')}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Project row total */}
                      <td className="text-center">
                        <span className={`text-xs font-bold ${projTotal > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                          {projTotal > 0 ? projTotal : '0'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* ── Daily Total row ──────────────────────────────────────── */}
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="text-xs font-bold text-gray-700 py-2" colSpan={2}>
                  Daily Total
                </td>
                {weekDays.map((day) => {
                  const t = getDailyTotal(day);
                  const isWE = isWeekendDay(day);
                  const isOver = t > MAX;
                  const isWarn = t >= 10 && t <= MAX;

                  return (
                    <td key={day.toISOString()} className={`text-center py-2 ${isWE ? 'bg-slate-100' : ''}`}>
                      <span className={`
                        text-xs font-bold px-1.5 py-0.5 rounded
                        ${isOver
                          ? 'bg-red-100 text-red-700'
                          : isWarn
                          ? 'bg-yellow-100 text-yellow-700'
                          : t > 0
                          ? 'text-green-700'
                          : 'text-gray-300'
                        }
                      `}>
                        {isWE ? '—' : (t > 0 ? `${t}h` : '0h')}
                      </span>
                    </td>
                  );
                })}
                <td className="text-center py-2">
                  <span className="text-xs font-bold text-gray-900">{weekTotal}h</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Legend ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" />
            Normal (≤ 9h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" />
            Near limit (10–12h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
            Exceeds limit (&gt; 12h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block" />
            Weekend
          </span>
          <span className="ml-auto font-medium text-gray-600">
            Max {MAX}h per day across all projects
          </span>
        </div>
      </div>

      {/* ── Week summary bar ────────────────────────────────────────────── */}
      <div className="card card-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-gray-500">Week:</span>
            <span className="font-semibold text-gray-800 ml-1">{getWeekLabel(ts.weekStart)}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Hours:</span>
            <span className="font-bold text-blue-700 ml-1">{weekTotal}h</span>
          </div>
          <div>
            <span className="text-gray-500">Projects:</span>
            <span className="font-semibold text-gray-800 ml-1">{projects.length}</span>
          </div>
          {overLimitDays.length > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{overLimitDays.length} day(s) exceed {MAX}h limit</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !isDirty}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || overLimitDays.length > 0}
                title={overLimitDays.length > 0 ? `Fix daily limit errors before submitting` : ''}
              >
                {submitMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </>
          )}
          {canApprove && ts.status === 'SUBMITTED' && (
            <>
              <button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>
                Reject
              </button>
              <button
                className="btn btn-success"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? 'Approving…' : 'Approve'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Reject modal ────────────────────────────────────────────────── */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Timesheet" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Provide a reason — the employee will see this message.</p>
          <div>
            <label className="label">Reason *</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this timesheet is being rejected…"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectReason.length < 5 || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject Timesheet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
