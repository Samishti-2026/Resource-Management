import Modal from './Modal';

export default function ConfirmDialog({
  isOpen, onClose, onConfirm,
  title = 'Confirm', message,
  confirmLabel = 'Confirm', danger = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 mb-5">{message}</p>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => { onConfirm(); onClose(); }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
