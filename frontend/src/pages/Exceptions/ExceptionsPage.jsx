import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExceptions, createException, approveException, rejectException } from '../../services/exceptionService';
import { getProjects } from '../../services/projectService';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { useForm } from 'react-hook-form';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/dateHelpers';
import { EXCEPTION_TYPES } from '../../constants';

const TYPE_META = {
  WEEKEND:          { icon: '📅', color: 'bg-orange-50 border-orange-200 text-orange-800' },
  HOLIDAY:          { icon: '🏖️', color: 'bg-red-50 border-red-200 text-red-800' },
  BACKDATE:         { icon: '🕐', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  ALLOCATION_BREACH:{ icon: '⚡', color: 'bg-purple-50 border-purple-200 text-purple-800' },
};

export default function ExceptionsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const qc = useQueryClient();
  const isEmployee = user?.role === 'EMPLOYEE';
  const canApprove = ['PROJECT_MANAGER', 'RESOURCE_MANAGER'].includes(user?.role);

  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['exceptions', { status: statusFilter }],
    queryFn: () => getExceptions({ status: statusFilter || undefined }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', { status: 'ACTIVE', limit: 100 }],
    queryFn: () => getProjects({ status: 'ACTIVE', limit: 100 }),
    enabled: isEmployee,
  });

  const createMutation = useMutation({
    mutationFn: createException,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exceptions'] }); toast.success('Request submitted'); setShowModal(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: approveException,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exceptions'] }); toast.success('Approved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectException,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exceptions'] }); toast.success('Rejected'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  const exceptions = data?.exceptions ?? [];
  const projects = projectsData?.projects ?? [];
  const pendingCount = exceptions.filter((e) => e.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Requests</h1>
          <p className="page-subtitle">
            {isEmployee ? 'Request permission to log hours outside normal rules' : `${pendingCount} pending review`}
          </p>
        </div>
        {isEmployee && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Request</button>
        )}
      </div>

      {/* Info cards for employees */}
      {isEmployee && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EXCEPTION_TYPES.map((t) => {
            const m = TYPE_META[t.value];
            return (
              <div key={t.value} className={`rounded-xl border p-3 ${m.color}`}>
                <div className="text-lg mb-1">{m.icon}</div>
                <p className="text-xs font-semibold">{t.label}</p>
                <p className="text-xs opacity-70 mt-0.5 hidden sm:block">{t.desc}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending alert for managers */}
      {canApprove && pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-yellow-800">
            <strong>{pendingCount}</strong> request(s) awaiting your review
          </p>
        </div>
      )}

      {/* Filter */}
      <div className="filter-bar">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`pill-tab ${statusFilter === s ? 'active' : ''}`}>
            {s || 'All'}{s === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {!isEmployee && <th>Employee</th>}
                <th>Type</th>
                <th className="hidden sm:table-cell">Project</th>
                <th>Date</th>
                <th className="hidden md:table-cell">Reason</th>
                <th>Status</th>
                {canApprove && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {exceptions.length === 0 ? (
                <tr><td colSpan={canApprove ? 7 : 6}>
                  <div className="empty-state">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p>No requests found</p>
                  </div>
                </td></tr>
              ) : exceptions.map((ex) => {
                const t = EXCEPTION_TYPES.find((x) => x.value === ex.requestType);
                const m = TYPE_META[ex.requestType] ?? {};
                return (
                  <tr key={ex.id} className={ex.status === 'PENDING' ? 'bg-yellow-50/40' : ''}>
                    {!isEmployee && (
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-sm flex-shrink-0">{ex.employee?.name?.[0]}</div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{ex.employee?.name}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <span>{m.icon}</span>
                        <span className="hidden sm:inline">{t?.label ?? ex.requestType}</span>
                      </span>
                    </td>
                    <td className="hidden sm:table-cell text-xs text-gray-600">{ex.project?.name}</td>
                    <td className="text-xs text-gray-600 whitespace-nowrap">{formatDate(ex.requestDate)}</td>
                    <td className="hidden md:table-cell text-xs text-gray-500 max-w-xs">
                      <p className="truncate" title={ex.reason}>{ex.reason}</p>
                    </td>
                    <td><StatusBadge status={ex.status} /></td>
                    {canApprove && (
                      <td>
                        {ex.status === 'PENDING' ? (
                          <div className="flex gap-1.5">
                            <button className="btn btn-success btn-sm" onClick={() => approveMutation.mutate(ex.id)} disabled={approveMutation.isPending}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => rejectMutation.mutate(ex.id)} disabled={rejectMutation.isPending}>Reject</button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{ex.reviewer?.name ?? '—'}</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New request modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Work Request" size="sm">
        <RequestForm
          projects={projects}
          onSubmit={(d) => createMutation.mutate({ ...d, projectId: parseInt(d.projectId) })}
          isLoading={createMutation.isPending}
          onClose={() => setShowModal(false)}
        />
      </Modal>
    </div>
  );
}

function RequestForm({ projects, onSubmit, isLoading, onClose }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const selectedType = watch('requestType');
  const typeInfo = EXCEPTION_TYPES.find((t) => t.value === selectedType);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="label">Request Type *</label>
        <select {...register('requestType', { required: 'Required' })} className={`input ${errors.requestType ? 'input-error' : ''}`}>
          <option value="">Select type…</option>
          {EXCEPTION_TYPES.map((t) => <option key={t.value} value={t.value}>{TYPE_META[t.value]?.icon} {t.label}</option>)}
        </select>
        {errors.requestType && <p className="field-error">{errors.requestType.message}</p>}
        {typeInfo && <p className="text-xs text-gray-400 mt-1">{typeInfo.desc}</p>}
      </div>
      <div>
        <label className="label">Project *</label>
        <select {...register('projectId', { required: 'Required' })} className={`input ${errors.projectId ? 'input-error' : ''}`}>
          <option value="">Select project…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {errors.projectId && <p className="field-error">{errors.projectId.message}</p>}
      </div>
      <div>
        <label className="label">Date *</label>
        <input {...register('requestDate', { required: 'Required' })} type="date" className={`input ${errors.requestDate ? 'input-error' : ''}`} />
        {errors.requestDate && <p className="field-error">{errors.requestDate.message}</p>}
      </div>
      <div>
        <label className="label">Reason *</label>
        <textarea
          {...register('reason', { required: 'Required', minLength: { value: 10, message: 'At least 10 characters' } })}
          className={`input resize-none ${errors.reason ? 'input-error' : ''}`}
          rows={3}
          placeholder="Explain why you need this exception…"
        />
        {errors.reason && <p className="field-error">{errors.reason.message}</p>}
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
}
