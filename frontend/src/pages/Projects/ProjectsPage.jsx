import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, updateProject, archiveProject, addProjectMember, removeProjectMember } from '../../services/projectService';
import { getUsers } from '../../services/userService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { useForm } from 'react-hook-form';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/dateHelpers';

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const qc = useQueryClient();
  const isRM = user?.role === 'RESOURCE_MANAGER';
  const isPM = user?.role === 'PROJECT_MANAGER';

  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [teamProject, setTeamProject] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', { status: statusFilter }],
    queryFn: () => getProjects({ status: statusFilter || undefined, limit: 50 }),
  });

  const { data: pmsData } = useQuery({
    queryKey: ['users', { role: 'PROJECT_MANAGER', limit: 100 }],
    queryFn: () => getUsers({ role: 'PROJECT_MANAGER', limit: 100 }),
    enabled: isRM,
  });

  const { data: empsData } = useQuery({
    queryKey: ['users', { role: 'EMPLOYEE', limit: 100 }],
    queryFn: () => getUsers({ role: 'EMPLOYEE', limit: 100 }),
    enabled: !!teamProject,
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project created'); setShowCreate(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateProject(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project updated'); setEditProject(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveProject,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Archived'); setArchiveTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ pid, eid }) => addProjectMember(pid, eid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Member added'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ pid, uid }) => removeProjectMember(pid, uid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Member removed'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  const projects = data?.projects ?? [];
  const pms = pmsData?.users ?? [];
  const employees = empsData?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage projects and team assignments</p>
        </div>
        {isRM && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Project</button>
        )}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        {['ACTIVE', 'ARCHIVED', ''].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`pill-tab ${statusFilter === s ? 'active' : ''}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No projects found</p></div></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="card flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">PM: {p.projectManager?.name}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.description && (
                <p className="text-xs text-gray-500 truncate-2">{p.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>👥 {p._count?.members ?? 0} members</span>
                <span>{formatDate(p.createdAt)}</span>
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button className="btn btn-secondary btn-sm flex-1" onClick={() => setTeamProject(p)}>
                  Manage Team
                </button>
                {isRM && p.status === 'ACTIVE' && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditProject(p)}>Edit</button>
                    <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => setArchiveTarget(p)}>Archive</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <ProjectFormModal
        isOpen={showCreate || !!editProject}
        onClose={() => { setShowCreate(false); setEditProject(null); }}
        project={editProject}
        pms={pms}
        onSubmit={(d) => {
          const payload = { ...d, projectManagerId: parseInt(d.projectManagerId) };
          if (editProject) updateMutation.mutate({ id: editProject.id, data: payload });
          else createMutation.mutate(payload);
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Team modal */}
      {teamProject && (
        <Modal isOpen onClose={() => setTeamProject(null)} title={`Team — ${teamProject.name}`} size="md">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Current Members</h4>
              {(teamProject.members ?? []).length === 0
                ? <p className="text-xs text-gray-400">No members yet</p>
                : <div className="space-y-1.5">
                    {teamProject.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-sm">{m.employee?.name?.[0]}</div>
                          <div>
                            <p className="text-xs font-medium text-gray-800">{m.employee?.name}</p>
                            <p className="text-xs text-gray-400">{m.employee?.email}</p>
                          </div>
                        </div>
                        {(isRM || isPM) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#dc2626' }}
                            onClick={() => removeMemberMutation.mutate({ pid: teamProject.id, uid: m.employeeId })}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
              }
            </div>
            {(isRM || isPM) && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Add Member</h4>
                <select
                  className="input"
                  onChange={(e) => {
                    if (e.target.value) {
                      addMemberMutation.mutate({ pid: teamProject.id, eid: parseInt(e.target.value) });
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Select employee to add…</option>
                  {employees
                    .filter((emp) => !(teamProject.members ?? []).some((m) => m.employeeId === emp.id))
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveMutation.mutate(archiveTarget?.id)}
        title="Archive Project"
        message={`Archive "${archiveTarget?.name}"? This cannot be undone.`}
        confirmLabel="Archive"
        danger
      />
    </div>
  );
}

function ProjectFormModal({ isOpen, onClose, project, pms, onSubmit, isLoading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: project ? { name: project.name, description: project.description ?? '', projectManagerId: project.projectManagerId } : {},
  });
  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} title={project ? 'Edit Project' : 'New Project'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Project Name *</label>
          <input {...register('name', { required: 'Required' })} className={`input ${errors.name ? 'input-error' : ''}`} placeholder="e.g. Enterprise Portal" />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Description</label>
          <textarea {...register('description')} className="input resize-none" rows={2} placeholder="Optional description" />
        </div>
        <div>
          <label className="label">Project Manager *</label>
          <select {...register('projectManagerId', { required: 'Required' })} className={`input ${errors.projectManagerId ? 'input-error' : ''}`}>
            <option value="">Select PM…</option>
            {pms.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
          </select>
          {errors.projectManagerId && <p className="field-error">{errors.projectManagerId.message}</p>}
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" className="btn btn-secondary" onClick={() => { onClose(); reset(); }}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : project ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
