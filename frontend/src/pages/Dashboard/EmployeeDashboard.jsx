import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getEmployeeDashboard } from '../../services/dashboardService';
import StatCard from '../../components/ui/StatCard';
import UtilizationDonut from '../../components/charts/UtilizationDonut';
import WeeklyBarChart from '../../components/charts/WeeklyBarChart';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { ROUTES } from '../../constants/routes';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { data: d = {}, isLoading } = useQuery({
    queryKey: ['dashboard', 'employee'],
    queryFn: getEmployeeDashboard,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-subtitle">Your timesheet overview for this month</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate(ROUTES.TIMESHEETS)}>
          + New Timesheet
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Allocated Hours" value={`${d.allocatedHours ?? 0}h`} subtitle="This month" color="blue"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard title="Submitted Hours" value={`${d.submittedHours ?? 0}h`} subtitle="This month" color="green"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard title="Utilization" value={`${d.utilizationPct ?? 0}%`} subtitle="Submitted / Allocated"
          color={d.utilizationPct >= 80 ? 'green' : d.utilizationPct >= 50 ? 'yellow' : 'red'}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
        <StatCard title="Pending Approvals" value={d.pendingApprovals ?? 0} subtitle="Awaiting review" color="yellow"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Monthly Utilization</h3>
          <UtilizationDonut utilized={d.submittedHours ?? 0} allocated={d.allocatedHours ?? 0} />
          <div className="flex justify-between text-xs text-gray-500 mt-3">
            <span>Submitted: <strong className="text-gray-800">{d.submittedHours ?? 0}h</strong></span>
            <span>Allocated: <strong className="text-gray-800">{d.allocatedHours ?? 0}h</strong></span>
          </div>
        </div>
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Weekly Hours Trend</h3>
          <WeeklyBarChart data={d.weeklyTrend ?? []} />
        </div>
      </div>

      {/* Project breakdown + quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Project Breakdown</h3>
          {(d.projectBreakdown ?? []).length === 0
            ? <p className="text-xs text-gray-400">No hours logged this month</p>
            : <div className="space-y-2">
                {d.projectBreakdown.map((p) => (
                  <div key={p.projectId} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 truncate">{p.projectName}</span>
                    <span className="text-xs font-semibold text-gray-800 ml-2 flex-shrink-0">{p.hours}h</span>
                  </div>
                ))}
              </div>
          }
        </div>
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h3>
          <button className="btn btn-primary w-full" onClick={() => navigate(ROUTES.TIMESHEETS)}>
            📋 Fill This Week's Timesheet
          </button>
          <button className="btn btn-secondary w-full" onClick={() => navigate(ROUTES.WORK_REQUESTS)}>
            ⚠️ Raise Work Request
          </button>
          {(d.pendingExceptions ?? 0) > 0 && (
            <div className="mt-2 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>{d.pendingExceptions}</strong> pending work request(s)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
