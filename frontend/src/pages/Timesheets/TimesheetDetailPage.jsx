import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTimesheetById, saveEntries, submitTimesheet,
  approveTimesheet, rejectTimesheet, copyPreviousWeek,
} from '../../services/timesheetService';
import { getAllocations } from '../../services/allocationService';
import { getHolidays } from '../../services/holidayService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import StatusBadge from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import TimesheetGrid from '../../components/timesheets/TimesheetGrid';
import TimesheetActionBar from '../../components/timesheets/TimesheetActionBar';
import { formatDate, formatDateInput, getWeekDays, getWeekLabel } from '../../utils/dateHelpers';
import { addDays, subDays } from 'date-fns';
import { ROUTES } from '../../constants/routes';

const MAX          = 12;
const MAX_DAYS_PAST   = 14;
const MAX_DAYS_FUTURE = 7;

export default function TimesheetDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuthStore();
  const toast      = useToast();
  const qc         = useQueryClient();

  const isEmployee = user?.role === 'EMPLOYEE';
  const canApprove = ['PROJECT_MANAGER', 'RESOURCE_MANAGER'].includes(user?.role);

  const [entries,  setEntries ] = useState({});
  const [remarks,  setRemarks ] = useState('');
  const [isDirty,  setIsDirty ] = useState(false);

  /* ── Queries ──────────────────────────────────────────────────────────── */
  const { data: ts, isLoading } = useQuery({
    queryKey: ['timesheet', id],
    queryFn:  () => getTimesheetById(parseInt(id)),
  });

  /* Fetch only the employee's allocated projects — not all active projects */
  const { data: allocationsData } = useQuery({
    queryKey: ['my-allocations'],
    queryFn:  () => getAllocations({}),
    enabled:  isEmployee,
  });

  const weekYear = ts?.weekStart ? new Date(ts.weekStart).getFullYear() : new Date().getFullYear();
  const { data: holidayList = [] } = useQuery({
    queryKey: ['holidays', weekYear],
    queryFn:  () => getHolidays({ year: weekYear }),
    enabled:  !!ts,
  });

  const holidayDateSet = new Set(holidayList.map((h) => formatDateInput(h.holidayDate)));
  const holidayNameMap = Object.fromEntries(holidayList.map((h) => [formatDateInput(h.holidayDate), h.holidayName]));

  /* ── Initialise entries ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!ts) return;
    const map = {};
    (ts.entries ?? []).forEach((e) => {
      map[`${e.projectId}_${formatDateInput(e.entryDate)}`] = { hours: e.hours, notes: e.notes ?? '' };
    });
    setEntries(map);
    setRemarks(ts.remarks ?? '');
    setIsDirty(false);
  }, [ts]);

  /* ── Mutations ────────────────────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: () => {
      const arr = Object.entries(entries)
        .filter(([, v]) => v.hours > 0)
        .map(([key, v]) => {
          const [projectId, entryDate] = key.split('_');
          return { projectId: parseInt(projectId), entryDate, hours: v.hours, notes: v.notes };
        });
      return saveEntries(parseInt(id), arr, remarks);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); toast.success('Draft saved'); setIsDirty(false); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Save failed'),
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
      if (ve?.length) {
        const first = ve[0];
        const dateStr = first.entryDate ? formatDate(first.entryDate, 'dd MMM') : '';
        toast.error(`${dateStr ? dateStr + ': ' : ''}${first.errors?.[0] ?? 'Validation failed'}`);
      } else {
        toast.error(e.response?.data?.message || 'Submission failed');
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: (approveRemarks) => approveTimesheet(parseInt(id), approveRemarks),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); qc.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Timesheet approved'); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason) => rejectTimesheet(parseInt(id), reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); qc.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Timesheet rejected'); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const copyMutation = useMutation({
    mutationFn: () => copyPreviousWeek(parseInt(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet', id] }); toast.success('Previous week entries copied'); },
    onError:   (e) => toast.error(e.response?.data?.message || 'No previous week found'),
  });

  /* ── Guards ───────────────────────────────────────────────────────────── */
  if (isLoading) return <PageLoader />;
  if (!ts) return <div className="card"><p className="text-sm text-gray-500">Timesheet not found</p></div>;

  const weekDays = getWeekDays(ts.weekStart);
  const canEdit  = isEmployee && ['DRAFT', 'REJECTED'].includes(ts.status);

  const today      = new Date();
  const minAllowed = formatDateInput(subDays(today, MAX_DAYS_PAST));
  const maxAllowed = formatDateInput(addDays(today, MAX_DAYS_FUTURE));

  const projects = isEmployee
    ? (allocationsData ?? []).map((a) => a.project).filter(Boolean)
    : [...new Map((ts.entries ?? []).map((e) => [e.projectId, e.project])).entries()]
        .map(([, p]) => p).filter(Boolean);

  const getDailyTotal = (date) => {
    const ds = formatDateInput(date);
    return Object.entries(entries).filter(([k]) => k.endsWith(`_${ds}`))
      .reduce((s, [, v]) => s + (parseFloat(v.hours) || 0), 0);
  };

  const weekTotal    = Object.values(entries).reduce((s, v) => s + (parseFloat(v.hours) || 0), 0);
  const overLimitDays = weekDays.filter((d) => getDailyTotal(d) > MAX);

  const handleChangeEntry = (projectId, date, value) => {
    const key = `${projectId}_${formatDateInput(date)}`;
    setEntries((prev) => ({ ...prev, [key]: { ...prev[key], hours: parseFloat(value) || 0, notes: prev[key]?.notes ?? '' } }));
    setIsDirty(true);
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <button onClick={() => navigate(ROUTES.TIMESHEETS)}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1">
            ← Back to Timesheets
          </button>
          <h1 className="page-title">Weekly Timesheet</h1>
          <p className="page-subtitle">
            <span className="font-medium text-gray-700">{getWeekLabel(ts.weekStart)}</span>
            {!isEmployee && <span className="ml-2 text-gray-400">· {ts.employee?.name}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={ts.status} />
          {canEdit && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending}>
              📋 Copy Previous Week
            </button>
          )}
        </div>
      </div>

      {/* Allowed window banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-xs text-blue-700">
          <span className="font-semibold">Allowed entry window:</span>{' '}
          {formatDate(minAllowed, 'dd MMM yyyy')} – {formatDate(maxAllowed, 'dd MMM yyyy')}
          <span className="text-blue-500 ml-1">(2 weeks past · 1 week future)</span>
        </p>
      </div>

      {/* Rejection banner */}
      {ts.status === 'REJECTED' && ts.rejectReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-red-800 mb-0.5">Rejection Reason</p>
          <p className="text-xs text-red-700">{ts.rejectReason}</p>
        </div>
      )}

      {/* Over-limit warning */}
      {overLimitDays.length > 0 && canEdit && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-red-800">Daily limit exceeded (max {MAX}h/day)</p>
            <p className="text-xs text-red-600 mt-0.5">
              {overLimitDays.map((d) => `${formatDate(d, 'EEE dd-MMM')} (${getDailyTotal(d)}h)`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Allocation Budget Summary — Employee only */}
      {isEmployee && (allocationsData ?? []).length > 0 && (
        <div className="card card-sm">
          <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Project Allocation Budget
          </h3>
          <div className="space-y-3">
            {(allocationsData ?? []).map((a) => {
              const allocated  = a.allocatedHours ?? 0;
              const used       = a.usedHours ?? 0;
              const remaining  = a.remainingHours ?? Math.max(0, allocated - used);
              const pct        = allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0;
              const isLow      = remaining < allocated * 0.2; // < 20% remaining
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[160px]"
                      title={a.project?.name}>{a.project?.name}</span>
                    <div className="flex items-center gap-3 text-xs flex-shrink-0 ml-2">
                      <span className="text-gray-500">
                        Allocated: <strong className="text-gray-800">{allocated}H</strong>
                      </span>
                      <span className="text-gray-500">
                        Used: <strong className="text-blue-700">{used}H</strong>
                      </span>
                      <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                        Remaining: {remaining}H
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{pct}% used</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      <TimesheetGrid
        weekStart={ts.weekStart}
        projects={projects}
        entries={entries}
        canEdit={canEdit}
        holidayDateSet={holidayDateSet}
        holidayNameMap={holidayNameMap}
        onChangeEntry={handleChangeEntry}
        allocations={allocationsData ?? []}
      />

      {/* Remarks */}
      <div className="card card-sm">
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
          Remarks / Notes
          <span className="text-gray-400 font-normal ml-1">(common for this week)</span>
        </label>
        {canEdit ? (
          <textarea className="input resize-none text-xs" rows={2} maxLength={500}
            placeholder="Add any notes or remarks for this week's timesheet…"
            value={remarks}
            onChange={(e) => { setRemarks(e.target.value); setIsDirty(true); }} />
        ) : (
          <p className="text-xs text-gray-600 min-h-[2rem]">
            {ts.remarks || <span className="text-gray-400 italic">No remarks</span>}
          </p>
        )}
      </div>

      {/* Action bar */}
      <TimesheetActionBar
        weekStart={ts.weekStart}
        weekTotal={weekTotal}
        projects={projects}
        overLimitDays={overLimitDays}
        canEdit={canEdit}
        canApprove={canApprove}
        tsStatus={ts.status}
        isDirty={isDirty}
        onSave={() => saveMutation.mutate()}
        onSubmit={() => submitMutation.mutate()}
        onApprove={(r) => approveMutation.mutate(r)}
        onReject={(r) => rejectMutation.mutate(r)}
        isSaving={saveMutation.isPending}
        isSubmitting={submitMutation.isPending}
        isApproving={approveMutation.isPending}
        isRejecting={rejectMutation.isPending}
      />
    </div>
  );
}
