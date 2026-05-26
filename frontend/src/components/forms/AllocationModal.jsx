import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { getProjectMembers } from '../../services/projectService';
import { getAllocations } from '../../services/allocationService';
import Modal from '../ui/Modal';

const ROLE_LABEL = {
  RESOURCE_MANAGER: 'Resource Manager',
  PROJECT_MANAGER:  'Project Manager',
  EMPLOYEE:         'Employee',
};

/**
 * AllocationModal — create or edit a project allocation.
 *
 * NEW flow:
 *  1. Pick project → loads that project's members with role + skills
 *  2. Skill search input filters the member list in real-time
 *  3. Click a member card to select them (enforces max-2 rule)
 *
 * EDIT flow: shows hours + date window only.
 */
export default function AllocationModal({ isOpen, onClose, allocation, projects, onSubmit, isLoading }) {
  const [skillSearch,       setSkillSearch      ] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: allocation
      ? {
          allocatedHours: allocation.allocatedHours,
          startDate: allocation.startDate ? allocation.startDate.slice(0, 10) : '',
          endDate:   allocation.endDate   ? allocation.endDate.slice(0, 10)   : '',
        }
      : { projectId: '', employeeId: '' },
  });

  const selectedProjectId = watch('projectId');

  /* Members of the selected project (includes skills via backend) */
  const { data: membersData = [], isFetching: membersFetching } = useQuery({
    queryKey: ['project-members', selectedProjectId],
    queryFn:  () => getProjectMembers(parseInt(selectedProjectId)),
    enabled:  !!selectedProjectId && !allocation,
  });

  /* All allocations to count per-employee */
  const { data: allAllocations = [] } = useQuery({
    queryKey: ['allocations', {}],
    queryFn:  () => getAllocations({}),
    enabled:  !!selectedProjectId && !allocation,
  });

  const members = membersData.map((m) => m.employee).filter(Boolean);

  const allocCountByEmployee = allAllocations.reduce((acc, a) => {
    acc[a.employeeId] = (acc[a.employeeId] || 0) + 1;
    return acc;
  }, {});

  /* Filter members by skill search */
  const filteredMembers = skillSearch.trim()
    ? members.filter((emp) => {
        const q = skillSearch.toLowerCase();
        return (emp.skills ?? []).some((s) => s.skill?.name?.toLowerCase().includes(q));
      })
    : members;

  const handleSelectEmployee = (emp) => {
    const count = allocCountByEmployee[emp.id] || 0;
    if (count >= 2) return; // blocked
    setSelectedEmployeeId(emp.id);
    setValue('employeeId', emp.id, { shouldValidate: true });
  };

  const handleClose = () => {
    onClose();
    reset();
    setSkillSearch('');
    setSelectedEmployeeId(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={allocation ? `Edit Allocation — ${allocation.employee?.name}` : 'New Allocation'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* ── NEW: project + member selection ─────────────────────────── */}
        {!allocation && (
          <>
            {/* Project */}
            <div>
              <label className="label">Project *</label>
              <select
                {...register('projectId', { required: 'Required' })}
                className={`input ${errors.projectId ? 'input-error' : ''}`}
                onChange={(e) => {
                  setValue('projectId', e.target.value);
                  setSelectedEmployeeId(null);
                  setValue('employeeId', '');
                  setSkillSearch('');
                }}
              >
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.projectId && <p className="field-error">{errors.projectId.message}</p>}
            </div>

            {/* Employee — searchable card list */}
            <div>
              <label className="label">Employee *</label>

              {/* Hidden field for form validation */}
              <input type="hidden" {...register('employeeId', { required: 'Select an employee' })} />

              {!selectedProjectId ? (
                <p className="text-xs text-gray-400 italic">Select a project first to see its members</p>
              ) : membersFetching ? (
                <p className="text-xs text-gray-400 italic">Loading members…</p>
              ) : members.length === 0 ? (
                <p className="text-xs text-amber-600 italic">
                  No members in this project yet. Add members via Projects → Manage Team first.
                </p>
              ) : (
                <>
                  {/* Skill search input */}
                  <div className="relative mb-2">
                    <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      className="input pl-8 text-xs"
                      placeholder="Search by skill (e.g. React, Java)…"
                      value={skillSearch}
                      onChange={(e) => setSkillSearch(e.target.value)}
                    />
                    {skillSearch && (
                      <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setSkillSearch('')}>✕</button>
                    )}
                  </div>

                  {/* Member cards */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {filteredMembers.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-3">
                        No members match "{skillSearch}"
                      </p>
                    ) : filteredMembers.map((emp) => {
                      const count    = allocCountByEmployee[emp.id] || 0;
                      const full     = count >= 2;
                      const selected = selectedEmployeeId === emp.id;
                      const skills   = (emp.skills ?? []).map((s) => s.skill?.name).filter(Boolean);
                      const roleName = ROLE_LABEL[emp.role?.name] ?? emp.role?.name ?? 'Employee';

                      return (
                        <div
                          key={emp.id}
                          onClick={() => !full && handleSelectEmployee(emp)}
                          className={`
                            flex items-center justify-between p-2.5 rounded-lg border transition-all
                            ${full
                              ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                              : selected
                              ? 'border-blue-400 bg-blue-50 cursor-pointer ring-1 ring-blue-400'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Selection indicator */}
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                              ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                              {selected && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-gray-800">{emp.name}</span>
                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                  {roleName}
                                </span>
                                {full && (
                                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                                    Max 2 projects
                                  </span>
                                )}
                                {!full && count > 0 && (
                                  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                                    {count} project{count > 1 ? 's' : ''} allocated
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 truncate">{emp.email}</p>
                              {/* Skills */}
                              {skills.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {skills.map((sk) => {
                                    const matched = skillSearch && sk.toLowerCase().includes(skillSearch.toLowerCase());
                                    return (
                                      <span key={sk}
                                        className={`text-xs px-1.5 py-0.5 rounded-full
                                          ${matched
                                            ? 'bg-green-100 text-green-700 font-semibold'
                                            : 'bg-blue-100 text-blue-700'
                                          }`}>
                                        {sk}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-300 italic mt-0.5">No skills assigned</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-gray-400 mt-1">
                    {filteredMembers.length} of {members.length} member(s) shown
                    {selectedEmployeeId && (
                      <span className="text-blue-600 font-medium ml-2">
                        ✓ {members.find((m) => m.id === selectedEmployeeId)?.name} selected
                      </span>
                    )}
                  </p>
                </>
              )}
              {errors.employeeId && <p className="field-error">{errors.employeeId.message}</p>}
            </div>
          </>
        )}

        {/* ── Hours ─────────────────────────────────────────────────────── */}
        <div>
          <label className="label">Allocated Hours *</label>
          <input
            {...register('allocatedHours', {
              required: 'Required',
              min:      { value: 1,    message: 'Minimum 1 hour'     },
              max:      { value: 2000, message: 'Maximum 2000 hours' },
              valueAsNumber: true,
            })}
            type="number" step="0.5" min="1" max="2000"
            className={`input ${errors.allocatedHours ? 'input-error' : ''}`}
            placeholder="e.g. 160"
          />
          {errors.allocatedHours && <p className="field-error">{errors.allocatedHours.message}</p>}
          <p className="text-xs text-gray-400 mt-1">Total hours the employee can log for this project (max 2000)</p>
        </div>

        {/* ── Date window ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date *</label>
            <input {...register('startDate', { required: 'Required' })} type="date"
              className={`input ${errors.startDate ? 'input-error' : ''}`} />
            {errors.startDate && <p className="field-error">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="label">End Date *</label>
            <input
              {...register('endDate', {
                required: 'Required',
                validate: (val) => {
                  const start = watch('startDate');
                  if (start && val && new Date(val) <= new Date(start))
                    return 'End date must be after start date';
                  return true;
                },
              })}
              type="date"
              className={`input ${errors.endDate ? 'input-error' : ''}`}
            />
            {errors.endDate && <p className="field-error">{errors.endDate.message}</p>}
          </div>
        </div>
        <p className="text-xs text-gray-400 -mt-2">Employee can only log hours within this date range</p>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : allocation ? 'Update Allocation' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
