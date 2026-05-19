import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';

export default function WeeklyBarChart({ data }) {
  const formatted = (data || []).map((d) => ({
    ...d,
    label: format(parseISO(d.weekStart), 'dd MMM'),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v}h`, 'Hours']} />
        <ReferenceLine y={40} stroke="#E5E7EB" strokeDasharray="4 4" label={{ value: '40h', fontSize: 10 }} />
        <Bar dataKey="hours" fill="#2563EB" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
