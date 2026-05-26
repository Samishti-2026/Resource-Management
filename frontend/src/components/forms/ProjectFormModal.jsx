import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';

/**
 * ProjectFormModal — create or edit a project.
 * Used by both RM (create/edit) flows.
 */
export default function ProjectFormModal({ isOpen, onClose, project, pms, onSubmit, isLoading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: project
      ? {
          name: project.name,
          description: project.description ?? '',
          projectManagerId: project.projectManagerId,
        }
      : {},
  });

  const handleClose = () => { onClose(); reset(); };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={project ? 'Edit Project' : 'New Project'}
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Project Name *</label>
          <input
            {...register('name', {
              required: 'Required',
              minLength: { value: 2, message: 'Min 2 characters' },
              maxLength: { value: 100, message: 'Max 100 characters' },
            })}
            className={`input ${errors.name ? 'input-error' : ''}`}
            placeholder="e.g. Samishti ERP Portal"
          />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            {...register('description', {
              maxLength: { value: 200, message: 'Max 200 characters' },
            })}
            className="input resize-none"
            rows={2}
            placeholder="Brief description of the project"
          />
          {errors.description && <p className="field-error">{errors.description.message}</p>}
        </div>

        <div>
          <label className="label">Project Manager *</label>
          <select
            {...register('projectManagerId', { required: 'Required' })}
            className={`input ${errors.projectManagerId ? 'input-error' : ''}`}
          >
            <option value="">Select Project Manager…</option>
            {pms.map((pm) => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>
          {errors.projectManagerId && <p className="field-error">{errors.projectManagerId.message}</p>}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : project ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
