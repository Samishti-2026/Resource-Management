import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, updateProject, archiveProject } from '../../services/projectService';
import { getUsers } from '../../services/userService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/dateHelpers';
import ProjectFormModal from '../../components/forms/ProjectFormModal';
import ManageTeamModal from '../../components/forms/ManageTeamModal';

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const toast    = useToast();
  const qc       = useQueryClient();
  const isRM     = user?.role === 'RESOURCE_MANAGER';
  const isPM     = user?.role === 'PROJECT_MANAGER';

  const [showCreate,    setShowCreate   ] = useState(false);
  const [editProject,   setEditProject  ] = useState(null);
  const [teamProjectId, setTeamProjectId] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [statusFilter,  setStatusFilter ] = useState('ACTIVE');

  /* ── Queries ──────────────────────────────────────────────────────────── */
  const { data, isLoading } = useQuery({
    queryKey: ['projects', { status: statusFilter }],
    queryFn:  () => getProjects({ status: statusFilter || undefined, limit: 50 }),
  });

  const { data: pmsData } = useQuery({
    queryKey: ['users', { role: 'PROJECT_MANAGER', limit: 100 }],
    queryFn:  () => getUsers({ role: 'PROJECT_MANAGER', limit: 100 }),
    enabled:  isRM,
  });

  /* ── Mutations ────────────────────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project created'); setShowCreate(false); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateProject(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project updated'); setEditProject(null); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveProject,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Archived'); setArchiveTarget(null); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  const projects = data?.projects ?? [];
  const pms      = pmsData?.users ?? [];
  const teamProject = projects.find((p) => p.id === teamProjectId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{isRM ? 'Create and manage projects' : 'Your assigned projects'}</p>
        </div>
        {isRM && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Project</button>
        )}
      </div>

      {/* Status filter */}
      <div className="filter-bar">
        {['ACTIVE', 'ARCHIVED', ''].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`pill-tab ${statusFilter === s ? 'active' : ''}`}>
            {s || 'All'}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">{projects.length} project(s)</span>
      </div>

      {/* Project cards */}
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
                <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>👥 {p._count?.members ?? 0} members</span>
                <span>{formatDate(p.createdAt)}</span>
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                {(isRM || isPM) && (
                  <button className="btn btn-secondary btn-sm flex-1"
                    onClick={() => setTeamProjectId(p.id)}>
                    👥 Manage Team
                  </button>
                )}
                {isRM && p.status === 'ACTIVE' && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditProject(p)}>Edit</button>
                    <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}
                      onClick={() => setArchiveTarget(p)}>Archive</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal — extracted component */}
      <ProjectFormModal
        isOpen={showCreate || !!editProject}
        onClose={() => { setShowCreate(false); setEditProject(null); }}
        project={editProject}
        pms={pms}
        onSubmit={(d) => {
          const payload = { ...d, projectManagerId: parseInt(d.projectManagerId) };
          if (editProject) updateMutation.mutate({ id: editProject.id, data: payload });
          else             createMutation.mutate(payload);
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Manage Team modal — extracted component (handles its own mutations) */}
      {teamProjectId && (
        <ManageTeamModal
          projectId={teamProjectId}
          projectName={teamProject?.name ?? ''}
          projectManager={teamProject?.projectManager ?? null}
          isRM={isRM}
          isPM={isPM}
          onClose={() => setTeamProjectId(null)}
        />
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveMutation.mutate(archiveTarget?.id)}
        title="Archive Project"
        message={`Archive "${archiveTarget?.name}"? It will no longer accept new timesheets.`}
        confirmLabel="Archive"
        danger
      />
    </div>
  );
}
