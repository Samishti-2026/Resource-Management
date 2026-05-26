import {
  formatDate, getWeekDays, getDayName,
  isWeekendDay, formatDateInput,
} from '../../utils/dateHelpers';

const MAX = 12;

/**
 * TimesheetGrid — Mon–Sun × Projects hour-entry table.
 * Props:
 *   allocations — array of { projectId, allocatedHours } to show per-project budget
 */
export default function TimesheetGrid({
  weekStart,
  projects,
  entries,
  canEdit,
  holidayDateSet,
  holidayNameMap,
  onChangeEntry,
  allocations = [],
}) {
  const weekDays = getWeekDays(weekStart);

  // Build a map projectId → { allocatedHours, startDate, endDate }
  const allocMap = Object.fromEntries(
    allocations.map((a) => [
      a.projectId ?? a.project?.id,
      {
        allocatedHours: a.allocatedHours,
        startDate: a.startDate ? formatDateInput(a.startDate) : null,
        endDate:   a.endDate   ? formatDateInput(a.endDate)   : null,
      },
    ])
  );

  // Returns true if the date is outside the allocation window for this project
  const isOutsideWindow = (projectId, date) => {
    const alloc = allocMap[projectId];
    if (!alloc || !alloc.startDate || !alloc.endDate) return false;
    const ds = formatDateInput(date);
    return ds < alloc.startDate || ds > alloc.endDate;
  };

  const getDailyTotal = (date) => {
    const ds = formatDateInput(date);
    return Object.entries(entries)
      .filter(([k]) => k.endsWith(`_${ds}`))
      .reduce((s, [, v]) => s + (parseFloat(v.hours) || 0), 0);
  };

  const getProjectTotal = (projectId) =>
    weekDays.reduce((s, d) => {
      const k = `${projectId}_${formatDateInput(d)}`;
      return s + (parseFloat(entries[k]?.hours) || 0);
    }, 0);

  const weekTotal = Object.values(entries).reduce((s, v) => s + (parseFloat(v.hours) || 0), 0);

  return (
    <div className="table-container">
      <div className="table-scroll">
        <table className="table" style={{ minWidth: '760px' }}>
          <thead>
            <tr>
              <th className="text-left" style={{ minWidth: '120px' }}>Project</th>
              <th className="text-center" style={{ minWidth: '72px' }}
                title="Total hours allocated for this project">
                Allocated
              </th>
              {weekDays.map((day) => {
                const isWE    = isWeekendDay(day);
                const ds      = formatDateInput(day);
                const isHol   = holidayDateSet.has(ds);
                const holName = holidayNameMap[ds];
                return (
                  <th key={day.toISOString()}
                    style={{ minWidth: '72px' }}
                    title={isHol ? `Holiday: ${holName}` : isWE ? 'Weekend' : undefined}
                    className={`text-center ${isHol ? 'bg-orange-50' : isWE ? 'bg-amber-50' : ''}`}
                  >
                    <div className={`text-xs font-semibold
                      ${isHol ? 'text-orange-600' : isWE ? 'text-amber-600' : 'text-gray-700'}`}>
                      {getDayName(day)}
                    </div>
                    <div className={`text-xs font-normal
                      ${isHol ? 'text-orange-500' : isWE ? 'text-amber-500' : 'text-gray-500'}`}>
                      {formatDate(day, 'dd-MMM')}
                    </div>
                    {isHol && (
                      <div className="text-xs text-orange-500 font-normal leading-tight truncate max-w-[68px]"
                        title={holName}>🎉 {holName}</div>
                    )}
                    {!isHol && isWE && (
                      <div className="text-xs text-amber-500 font-normal leading-tight">Weekend</div>
                    )}
                  </th>
                );
              })}
              <th className="text-center" style={{ minWidth: '60px' }}>Total</th>
            </tr>
          </thead>

          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-10 text-gray-400 text-xs">
                  No allocated projects found for this week
                </td>
              </tr>
            ) : projects.map((project) => {
              const projTotal   = getProjectTotal(project.id);
              const allocInfo   = allocMap[project.id];
              const allocatedH  = allocInfo?.allocatedHours;
              return (
                <tr key={project.id} className="hover:bg-blue-50/30 transition-colors">
                  {/* Project name */}
                  <td>
                    <span className="text-xs font-medium text-gray-800 truncate block max-w-[110px]"
                      title={project.name}>{project.name}</span>
                  </td>

                  {/* Allocated hours for this project */}
                  <td className="text-center">
                    {allocatedH != null ? (
                      <span className="text-xs font-semibold text-indigo-600">{allocatedH}H</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  {/* Hour cells */}
                  {weekDays.map((day) => {
                    const isWE       = isWeekendDay(day);
                    const ds         = formatDateInput(day);
                    const isHol      = holidayDateSet.has(ds);
                    const key        = `${project.id}_${ds}`;
                    const val        = entries[key]?.hours;
                    const displayVal = val !== undefined && val !== null ? val : '';
                    const dayTotal   = getDailyTotal(day);
                    const isOver     = dayTotal > MAX;
                    const outOfAlloc = isOutsideWindow(project.id, day);
                    return (
                      <td key={day.toISOString()}
                        title={
                          outOfAlloc
                            ? `Outside allocation window (${allocMap[project.id]?.startDate} – ${allocMap[project.id]?.endDate})`
                            : isHol
                            ? `Holiday: ${holidayNameMap[ds]} — enter hours if you have an approved exception`
                            : undefined
                        }
                        className={`text-center p-1 ${
                          outOfAlloc ? 'bg-gray-100'
                          : isHol    ? 'bg-orange-50'
                          : isWE     ? 'bg-amber-50'
                          : ''
                        }`}
                      >
                        {canEdit && !outOfAlloc ? (
                          <input
                            type="number" min="0" max="12" step="0.5"
                            value={displayVal}
                            onChange={(e) => onChangeEntry(project.id, day, e.target.value)}
                            className={`w-14 text-center text-xs border rounded-md px-1 py-1.5 outline-none transition-colors
                              focus:ring-2 focus:ring-blue-400 focus:border-blue-400
                              ${isHol
                                ? 'border-orange-300 bg-orange-50 text-orange-800 placeholder-orange-300'
                                : isWE
                                ? 'border-amber-300 bg-amber-50 text-amber-800 placeholder-amber-300'
                                : isOver
                                ? 'border-red-400 bg-red-50 text-red-700 font-semibold'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            placeholder="0"
                          />
                        ) : (
                          <span className={`text-xs font-medium
                            ${outOfAlloc ? 'text-gray-300'
                            : isHol ? 'text-orange-600 font-semibold'
                            : isWE  ? (displayVal > 0 ? 'text-amber-700 font-semibold' : 'text-amber-300')
                            : displayVal > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                            {outOfAlloc ? '—' : displayVal !== '' && displayVal > 0 ? displayVal : (isHol ? '🎉' : '0')}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Week total for this project */}
                  <td className="text-center">
                    <span className={`text-xs font-bold ${projTotal > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                      {projTotal > 0 ? `${projTotal}H` : '0H'}
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* Daily Total row */}
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td className="text-xs font-bold text-gray-700 py-2" colSpan={2}>Daily Total</td>
              {weekDays.map((day) => {
                const t      = getDailyTotal(day);
                const isWE   = isWeekendDay(day);
                const ds     = formatDateInput(day);
                const isHol  = holidayDateSet.has(ds);
                const isOver = t > MAX;
                const isWarn = t >= 10 && t <= MAX;
                return (
                  <td key={day.toISOString()}
                    className={`text-center py-2 ${isHol ? 'bg-orange-50' : isWE ? 'bg-amber-50' : ''}`}>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded
                      ${isOver ? 'bg-red-100 text-red-700'
                      : isWarn ? 'bg-yellow-100 text-yellow-700'
                      : t > 0  ? (isWE ? 'text-amber-700' : 'text-green-700')
                      : isHol  ? 'text-orange-400'
                      : 'text-gray-300'}`}>
                      {isHol && t === 0 ? '🎉' : (t > 0 ? `${t}H` : '0H')}
                    </span>
                  </td>
                );
              })}
              <td className="text-center py-2">
                <span className="text-xs font-bold text-gray-900">{weekTotal}H</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" />Normal (≤ 9H)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" />Near limit (10–12H)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />Weekend (needs exception)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block" />Holiday (needs exception)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block" />Outside allocation window</span>
        <span className="ml-auto font-medium text-gray-600">Max {MAX}H per day</span>
      </div>
    </div>
  );
}
