import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function UtilizationDonut({ utilized, allocated }) {
  const remaining = Math.max(0, allocated - utilized);
  const pct = allocated > 0 ? Math.round((utilized / allocated) * 100) : 0;

  const data = [
    { name: 'Utilized', value: utilized },
    { name: 'Remaining', value: remaining },
  ];

  const COLORS = ['#2563EB', '#E5E7EB'];

  const color = pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={index === 0 ? color : COLORS[1]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `${v}h`} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color }}>{pct}%</p>
          <p className="text-xs text-gray-500">Utilized</p>
        </div>
      </div>
    </div>
  );
}
