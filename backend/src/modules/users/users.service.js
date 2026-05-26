const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const env = require('../../config/env');
const { getPagination, paginationMeta } = require('../../utils/pagination');
const { logAudit } = require('../../services/auditService');

async function listUsers(query) {
  const { skip, limit, page } = getPagination(query);
  const where = {};
  if (query.role) where.role = { name: query.role };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  // When filtering by role (dropdown use), only return active users
  // When no filter (admin list), respect explicit isActive param
  if (query.role) {
    where.isActive = true;
  } else if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true';
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, name: true, email: true, isActive: true, createdAt: true,
        role: { select: { id: true, name: true } },
        skills: { include: { skill: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: paginationMeta(total, page, limit) };
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, isActive: true, createdAt: true,
      role: { select: { id: true, name: true } },
      skills: { include: { skill: true } },
      allocations: {
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
}

async function createUser(data, actorId) {
  const { name, email, password, roleId } = data;
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, roleId },
    include: { role: true },
  });

  await logAudit({ userId: actorId, action: 'CREATE_USER', entityType: 'User', entityId: user.id, newValue: { name, email, roleId } });

  return { id: user.id, name: user.name, email: user.email, role: user.role.name };
}

async function updateUser(id, data, actorId) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.roleId) updateData.roleId = data.roleId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { role: true },
  });

  await logAudit({ userId: actorId, action: 'UPDATE_USER', entityType: 'User', entityId: id, oldValue: existing, newValue: updateData });

  return { id: updated.id, name: updated.name, email: updated.email, role: updated.role.name, isActive: updated.isActive };
}

async function deleteUser(id, actorId) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  await logAudit({ userId: actorId, action: 'DEACTIVATE_USER', entityType: 'User', entityId: id });
}

async function assignSkills(userId, skillIds, actorId) {
  // Remove existing and re-assign
  await prisma.userSkill.deleteMany({ where: { userId } });
  const data = skillIds.map((skillId) => ({ userId, skillId }));
  await prisma.userSkill.createMany({ data, skipDuplicates: true });
  await logAudit({ userId: actorId, action: 'ASSIGN_SKILLS', entityType: 'User', entityId: userId, newValue: { skillIds } });
}

async function listRoles() {
  return prisma.role.findMany();
}

module.exports = { listUsers, getUserById, createUser, updateUser, deleteUser, assignSkills, listRoles };
