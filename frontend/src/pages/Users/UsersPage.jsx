import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, deleteUser, getRoles, assignSkills } from '../../services/userService';
import { getSkills } from '../../services/skillService';
import { useToast } from '../../hooks/useToast';
import { useForm } from 'react-hook-form';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/dateHelpers';

export default function UsersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [skillsUser, setSkillsUser] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', { role: roleFilter, search }],
    queryFn: () => getUsers({ role: roleFilter || undefined, search: search || undefined, limit: 50 }),
  });

  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: getRoles });
  const { data: allSkills = [] } = useQuery({ queryKey: ['skills'], queryFn: getSkills });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); setShowModal(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Updated'); setEditUser(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deactivateMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Deactivated'); setDeactivateTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const skillsMutation = useMutation({
    mutationFn: ({ id, skillIds }) => assignSkills(id, skillIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Skills updated'); setSkillsUser(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  const users = data?.users ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage users, roles and skill assignments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input className="input pl-8" style={{ width: '14rem' }} placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: '11rem' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="RESOURCE_MANAGER">Resource Manager</option>
          <option value="PROJECT_MANAGER">Project Manager</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{meta.total ?? users.length} users</span>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Skills</th>
                <th className="hidden sm:table-cell">Status</th>
                <th className="hidden md:table-cell">Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state"><p>No users found</p></div>
                </td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="avatar avatar-md flex-shrink-0">{u.name[0].toUpperCase()}</div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-blue">{u.role?.name?.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1 items-center">
                      {(u.skills ?? []).length === 0
                        ? <span className="text-xs text-gray-300 italic">None</span>
                        : <>
                            {(u.skills ?? []).slice(0, 2).map((s) => (
                              <span key={s.skillId} className="badge badge-gray">{s.skill?.name}</span>
                            ))}
                            {(u.skills ?? []).length > 2 && (
                              <span className="badge badge-gray">+{u.skills.length - 2}</span>
                            )}
                          </>
                      }
                      <button
                        className="text-xs text-blue-500 hover:underline ml-0.5"
                        onClick={() => setSkillsUser(u)}
                      >
                        {(u.skills ?? []).length === 0 ? 'Assign' : 'Edit'}
                      </button>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell">
                    <span className={u.isActive ? 'badge badge-green' : 'badge badge-red'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="hidden md:table-cell text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditUser(u)}>Edit</button>
                      {u.isActive && (
                        <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => setDeactivateTarget(u)}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User form modal */}
      <UserFormModal
        isOpen={showModal || !!editUser}
        onClose={() => { setShowModal(false); setEditUser(null); }}
        user={editUser}
        roles={roles}
        onSubmit={(d) => {
          const payload = { ...d, roleId: parseInt(d.roleId) };
          if (editUser) updateMutation.mutate({ id: editUser.id, data: payload });
          else createMutation.mutate(payload);
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Skills modal */}
      {skillsUser && (
        <SkillsModal
          user={skillsUser}
          allSkills={allSkills}
          onClose={() => setSkillsUser(null)}
          onSave={(ids) => skillsMutation.mutate({ id: skillsUser.id, skillIds: ids })}
          isLoading={skillsMutation.isPending}
        />
      )}

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate(deactivateTarget?.id)}
        title="Deactivate User"
        message={`Deactivate "${deactivateTarget?.name}"? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        danger
      />
    </div>
  );
}

function UserFormModal({ isOpen, onClose, user, roles, onSubmit, isLoading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: user ? { name: user.name, roleId: user.role?.id } : {},
  });
  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} title={user ? 'Edit User' : 'Add User'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Full Name *</label>
          <input {...register('name', { required: 'Required' })} className={`input ${errors.name ? 'input-error' : ''}`} placeholder="John Doe" />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
        {!user && (
          <>
            <div>
              <label className="label">Email *</label>
              <input {...register('email', { required: 'Required' })} type="email" className={`input ${errors.email ? 'input-error' : ''}`} placeholder="john@company.com" />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password *</label>
              <input {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 chars' } })} type="password" className={`input ${errors.password ? 'input-error' : ''}`} placeholder="Min 8 characters" />
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>
          </>
        )}
        <div>
          <label className="label">Role *</label>
          <select {...register('roleId', { required: 'Required' })} className={`input ${errors.roleId ? 'input-error' : ''}`}>
            <option value="">Select role…</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ')}</option>)}
          </select>
          {errors.roleId && <p className="field-error">{errors.roleId.message}</p>}
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" className="btn btn-secondary" onClick={() => { onClose(); reset(); }}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : user ? 'Update' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SkillsModal({ user, allSkills, onClose, onSave, isLoading }) {
  const [selected, setSelected] = useState((user.skills ?? []).map((s) => s.skillId));
  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <Modal isOpen onClose={onClose} title={`Skills — ${user.name}`} size="sm">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">Select skills for this user.</p>
        {allSkills.length === 0
          ? <p className="text-xs text-gray-400 text-center py-4">No skills in catalog. Add skills first.</p>
          : <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
              {allSkills.map((s) => (
                <label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-xs ${selected.includes(s.id) ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="accent-blue-600 flex-shrink-0" />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
        }
        <div className="flex gap-2 justify-end pt-1">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(selected)} disabled={isLoading}>
            {isLoading ? 'Saving…' : `Save (${selected.length})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
