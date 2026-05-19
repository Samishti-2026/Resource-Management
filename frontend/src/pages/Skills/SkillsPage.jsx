import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSkills, createSkill, updateSkill, deleteSkill } from '../../services/skillService';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { PageLoader } from '../../components/ui/LoadingSpinner';

export default function SkillsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editSkill, setEditSkill] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const { data: skills = [], isLoading } = useQuery({ queryKey: ['skills'], queryFn: getSkills });

  const createMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); toast.success('Skill created'); setShowModal(false); setForm({ name: '', description: '' }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateSkill(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); toast.success('Updated'); setEditSkill(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSkill,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); toast.success('Deleted'); setDeleteTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  const openEdit = (s) => { setEditSkill(s); setForm({ name: s.name, description: s.description ?? '' }); };
  const openCreate = () => { setForm({ name: '', description: '' }); setShowModal(true); };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Skill Catalog</h1>
          <p className="page-subtitle">Manage the organisation's skill catalog</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Skill</button>
      </div>

      {skills.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p>No skills in catalog</p>
            <span>Click "Add Skill" to get started</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {skills.map((s) => (
            <div key={s.id} className="card flex items-start justify-between gap-3 hover:shadow-md transition-shadow">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900">{s.name}</h3>
                {s.description && <p className="text-xs text-gray-500 mt-0.5 truncate-2">{s.description}</p>}
                <p className="text-xs text-gray-400 mt-1.5">
                  👥 {s._count?.userSkills ?? 0} employee(s)
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => setDeleteTarget(s)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        isOpen={showModal || !!editSkill}
        onClose={() => { setShowModal(false); setEditSkill(null); }}
        title={editSkill ? 'Edit Skill' : 'Add Skill'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Skill Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. React, Node.js, UI/UX"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description…"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditSkill(null); }}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (editSkill) updateMutation.mutate({ id: editSkill.id, data: form });
                else createMutation.mutate(form);
              }}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : editSkill ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        title="Delete Skill"
        message={`Delete "${deleteTarget?.name}"? This removes it from all employees.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
