import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSkill } from '../../services/skillService';
import { useToast } from '../../hooks/useToast';
import Modal from '../ui/Modal';

/**
 * SkillsModal — assign skills to a user.
 * Supports selecting from existing catalog AND adding new skills inline.
 */
export default function SkillsModal({ user, allSkills, onClose, onSave, isLoading }) {
  const qc   = useQueryClient();
  const toast = useToast();
  const [selected,     setSelected    ] = useState((user.skills ?? []).map((s) => s.skillId));
  const [newSkillName, setNewSkillName] = useState('');

  const toggle = (id) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const addSkillMutation = useMutation({
    mutationFn: (name) => createSkill({ name: name.trim() }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['skills'] });
      setSelected((p) => [...p, created.id]);
      setNewSkillName('');
      toast.success(`Skill "${created.name}" added`);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add skill'),
  });

  const handleAddSkill = () => {
    const name = newSkillName.trim();
    if (!name) return;
    const existing = allSkills.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selected.includes(existing.id)) setSelected((p) => [...p, existing.id]);
      setNewSkillName('');
      toast.success(`"${existing.name}" already exists — checked`);
      return;
    }
    addSkillMutation.mutate(name);
  };

  return (
    <Modal isOpen onClose={onClose} title={`Skills — ${user.name}`} size="sm">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">Select from the catalog or type a new skill to add it.</p>

        {/* Inline new skill input */}
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Type new skill name…"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm flex-shrink-0"
            onClick={handleAddSkill}
            disabled={!newSkillName.trim() || addSkillMutation.isPending}
          >
            {addSkillMutation.isPending ? '…' : '+ Add'}
          </button>
        </div>

        {/* Checklist */}
        {allSkills.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            No skills in catalog yet. Type above to add one.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
            {allSkills.map((s) => (
              <label
                key={s.id}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-xs
                  ${selected.includes(s.id)
                    ? 'border-blue-400 bg-blue-50 text-blue-800'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  className="accent-blue-600 flex-shrink-0"
                />
                <span className="truncate">{s.name}</span>
              </label>
            ))}
          </div>
        )}

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
