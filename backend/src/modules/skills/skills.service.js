const prisma = require('../../config/database');
const { logAudit } = require('../../services/auditService');

async function listSkills() {
  return prisma.skill.findMany({
    include: { _count: { select: { userSkills: true } } },
    orderBy: { name: 'asc' },
  });
}

async function createSkill(data, actorId) {
  const skill = await prisma.skill.create({
    data: { name: data.name, description: data.description, createdBy: actorId },
  });
  await logAudit({ userId: actorId, action: 'CREATE_SKILL', entityType: 'Skill', entityId: skill.id, newValue: data });
  return skill;
}

async function updateSkill(id, data, actorId) {
  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Skill not found'), { statusCode: 404 });
  const updated = await prisma.skill.update({ where: { id }, data });
  await logAudit({ userId: actorId, action: 'UPDATE_SKILL', entityType: 'Skill', entityId: id, oldValue: existing, newValue: data });
  return updated;
}

async function deleteSkill(id, actorId) {
  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Skill not found'), { statusCode: 404 });
  await prisma.skill.delete({ where: { id } });
  await logAudit({ userId: actorId, action: 'DELETE_SKILL', entityType: 'Skill', entityId: id });
}

module.exports = { listSkills, createSkill, updateSkill, deleteSkill };
