import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../constants';
import EmployeeDashboard from './EmployeeDashboard';
import PMDashboard from './PMDashboard';
import RMDashboard from './RMDashboard';
import { PageLoader } from '../../components/ui/LoadingSpinner';

export default function DashboardPage() {
  const { user } = useAuthStore();
  if (!user) return <PageLoader />;
  if (user.role === ROLES.EMPLOYEE)         return <EmployeeDashboard />;
  if (user.role === ROLES.PROJECT_MANAGER)  return <PMDashboard />;
  if (user.role === ROLES.RESOURCE_MANAGER) return <RMDashboard />;
  return null;
}
