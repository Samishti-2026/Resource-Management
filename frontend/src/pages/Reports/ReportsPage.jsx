import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../../services/userService';
import { getProjects } from '../../services/projectService';
import { getTimesheets } from '../../services/timesheetService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { formatDateInput, formatDate } from '../../utils/dateHelpers';
import { API } from '../../constants/api';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import StatusBadge from '../../components/ui/StatusBadge';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const isRM  = user?.role === 'RESOURCE_MANAGER';
  const isPM  = user?.role === 'PROJECT_MANAGER';
  const isEmp = user?.role === 'EMPLOYEE';
  const now   = new Date();

  const [from, setFrom] = useState(formatDateInput(startOfMonth(subMonths(now, 1))));
  const [to,   setTo  ] = useState(formatDateInput(endOfMonth(now)));
  const [selectedEmployee, setSelectedEmployee] = useState(isEmp ? String(user.id) : '');
  const [selectedProject,  setSelectedProject ] = useState('');
  const [downloading, setDownloading] = useState('');
  const [preview, setPreview] = useState(null); // { type, label, timesheets }

  const { data: usersData } = useQuery({
    queryKey: ['users', { role: 'EMPLOYEE', limit: 100 }],
    queryFn: () => getUsers({ role: 'EMPLOYEE', limit: 100 }),
    enabled: isRM || isPM,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', { status: 'ACTIVE', limit: 100 }],
    queryFn: () => getProjects({ status: 'ACTIVE', limit: 100 }),
    enabled: isRM || isPM,
  });

  // Employee's own timesheets for preview
  const { data: myTimesheets } = useQuery({
    queryKey: ['timesheets', { limit: 50 }],
    queryFn: () => getTimesheets({ limit: 50 }),
    enabled: isEmp,
  });

  const employees = usersData?.users ?? [];
  const projects  = projectsData?.projects ?? [];

  const presets = [
    { label: 'This Month',    fn: () => { setFrom(formatDateInput(startOfMonth(now))); setTo(formatDateInput(endOfMonth(now))); } },
    { label: 'Last Month',    fn: () => { const lm = subMonths(now,1); setFrom(formatDateInput(startOfMonth(lm))); setTo(formatDateInput(endOfMonth(lm))); } },
    { label: 'Last 3 Months', fn: () => { setFrom(formatDateInput(startOfMonth(subMonths(now,3)))); setTo(formatDateInput(endOfMonth(now))); } },
  ];

  const downloadReport = async (type) => {
    if (!from || !to) { toast.error('Select a date range'); return; }
    let url = '';
    if (type === 'employee') {
      const empId = isEmp ? user.id : selectedEmployee;
      if (!empId) { toast.error('Select an employee'); return; }
      url = `${API.REPORTS.EMPLOYEE(empId)}?from=${from}&to=${to}`;
    } else if (type === 'project') {
      if (!selectedProject) { toast.error('Select a project'); return; }
      url = `${API.REPORTS.PROJECT(selectedProject)}?from=${from}&to=${to}`;
    } else {
      url = `${API.REPORTS.UTILIZATION}?from=${from}&to=${to}`;
    }
    setDownloading(type);
    try {
      const stored = JSON.parse(localStorage.getItem('auth-storage') ?? '{}');
      const token  = stored?.state?.accessToken;
      const res    = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Download failed'); }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href  = URL.createObjectURL(blob);
      const cd   = res.headers.get('Content-Disposition') ?? '';
      link.download = cd.match(/filename="(.+)"/)?.[1] ?? `report-${type}-${from}-${to}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Report downloaded');
    } catch (err) {
      toast.error(err.message || 'Download failed');
    } finally {
      setDownloading('');
    }
  };

  /* ── Employee self-preview: filter own timesheets by date range ─────────── */
  const myFilteredTimesheets = (myTimesheets?.timesheets ?? []).filter((ts) => {
    const ws = formatDateInput(ts.weekStart);
    return ws >= from && ws <= to;
  });

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Export</h1>
          <p className="page-subtitle">
            {isEmp ? 'View and download your timesheet report' : 'Download Excel reports for timesheets and utilization'}
          </p>
        </div>
      </div>

      {/* ── Date range ──────────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Date Range</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" style={{ width: '10rem' }} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" style={{ width: '10rem' }} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((p) => (
              <button key={p.label} className="btn btn-secondary btn-sm" onClick={p.fn}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Employee: own timesheet preview + download ───────────────────── */}
      {isEmp && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">My Timesheet Report</h3>
              <p className="text-xs text-gray-400">
                {myFilteredTimesheets.length} timesheet(s) in selected range
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => downloadReport('employee')}
              disabled={downloading === 'employee' || myFilteredTimesheets.length === 0}
            >
              {downloading === 'employee'
                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</span>
                : '📥 Download Excel'}
            </button>
          </div>

          {/* Preview table */}
          {myFilteredTimesheets.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No timesheets found in this date range</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Week Starting</th>
                    <th>Week No.</th>
                    <th>Total Hours</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {myFilteredTimesheets.map((ts) => {
                    const totalHours = ts.entries?.reduce((s, e) => s + e.hours, 0) ?? 0;
                    return (
                      <tr key={ts.id}>
                        <td className="font-medium text-gray-900">{formatDate(ts.weekStart, 'dd MMM yyyy')}</td>
                        <td className="text-gray-500">Week {ts.weekNumber}</td>
                        <td className="font-semibold text-blue-700">{totalHours}h</td>
                        <td><StatusBadge status={ts.status} /></td>
                        <td className="text-xs text-gray-400">{ts.submittedAt ? formatDate(ts.submittedAt) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PM / RM: report cards ────────────────────────────────────────── */}
      {(isRM || isPM) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Employee Report */}
          <div className="card flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-blue-50 text-blue-600">👤</div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Employee Report</h3>
                <p className="text-xs text-gray-400">Individual timesheet details</p>
              </div>
            </div>
            <div>
              <label className="label">Employee</label>
              <select className="input" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                <option value="">Select employee…</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary w-full mt-auto"
              onClick={() => downloadReport('employee')}
              disabled={downloading === 'employee' || !selectedEmployee}>
              {downloading === 'employee'
                ? <span className="flex items-center gap-2 justify-center"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</span>
                : '📥 Download Excel'}
            </button>
          </div>

          {/* Project Report */}
          <div className="card flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-green-50 text-green-600">📁</div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Project Report</h3>
                <p className="text-xs text-gray-400">All hours logged per project</p>
              </div>
            </div>
            <div>
              <label className="label">Project</label>
              <select className="input" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary w-full mt-auto"
              onClick={() => downloadReport('project')}
              disabled={downloading === 'project' || !selectedProject}>
              {downloading === 'project'
                ? <span className="flex items-center gap-2 justify-center"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</span>
                : '📥 Download Excel'}
            </button>
          </div>

          {/* Utilization Report — RM only */}
          {isRM && (
            <div className="card flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-purple-50 text-purple-600">📊</div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Utilization Report</h3>
                  <p className="text-xs text-gray-400">Org-wide utilization summary</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">Includes all employees — allocated vs submitted hours.</p>
              <button className="btn btn-primary w-full mt-auto"
                onClick={() => downloadReport('utilization')}
                disabled={downloading === 'utilization'}>
                {downloading === 'utilization'
                  ? <span className="flex items-center gap-2 justify-center"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</span>
                  : '📥 Download Excel'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500">
          Reports include only <strong>Submitted</strong> and <strong>Approved</strong> timesheets within the selected date range.
        </p>
      </div>
    </div>
  );
}
