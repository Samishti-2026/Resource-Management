const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-100' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-100' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-100' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
};

export default function StatCard({ title, value, subtitle, icon, color = 'blue' }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className="stat-card">
      {icon && (
        <div className={`stat-icon ${c.bg} ${c.text} border ${c.border}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="stat-label truncate">{title}</p>
        <p className="stat-value">{value}</p>
        {subtitle && <p className="stat-sub truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
