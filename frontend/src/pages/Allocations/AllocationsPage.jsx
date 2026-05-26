import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllocations, createAllocation, updateAllocation, deleteAllocation } from '../../services/allocationService';
import { getProjects } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/dateHelpers';
import AllocationModal from '../../components/forms/AllocationModal';

export default function AllocationsPage() {
  const { user }  = useAuthStore();
  const toast     = useToast();
  const qc        = useQueryClient();
  const canManage = ['RESOURCE_MANAGER', 'PROJECT_MANAGER'].includes(user?.role);

  const [showModal,     setShowModal    ] = useState(false);
  const [editAlloc,     setEditAlloc    ] = useState(null);
  const [deleteTarget,  setDeleteTarget ] = useState(null);
  const [projectFilter, setProjectFilter] = useState('');

  /* ── Queries ──────────────────────────────────────────────────────────── */
  const { data: allocData, isLoading } = useQuery({
    queryKey: ['allocations', { projectId: projectFilter }],
    queryFn:  () => getAllocations({ projectId: projectFilter || undefined }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', { status: 'ACTIVE', limit: 100 }],
    queryFn:  () => getProjects({ status: 'ACTIVE', limit: 100 }),
  });

  /* ── Mutations ────────────────────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: createAllocation,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allocations'] }); toast.success('Allocation created'); setShowModal(false); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateAllocation(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allocations'] }); toast.success('Updated'); setEditAlloc(null); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAllocation,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allocations'] }); toast.success('Removed'); setDeleteTarget(null); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  const allocations = allocData  || [];
  const projects    = projectsData?.projects || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Allocations</h1>
          <p className="page-subtitle">
            {canManage ? 'Assign project hours and time window to team members' : 'Your project hour allocations'}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Allocation</button>
        )}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <label className="text-xs font-medium text-gray-500">Project:</label>
        <select className="input" style={{ width: '16rem' }}
          value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
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
                <th>Time Window</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr><td colSpan={canManage ? 5 : 4}>
                  <div className="empty-state">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No allocations found</p>
                    {canManage && <span>Select a project first, then click "New Allocation"</span>}
                  </div>
                </td></tr>
              ) : allocations.map((a) => {
                const now      = new Date();
                const isActive = a.startDate && a.endDate
                  ? now >= new Date(a.startDate) && now <= new Date(a.endDate)
                  : true;
                return (
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
                    <td>
                      {a.startDate && a.endDate ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-gray-700">
                            {formatDate(a.startDate, 'dd MMM yyyy')} – {formatDate(a.endDate, 'dd MMM yyyy')}
                          </span>
                          <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                            {isActive ? '● Active' : '○ Inactive'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex gap-1.5">
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditAlloc(a)}>Edit</button>
                          <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}
                            onClick={() => setDeleteTarget(a)}>Remove</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation modal — extracted component */}
      <AllocationModal
        isOpen={showModal || !!editAlloc}
        onClose={() => { setShowModal(false); setEditAlloc(null); }}
        allocation={editAlloc}
        projects={projects}
        onSubmit={(d) => {
          const payload = { ...d, allocatedHours: parseFloat(d.allocatedHours) };
          if (!editAlloc) { payload.employeeId = parseInt(d.employeeId); payload.projectId = parseInt(d.projectId); }
          if (editAlloc) updateMutation.mutate({ id: editAlloc.id, data: payload });
          else           createMutation.mutate(payload);
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
