import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPMDashboard } from '../../services/dashboardService';
import StatCard from '../../components/ui/StatCard';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { ROUTES } from '../../constants/routes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function PMDashboard() {
  const navigate = useNavigate();
  const { data: d = {}, isLoading } = useQuery({
    queryKey: ['dashboard', 'pm'],
    queryFn: getPMDashboard,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Manager Dashboard</h1>
          <p className="page-subtitle">Team overview and pending actions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Team Utilization" value={`${d.teamUtilization ?? 0}%`} subtitle="This month" color="blue"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <StatCard title="Pending Timesheets" value={d.pendingTimesheets ?? 0} subtitle="Awaiting approval" color="yellow"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
        <StatCard title="Work Requests" value={d.pendingExceptions ?? 0} subtitle="Pending review" color="red"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard title="Active Projects" value={d.activeProjects ?? 0} subtitle="Under management" color="green"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>} />
      </div>

      {/* Project analytics */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Project Analytics — Allocated vs Used Hours</h3>
        {(d.projectAnalytics ?? []).length === 0
          ? <p className="text-xs text-gray-400">No project data available</p>
          : <div className="h-52 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.projectAnalytics} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}h`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="allocated" name="Allocated" fill="#bfdbfe" radius={[3,3,0,0]} />
                  <Bar dataKey="used"      name="Used"      fill="#2563eb" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        }
      </div>

      {/* Quick actions + project summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h3>
          <button className="btn btn-primary w-full" onClick={() => navigate(ROUTES.TIMESHEETS + '?status=SUBMITTED')}>
            📋 Review Timesheets ({d.pendingTimesheets ?? 0})
          </button>
          <button className="btn btn-secondary w-full" onClick={() => navigate(ROUTES.WORK_REQUESTS + '?status=PENDING')}>
            ⚠️ Review Work Requests ({d.pendingExceptions ?? 0})
          </button>
          <button className="btn btn-secondary w-full" onClick={() => navigate(ROUTES.ALLOCATIONS)}>
            ⏱️ Manage Allocations
          </button>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Project Summary</h3>
          <div className="space-y-3">
            {(d.projectAnalytics ?? []).map((p) => {
              const pct = p.allocated > 0 ? Math.round((p.used / p.allocated) * 100) : 0;
              return (
                <div key={p.projectId}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 truncate">{p.name}</span>
                    <span className="text-gray-400 ml-2 flex-shrink-0">{pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className={`progress-fill ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
