import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, deleteUser, getRoles, assignSkills } from '../../services/userService';
import { getSkills } from '../../services/skillService';
import { useToast } from '../../hooks/useToast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/dateHelpers';
import UserFormModal from '../../components/forms/UserFormModal';
import SkillsModal from '../../components/forms/SkillsModal';

export default function UsersPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const [showModal,       setShowModal      ] = useState(false);
  const [editUser,        setEditUser       ] = useState(null);
  const [skillsUser,      setSkillsUser     ] = useState(null);
  const [deactivateTarget,setDeactivateTarget] = useState(null);
  const [roleFilter,      setRoleFilter     ] = useState('');
  const [search,          setSearch         ] = useState('');

  /* ── Queries ──────────────────────────────────────────────────────────── */
  const { data, isLoading } = useQuery({
    queryKey: ['users', { role: roleFilter, search }],
    queryFn:  () => getUsers({ role: roleFilter || undefined, search: search || undefined, limit: 50 }),
  });

  const { data: roles    = [] } = useQuery({ queryKey: ['roles'],  queryFn: getRoles });
  const { data: allSkills = [] } = useQuery({ queryKey: ['skills'], queryFn: getSkills });

  /* ── Mutations ────────────────────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); setShowModal(false); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Updated'); setEditUser(null); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deactivateMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Deactivated'); setDeactivateTarget(null); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const skillsMutation = useMutation({
    mutationFn: ({ id, skillIds }) => assignSkills(id, skillIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Skills updated'); setSkillsUser(null); },
    onError:   (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  const users = data?.users ?? [];
  const meta  = data?.meta  ?? {};

  return (
    <div className="space-y-4">
      {/* Header */}
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
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input className="input pl-8" style={{ width: '14rem' }}
            placeholder="Search name or email…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: '11rem' }}
          value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
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
                <tr><td colSpan={6}><div className="empty-state"><p>No users found</p></div></td></tr>
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
                      {/* Only EMPLOYEE role can have skills assigned */}
                      {u.role?.name === 'EMPLOYEE' && (
                        <button className="text-xs text-blue-500 hover:underline ml-0.5"
                          onClick={() => setSkillsUser(u)}>
                          {(u.skills ?? []).length === 0 ? 'Assign' : 'Edit'}
                        </button>
                      )}
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
                        <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}
                          onClick={() => setDeactivateTarget(u)}>Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User form modal — extracted component */}
      <UserFormModal
        isOpen={showModal || !!editUser}
        onClose={() => { setShowModal(false); setEditUser(null); }}
        user={editUser}
        roles={roles}
        onSubmit={(d) => {
          const payload = { ...d, roleId: parseInt(d.roleId) };
          if (editUser) updateMutation.mutate({ id: editUser.id, data: payload });
          else          createMutation.mutate(payload);
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Skills modal — extracted component */}
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
