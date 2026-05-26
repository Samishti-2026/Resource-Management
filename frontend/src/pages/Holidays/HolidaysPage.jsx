import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHolidays, bulkCreateHolidays, deleteHoliday, uploadHolidaysExcel } from '../../services/holidayService';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/dateHelpers';

export default function HolidaysPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [year,         setYear        ] = useState(currentYear);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab,       setAddTab      ] = useState('manual'); // 'manual' | 'excel'
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rows,         setRows        ] = useState([{ date: '', name: '' }]);
  const [dragOver,     setDragOver    ] = useState(false);
  const fileInputRef = useRef(null);

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn:  () => getHolidays({ year }),
  });

  const bulkMutation = useMutation({
    mutationFn: bulkCreateHolidays,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      toast.success(`${res.length} holiday(s) saved`);
      setShowAddModal(false);
      setRows([{ date: '', name: '' }]);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadHolidaysExcel,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      toast.success(`${res.length} holiday(s) imported from Excel`);
      setShowAddModal(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); toast.success('Deleted'); setDeleteTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <PageLoader />;

  // Group by month
  const byMonth = holidays.reduce((acc, h) => {
    const m = new Date(h.holidayDate).toLocaleString('default', { month: 'long' });
    if (!acc[m]) acc[m] = [];
    acc[m].push(h);
    return acc;
  }, {});

  const addRow    = () => setRows((r) => [...r, { date: '', name: '' }]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i, f, v) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row));

  const handleManualSave = () => {
    const valid = rows.filter((r) => r.date && r.name.trim());
    if (!valid.length) { toast.error('Add at least one holiday with date and name'); return; }
    bulkMutation.mutate(valid);
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Only .xlsx or .xls files are accepted');
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Holidays</h1>
          <p className="page-subtitle">Manage the company holiday calendar</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input" style={{ width: '7rem' }} value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) =>
              <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { setShowAddModal(true); setAddTab('manual'); }}>
            + Add Holidays
          </button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: `Total in ${year}`, value: holidays.length, color: 'text-blue-600' },
          { label: 'Months covered',   value: Object.keys(byMonth).length, color: 'text-green-600' },
          { label: 'Upcoming',         value: holidays.filter((h) => new Date(h.holidayDate) >= new Date()).length, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card text-center card-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Holiday calendar grid ────────────────────────────────────────── */}
      {Object.keys(byMonth).length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>No holidays for {year}</p>
            <span>Click "Add Holidays" to configure</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(byMonth).map(([month, mHolidays]) => (
            <div key={month} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">{month}</h3>
                <span className="badge badge-blue">{mHolidays.length}</span>
              </div>
              <div className="space-y-2">
                {mHolidays.map((h) => (
                  <div key={h.id}
                    className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-red-900 truncate">{h.holidayName}</p>
                      <p className="text-xs text-red-500">{formatDate(h.holidayDate, 'EEE, dd MMM yyyy')}</p>
                    </div>
                    <button className="btn-icon btn-ghost ml-2 flex-shrink-0"
                      onClick={() => setDeleteTarget(h)} title="Delete">
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Holidays modal (Manual + Excel tabs) ─────────────────────── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Holidays" size="md">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'manual', label: '✏️ Manual Entry' },
            { key: 'excel',  label: '📊 Upload Excel'  },
          ].map((t) => (
            <button key={t.key}
              onClick={() => setAddTab(t.key)}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors
                ${addTab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Manual tab ──────────────────────────────────────────────── */}
        {addTab === 'manual' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Add one or more holidays. Existing dates will be updated.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="date" className="input flex-1" value={row.date}
                    onChange={(e) => updateRow(i, 'date', e.target.value)} />
                  <input type="text" className="input flex-1" value={row.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                    placeholder="Holiday name" />
                  {rows.length > 1 && (
                    <button className="btn-icon btn-ghost flex-shrink-0" onClick={() => removeRow(i)}>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Add Row</button>
            <div className="flex gap-2 justify-end pt-1">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleManualSave} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? 'Saving…' : 'Save Holidays'}
              </button>
            </div>
          </div>
        )}

        {/* ── Excel upload tab ────────────────────────────────────────── */}
        {addTab === 'excel' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Expected Excel format:</p>
              <p>Column A: <strong>Date</strong> (dd/mm/yyyy or yyyy-mm-dd)</p>
              <p>Column B: <strong>Holiday Name</strong></p>
              <p>First row should be a header row.</p>
            </div>

            {/* Drag & drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              {uploadMutation.isPending ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-xs text-blue-600 font-medium">Importing…</p>
                </div>
              ) : (
                <>
                  <div className="text-3xl mb-2">📊</div>
                  <p className="text-sm font-medium text-gray-700">Drop your Excel file here</p>
                  <p className="text-xs text-gray-400 mt-1">or click to browse — .xlsx / .xls only</p>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        title="Delete Holiday"
        message={`Delete "${deleteTarget?.holidayName}" (${formatDate(deleteTarget?.holidayDate)})?`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
