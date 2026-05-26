import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjectMembers, addProjectMember, removeProjectMember } from '../../services/projectService';
import { getUsers } from '../../services/userService';
import { useToast } from '../../hooks/useToast';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useState } from 'react';

const ROLE_LABEL = {
  RESOURCE_MANAGER: 'Resource Manager',
  PROJECT_MANAGER:  'Project Manager',
  EMPLOYEE:         'Employee',
};

/**
 * ManageTeamModal — view, add and remove members for a project.
 * Shows each member's role label and skill badges.
 * Add-member dropdown shows role + skills for easy identification.
 */
export default function ManageTeamModal({ projectId, projectName, projectManager, isRM, isPM, onClose }) {
  const toast = useToast();
  const qc    = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState(null);

  /* Live members of this project (includes skills via backend) */
  const { data: liveMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn:  () => getProjectMembers(projectId),
    enabled:  !!projectId,
  });

  /* All active employees — limit 200 to ensure we get everyone */
  const { data: empsData } = useQuery({
    queryKey: ['users', { role: 'EMPLOYEE', limit: 200 }],
    queryFn:  () => getUsers({ role: 'EMPLOYEE', limit: 200 }),
    enabled:  !!projectId,
  });

  const addMutation = useMutation({
    mutationFn: ({ eid }) => addProjectMember(projectId, eid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Member added');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Already a member or failed'),
  });

  const removeMutation = useMutation({
    mutationFn: ({ uid }) => removeProjectMember(projectId, uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Member removed');
      setRemoveTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const employees = empsData?.users ?? [];

  /* Only show employees not already in the project */
  const availableEmployees = employees.filter(
    (emp) => !liveMembers.some((m) => m.employeeId === emp.id)
  );

  return (
    <>
      <Modal isOpen onClose={onClose} title={`Manage Team — ${projectName}`} size="md">
        <div className="space-y-5">

          {/* ── Current members ─────────────────────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Team ({liveMembers.length + (projectManager ? 1 : 0)} total)
            </h4>

            {/* Project Manager — always shown at top */}
            {projectManager && (
              <div className="mb-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Project Lead</p>
                <div className="flex items-center gap-2.5 p-2.5 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="avatar avatar-sm flex-shrink-0 bg-indigo-500 text-white">
                    {projectManager.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-gray-800">{projectManager.name}</p>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                        Project Manager
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{projectManager.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            {projectManager && liveMembers.length > 0 && (
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 mt-3">Team Members</p>
            )}
            {membersLoading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : liveMembers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No members yet. Add employees below.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {liveMembers.map((m) => {
                  const skills = m.employee?.skills ?? [];
                  const roleName = m.employee?.role?.name;
                  return (
                    <div key={m.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="avatar avatar-sm flex-shrink-0">
                          {m.employee?.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-semibold text-gray-800">{m.employee?.name}</p>
                            {roleName && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                {ROLE_LABEL[roleName] ?? roleName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{m.employee?.email}</p>
                          {/* Skill badges */}
                          {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {skills.map((s) => (
                                <span key={s.skillId ?? s.skill?.id}
                                  className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                                  {s.skill?.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {skills.length === 0 && (
                            <p className="text-xs text-gray-300 italic mt-0.5">No skills assigned</p>
                          )}
                        </div>
                      </div>
                      {(isRM || isPM) && (
                        <button
                          className="btn btn-secondary btn-sm flex-shrink-0 ml-2"
                          style={{ color: '#dc2626' }}
                          onClick={() => setRemoveTarget({ uid: m.employeeId, name: m.employee?.name })}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Add member ──────────────────────────────────────────────── */}
          {(isRM || isPM) && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Add Member
              </h4>
              {availableEmployees.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  {employees.length === 0
                    ? 'Loading employees…'
                    : 'All active employees are already in this project.'}
                </p>
              ) : (
                <>
                  <select
                    className="input w-full"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addMutation.mutate({ eid: parseInt(e.target.value) });
                        e.target.value = '';
                      }
                    }}
                    disabled={addMutation.isPending}
                  >
                    <option value="">Select employee to add…</option>
                    {availableEmployees.map((emp) => {
                      const skills  = (emp.skills ?? []).map((s) => s.skill?.name).filter(Boolean);
                      const roleStr = ROLE_LABEL[emp.role?.name] ?? emp.role?.name ?? '';
                      const skillStr = skills.length > 0 ? ` | ${skills.join(', ')}` : '';
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} [{roleStr}]{skillStr}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Showing {availableEmployees.length} available employee(s)
                  </p>
                  {addMutation.isPending && (
                    <p className="text-xs text-blue-500 mt-1">Adding…</p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeMutation.mutate({ uid: removeTarget.uid })}
        title="Remove Member"
        message={`Remove ${removeTarget?.name} from this project? Their allocations will not be deleted.`}
        confirmLabel="Remove"
        danger
      />
    </>
  );
}
