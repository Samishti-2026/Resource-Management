import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';

/**
 * UserFormModal — create or edit a user (RM only).
 */
export default function UserFormModal({ isOpen, onClose, user, roles, onSubmit, isLoading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: user ? { name: user.name, roleId: user.role?.id } : {},
  });

  const handleClose = () => { onClose(); reset(); };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={user ? 'Edit User' : 'Add User'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Full Name *</label>
          <input
            {...register('name', {
              required: 'Required',
              minLength: { value: 2, message: 'Min 2 characters' },
              maxLength: { value: 100, message: 'Max 100 characters' },
            })}
            className={`input ${errors.name ? 'input-error' : ''}`}
            placeholder="e.g. Vikram Desai"
          />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>

        {!user && (
          <>
            <div>
              <label className="label">Email *</label>
              <input
                {...register('email', {
                  required: 'Required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email address' },
                })}
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="vikram@samishti.com"
              />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password *</label>
              <input
                {...register('password', {
                  required: 'Required',
                  minLength: { value: 8, message: 'Min 8 characters' },
                  maxLength: { value: 128, message: 'Max 128 characters' },
                })}
                type="password"
                className={`input ${errors.password ? 'input-error' : ''}`}
                placeholder="Min 8 characters"
              />
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>
          </>
        )}

        <div>
          <label className="label">Role *</label>
          <select
            {...register('roleId', { required: 'Required' })}
            className={`input ${errors.roleId ? 'input-error' : ''}`}
          >
            <option value="">Select role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ')}</option>
            ))}
          </select>
          {errors.roleId && <p className="field-error">{errors.roleId.message}</p>}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : user ? 'Update' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
