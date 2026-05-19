const prisma = require('../../config/database');
const { logAudit } = require('../../services/auditService');

async function listHolidays(query) {
  const where = {};
  if (query.year) {
    const year = parseInt(query.year);
    where.holidayDate = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }
  return prisma.holiday.findMany({ where, orderBy: { holidayDate: 'asc' } });
}

async function bulkCreateHolidays(holidays, actorId) {
  const data = holidays.map((h) => ({
    holidayDate: new Date(h.date),
    holidayName: h.name,
    createdBy: actorId,
  }));

  // Upsert each holiday
  const results = [];
  for (const h of data) {
    const result = await prisma.holiday.upsert({
      where: { holidayDate: h.holidayDate },
      update: { holidayName: h.holidayName },
      create: h,
    });
    results.push(result);
  }

  await logAudit({ userId: actorId, action: 'BULK_CREATE_HOLIDAYS', entityType: 'Holiday', entityId: 0, newValue: { count: results.length } });
  return results;
}

async function deleteHoliday(id, actorId) {
  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Holiday not found'), { statusCode: 404 });
  await prisma.holiday.delete({ where: { id } });
  await logAudit({ userId: actorId, action: 'DELETE_HOLIDAY', entityType: 'Holiday', entityId: id });
}

module.exports = { listHolidays, bulkCreateHolidays, deleteHoliday };
