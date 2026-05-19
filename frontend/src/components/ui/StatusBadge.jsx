import { STATUS_COLORS } from '../../constants';

export default function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] ?? 'badge-gray';
  return <span className={`badge ${cls}`}>{status}</span>;
}
