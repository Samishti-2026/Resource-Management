import { useUIStore } from '../../store/uiStore';

const STYLES = {
  success: { bar: 'bg-green-500', icon: '✓', cls: 'text-green-700' },
  error:   { bar: 'bg-red-500',   icon: '✕', cls: 'text-red-700' },
  warning: { bar: 'bg-yellow-500',icon: '!', cls: 'text-yellow-700' },
  info:    { bar: 'bg-blue-500',  icon: 'i', cls: 'text-blue-700' },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((t) => {
        const s = STYLES[t.type] ?? STYLES.info;
        return (
          <div
            key={t.id}
            className="pointer-events-auto bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden flex items-stretch"
          >
            <div className={`w-1 flex-shrink-0 ${s.bar}`} />
            <div className="flex items-start gap-2.5 px-3 py-2.5 flex-1 min-w-0">
              <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${s.cls}`}>{s.icon}</span>
              <p className="text-xs text-gray-700 flex-1">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="text-gray-300 hover:text-gray-500 flex-shrink-0 ml-1"
                aria-label="Dismiss"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
