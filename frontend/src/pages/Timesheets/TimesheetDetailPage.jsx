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
import { formatDate, getWeekDays, getDayName, isWeekendDay, formatDateInput } from '../../utils/dateHelpers';
import { ROUTES } from '../../constants/routes';
import { VALIDATION } from '../../constants';

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

  const { data: ts, isLoading } = useQuery({
    queryKey: ['timesheet', id],
    queryFn: () => getTimesheetById(parseInt(id)),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', { status: 'ACTIVE', limit: 100 }],
    queryFn: () => getProjects({ status: 'ACTIVE', limit: 100 }),
    enabled: isEmployee,
  });

  // Initialise entries from loaded timesheet
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); toast.success('Saved'); setIsDirty(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitTimesheet(parseInt(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); qc.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Submitted for approval'); },
    onError: (e) => {
      const ve = e.response?.data?.validationErrors;
      toast.error(ve?.length ? ve[0].errors[0] : (e.response?.data?.message || 'Submission failed'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTimesheet(parseInt(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); qc.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Approved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectTimesheet(parseInt(id), rejectReason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); qc.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Rejected'); setShowRejectModal(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const copyMutation = useMutation({
    mutationFn: () => copyPreviousWeek(parseInt(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); toast.success('Previous week copied'); },
    onError: (e) => toast.error(e.response?.data?.message || 'No previous week found'),
  });

  if (isLoading) return <PageLoader />;
  if (!ts) return <div className="card"><p className="text-sm text-gray-500">Timesheet not found</p></div>;

  const weekDays = getWeekDays(ts.weekStart);
  const canEdit = isEmployee && ['DRAFT', 'REJECTED'].includes(ts.status);

  const projects = isEmployee
    ? (projectsData?.projects ?? [])
    : [...new Map((ts.entries ?? []).map((e) => [e.projectId, e.project])).entries()].map(([, p]) => p).filter(Boolean);

  const getDailyTotal = (date) => {
    const ds = formatDateInput(date);
    return Object.entries(entries)
      .filter(([k]) => k.endsWith(`_${ds}`))
      .reduce((s, [, v]) => s + (parseFloat(v.hours) || 0), 0);
  };

  const weekTotal = Object.values(entries).reduce((s, v) => s + (parseFloat(v.hours) || 0), 0);

  const handleChange = (projectId, date, hours) => {
    const key = `${projectId}_${formatDateInput(date)}`;
    setEntries((prev) => ({ ...prev, [key]: { ...prev[key], hours: parseFloat(hours) || 0, notes: prev[key]?.notes ?? '' } }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <button
            onClick={() => navigate(ROUTES.TIMESHEETS)}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1"
          >
            ← Back
          </button>
          <h1 className="page-title">Week of {formatDate(ts.weekStart, 'dd MMM yyyy')}</h1>
          {!isEmployee && <p className="page-subtitle">{ts.employee?.name}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={ts.status} />
          {canEdit && (
            <button className="btn btn-secondary btn-sm" onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending}>
              📋 Copy Previous Week
            </button>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {ts.status === 'REJECTED' && ts.rejectReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-red-800 mb-0.5">Rejection Reason</p>
          <p className="text-xs text-red-700">{ts.rejectReason}</p>
        </div>
      )}

      {/* Grid */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="table" style={{ minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '140px' }}>Project</th>
                {weekDays.map((day) => {
                  const isWE = isWeekendDay(day);
                  return (
                    <th key={day.toISOString()} className={`text-center ${isWE ? 'bg-slate-100 text-slate-400' : ''}`} style={{ minWidth: '80px' }}>
                      <div className="text-xs">{getDayName(day)}</div>
                      <div className="text-xs font-normal text-gray-400">{formatDate(day, 'dd MMM')}</div>
                      {isWE && <div className="text-xs text-orange-400 font-normal">Weekend</div>}
                    </th>
                  );
                })}
                <th className="text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const projTotal = weekDays.reduce((s, d) => {
                  const k = `${project.id}_${formatDateInput(d)}`;
                  return s + (parseFloat(entries[k]?.hours) || 0);
                }, 0);
                return (
                  <tr key={project.id}>
                    <td>
                      <p className="text-xs font-medium text-gray-800 truncate max-w-[130px]">{project.name}</p>
                    </td>
                    {weekDays.map((day) => {
                      const isWE = isWeekendDay(day);
                      const key = `${project.id}_${formatDateInput(day)}`;
                      const val = entries[key]?.hours || '';
                      const dayTotal = getDailyTotal(day);
                      const overLimit = dayTotal > VALIDATION.MAX_HOURS_PER_DAY;
                      return (
                        <td key={day.toISOString()} className={`text-center p-1 ${isWE ? 'bg-slate-50' : ''}`}>
                          {canEdit && !isWE ? (
                            <input
                              type="number"
                              min="0"
                              max="12"
                              step="0.5"
                              value={val}
                              onChange={(e) => handleChange(project.id, day, e.target.value)}
                              className={`w-14 text-center text-xs border rounded px-1 py-1 outline-none focus:ring-1 focus:ring-blue-400 ${overLimit ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                              placeholder="0"
                            />
                          ) : (
                            <span className={`text-xs ${isWE ? 'text-gray-300' : 'text-gray-700'}`}>
                              {isEmployee && isWE ? '—' : (val || '—')}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center font-semibold text-xs text-gray-800">
                      {projTotal > 0 ? `${projTotal}h` : '—'}
                    </td>
                  </tr>
                );
              })}

              {/* Daily totals row */}
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="text-xs font-semibold text-gray-600">Daily Total</td>
                {weekDays.map((day) => {
                  const t = getDailyTotal(day);
                  const cls = t > VALIDATION.MAX_HOURS_PER_DAY ? 'text-red-600 font-bold'
                    : t >= 10 ? 'text-yellow-600 font-semibold'
                    : t > 0 ? 'text-green-700 font-semibold'
                    : 'text-gray-300';
                  return (
                    <td key={day.toISOString()} className={`text-center text-xs ${cls}`}>
                      {t > 0 ? `${t}h` : '—'}
                    </td>
                  );
                })}
                <td className="text-center text-xs font-bold text-gray-900">{weekTotal}h</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-gray-500">
          Week total: <strong className="text-gray-900">{weekTotal}h</strong>
        </p>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <>
              <button className="btn btn-secondary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !isDirty}>
                {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
              </button>
              <button className="btn btn-primary" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                {submitMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </>
          )}
          {canApprove && ts.status === 'SUBMITTED' && (
            <>
              <button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>Reject</button>
              <button className="btn btn-success" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? 'Approving…' : 'Approve'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reject modal */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Timesheet" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Provide a reason — the employee will see this.</p>
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
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
