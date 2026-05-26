import { useState } from 'react';
import { getWeekLabel } from '../../utils/dateHelpers';
import Modal from '../ui/Modal';

const MAX = 12;

/**
 * TimesheetActionBar — bottom bar with week summary, Save Draft, Submit,
 * Approve (with remarks modal) and Reject (with reason modal).
 */
export default function TimesheetActionBar({
  weekStart,
  weekTotal,
  projects,
  overLimitDays,
  canEdit,
  canApprove,
  tsStatus,
  isDirty,
  onSave,
  onSubmit,
  onApprove,
  onReject,
  isSaving,
  isSubmitting,
  isApproving,
  isRejecting,
}) {
  const [showRejectModal,  setShowRejectModal ] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectReason,     setRejectReason    ] = useState('');
  const [approveRemarks,   setApproveRemarks  ] = useState('');

  return (
    <>
      <div className="card card-sm flex items-center justify-between flex-wrap gap-3">
        {/* Summary */}
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-gray-500">Week:</span>
            <span className="font-semibold text-gray-800 ml-1">{getWeekLabel(weekStart)}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Hours:</span>
            <span className="font-bold text-blue-700 ml-1">{weekTotal}H</span>
          </div>
          <div>
            <span className="text-gray-500">Projects:</span>
            <span className="font-semibold text-gray-800 ml-1">{projects.length}</span>
          </div>
          {overLimitDays.length > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{overLimitDays.length} day(s) exceed {MAX}h limit</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <>
              <button className="btn btn-secondary"
                onClick={onSave}
                disabled={isSaving || !isDirty}>
                {isSaving ? 'Saving…' : 'Save Draft'}
              </button>
              <button className="btn btn-primary"
                onClick={onSubmit}
                disabled={isSubmitting || overLimitDays.length > 0 || weekTotal === 0}
                title={weekTotal === 0 ? 'Enter hours before submitting'
                  : overLimitDays.length > 0 ? 'Fix daily limit errors before submitting' : ''}>
                {isSubmitting ? 'Submitting…' : 'Submit for Approval'}
              </button>
              {weekTotal === 0 && (
                <p className="w-full text-xs text-amber-600 mt-1">
                  ⚠️ Enter hours in the grid above, then Save Draft before submitting.
                </p>
              )}
            </>
          )}
          {canApprove && tsStatus === 'SUBMITTED' && (
            <>
              <button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>Reject</button>
              <button className="btn btn-success" onClick={() => setShowApproveModal(true)}>Approve</button>
            </>
          )}
        </div>
      </div>

      {/* Reject modal */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Timesheet" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Provide a reason — the employee will see this message.</p>
          <div>
            <label className="label">Reason *</label>
            <textarea className="input resize-none" rows={3} value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this timesheet is being rejected…" />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
            <button className="btn btn-danger"
              onClick={() => { onReject(rejectReason); setShowRejectModal(false); setRejectReason(''); }}
              disabled={rejectReason.length < 5 || isRejecting}>
              {isRejecting ? 'Rejecting…' : 'Reject Timesheet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Approve modal */}
      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Timesheet" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Approving timesheet for review.</p>
          <div>
            <label className="label">Remarks <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={3} value={approveRemarks}
              onChange={(e) => setApproveRemarks(e.target.value)}
              placeholder="Add any remarks for the employee (optional)…" />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>Cancel</button>
            <button className="btn btn-success"
              onClick={() => { onApprove(approveRemarks); setShowApproveModal(false); setApproveRemarks(''); }}
              disabled={isApproving}>
              {isApproving ? 'Approving…' : '✓ Approve Timesheet'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
