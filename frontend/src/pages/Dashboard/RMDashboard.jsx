import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getRMDashboard } from '../../services/dashboardService';
import StatCard from '../../components/ui/StatCard';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { ROUTES } from '../../constants/routes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function RMDashboard() {
  const navigate = useNavigate();
  const { data: d = {}, isLoading } = useQuery({
    queryKey: ['dashboard', 'rm'],
    queryFn: getRMDashboard,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Resource Manager Dashboard</h1>
          <p className="page-subtitle">Organization-wide overview</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Org Utilization" value={`${d.orgUtilization ?? 0}%`} subtitle="This month" color="blue"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
        <StatCard title="Active Projects" value={d.activeProjects ?? 0} subtitle="Currently running" color="green"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>} />
        <StatCard title="Total Employees" value={d.totalEmployees ?? 0} subtitle="Active headcount" color="purple"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <StatCard title="Compliance Breaches" value={d.complianceBreaches ?? 0} subtitle="No timesheet this month" color="red"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      </div>

      {/* Charts + pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Skill Utilization</h3>
          {(d.skillUtilization ?? []).length === 0
            ? <p className="text-xs text-gray-400">No skill data</p>
            : <div className="h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.skillUtilization} layout="vertical" margin={{ top: 0, right: 16, left: 56, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="skill" type="category" tick={{ fontSize: 10 }} width={56} />
                    <Tooltip />
                    <Bar dataKey="employeeCount" name="Total"  fill="#bfdbfe" radius={[0,3,3,0]} />
                    <Bar dataKey="utilizedCount" name="Active" fill="#2563eb" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          }
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Pending Actions</h3>
          {[
            { label: 'Timesheets to Review', sub: 'Submitted, awaiting approval', val: d.pendingTimesheets ?? 0, color: 'bg-yellow-50 border-yellow-100', tc: 'text-yellow-700' },
            { label: 'Work Requests',        sub: 'Pending review',               val: d.pendingExceptions ?? 0, color: 'bg-red-50 border-red-100',    tc: 'text-red-700' },
            { label: 'Compliance Breaches',  sub: 'Employees with no timesheet',  val: d.complianceBreaches ?? 0, color: 'bg-orange-50 border-orange-100', tc: 'text-orange-700' },
          ].map((item) => (
            <div key={item.label} className={`flex items-center justify-between p-3 rounded-lg border ${item.color}`}>
              <div>
                <p className="text-xs font-semibold text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500">{item.sub}</p>
              </div>
              <span className={`text-xl font-bold ${item.tc}`}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Create Project', icon: '📁', to: ROUTES.PROJECTS },
            { label: 'Manage Users',   icon: '👥', to: ROUTES.USERS },
            { label: 'Upload Holidays',icon: '🗓️', to: ROUTES.HOLIDAYS },
            { label: 'Download Reports',icon:'📈', to: ROUTES.REPORTS },
          ].map((a) => (
            <button key={a.to} onClick={() => navigate(a.to)}
              className="btn btn-secondary flex-col gap-1.5 py-3 h-auto text-xs">
              <span className="text-xl">{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
