import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllocations, createAllocation, updateAllocation, deleteAllocation } from '../../services/allocationService';
import { getProjects } from '../../services/projectService';
import { getUsers } from '../../services/userService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { useForm } from 'react-hook-form';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { PageLoader } from '../../components/ui/LoadingSpinner';

export default function AllocationsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const qc = useQueryClient();
  const canManage = ['RESOURCE_MANAGER', 'PROJECT_MANAGER'].includes(user?.role);

  const [showModal, setShowModal] = useState(false);
  const [editAlloc, setEditAlloc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [projectFilter, setProjectFilter] = useState('');

  const { data: allocData, isLoading } = useQuery({
    queryKey: ['allocations', { projectId: projectFilter }],
    queryFn: () => getAllocations({ projectId: projectFilter || undefined }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', { status: 'ACTIVE', limit: 100 }],
    queryFn: () => getProjects({ status: 'ACTIVE', limit: 100 }),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['users', { role: 'EMPLOYEE', limit: 100 }],
    queryFn: () => getUsers({ role: 'EMPLOYEE', limit: 100 }),
    enabled: canManage,
  });

  const createMutation = useMutation({
    mutationFn: createAllocation,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allocations'] }); toast.success('Allocation created'); setShowModal(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateAllocation(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allocations'] }); toast.success('Updated'); setEditAlloc(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAllocation,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allocations'] }); toast.success('Removed'); setDeleteTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  const allocations = allocData || [];
  const projects = projectsData?.projects || [];
  const employees = employeesData?.users || [];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Allocations</h1>
          <p className="page-subtitle">
            {canManage ? 'Assign project hours to team members' : 'Your project hour allocations'}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Allocation</button>
        )}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <label className="text-xs font-medium text-gray-500">Project:</label>
        <select className="input" style={{ width: '14rem' }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{allocations.length} allocation(s)</span>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Project</th>
                <th>Allocated Hours</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr><td colSpan={canManage ? 4 : 3}>
                  <div className="empty-state">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No allocations found</p>
                    {canManage && <span>Click "New Allocation" to assign hours</span>}
                  </div>
                </td></tr>
              ) : allocations.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="avatar avatar-sm flex-shrink-0">{a.employee?.name?.[0]}</div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{a.employee?.name}</p>
                        <p className="text-xs text-gray-400 truncate hidden sm:block">{a.employee?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                      {a.project?.name}
                    </span>
                  </td>
                  <td>
                    <span className="text-base font-bold text-blue-700">{a.allocatedHours}</span>
                    <span className="text-xs text-gray-400 ml-1">hrs</span>
                  </td>
                  {canManage && (
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditAlloc(a)}>Edit</button>
                        <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => setDeleteTarget(a)}>Remove</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AllocationModal
        isOpen={showModal || !!editAlloc}
        onClose={() => { setShowModal(false); setEditAlloc(null); }}
        allocation={editAlloc}
        projects={projects}
        employees={employees}
        onSubmit={(d) => {
          const payload = { ...d, allocatedHours: parseFloat(d.allocatedHours) };
          if (!editAlloc) { payload.employeeId = parseInt(d.employeeId); payload.projectId = parseInt(d.projectId); }
          if (editAlloc) updateMutation.mutate({ id: editAlloc.id, data: payload });
          else createMutation.mutate(payload);
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        title="Remove Allocation"
        message={`Remove ${deleteTarget?.allocatedHours}h allocation for ${deleteTarget?.employee?.name} on ${deleteTarget?.project?.name}?`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}

function AllocationModal({ isOpen, onClose, allocation, projects, employees, onSubmit, isLoading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: allocation ? { allocatedHours: allocation.allocatedHours } : {},
  });
  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} title={allocation ? `Edit Hours — ${allocation.employee?.name}` : 'New Allocation'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!allocation && (
          <>
            <div>
              <label className="label">Employee *</label>
              <select {...register('employeeId', { required: 'Required' })} className={`input ${errors.employeeId ? 'input-error' : ''}`}>
                <option value="">Select employee…</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {errors.employeeId && <p className="field-error">{errors.employeeId.message}</p>}
            </div>
            <div>
              <label className="label">Project *</label>
              <select {...register('projectId', { required: 'Required' })} className={`input ${errors.projectId ? 'input-error' : ''}`}>
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.projectId && <p className="field-error">{errors.projectId.message}</p>}
            </div>
          </>
        )}
        <div>
          <label className="label">Allocated Hours *</label>
          <input
            {...register('allocatedHours', { required: 'Required', min: { value: 1, message: 'Min 1' } })}
            type="number" step="0.5" min="1"
            className={`input ${errors.allocatedHours ? 'input-error' : ''}`}
            placeholder="e.g. 160"
          />
          {errors.allocatedHours && <p className="field-error">{errors.allocatedHours.message}</p>}
          <p className="text-xs text-gray-400 mt-1">Total hours the employee can log for this project</p>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" className="btn btn-secondary" onClick={() => { onClose(); reset(); }}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : allocation ? 'Update Hours' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
