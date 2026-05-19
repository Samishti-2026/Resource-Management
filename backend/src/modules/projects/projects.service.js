const prisma = require('../../config/database');
const { getPagination, paginationMeta } = require('../../utils/pagination');
const { logAudit } = require('../../services/auditService');

async function listProjects(query, user) {
  const { skip, limit, page } = getPagination(query);
  const where = {};

  if (query.status) where.status = query.status;
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

  // PM sees only their projects; Employee sees projects they're members of
  if (user.role === 'PROJECT_MANAGER') {
    where.projectManagerId = user.id;
  } else if (user.role === 'EMPLOYEE') {
    where.members = { some: { employeeId: user.id } };
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      include: {
        projectManager: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.count({ where }),
  ]);

  return { projects, meta: paginationMeta(total, page, limit) };
}

async function getProjectById(id, user) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      projectManager: { select: { id: true, name: true, email: true } },
      members: {
        include: { employee: { select: { id: true, name: true, email: true, role: true } } },
      },
      allocations: {
        include: { employee: { select: { id: true, name: true } } },
        orderBy: { periodStart: 'desc' },
      },
    },
  });
  if (!project) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
  return project;
}

async function createProject(data, actorId) {
  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      projectManagerId: data.projectManagerId,
      createdBy: actorId,
    },
    include: { projectManager: { select: { id: true, name: true } } },
  });
  await logAudit({ userId: actorId, action: 'CREATE_PROJECT', entityType: 'Project', entityId: project.id, newValue: data });
  return project;
}

async function updateProject(id, data, actorId) {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Project not found'), { statusCode: 404 });

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.projectManagerId && { projectManagerId: data.projectManagerId }),
    },
    include: { projectManager: { select: { id: true, name: true } } },
  });
  await logAudit({ userId: actorId, action: 'UPDATE_PROJECT', entityType: 'Project', entityId: id, oldValue: existing, newValue: data });
  return updated;
}

async function archiveProject(id, actorId) {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Project not found'), { statusCode: 404 });

  const updated = await prisma.project.update({ where: { id }, data: { status: 'ARCHIVED' } });
  await logAudit({ userId: actorId, action: 'ARCHIVE_PROJECT', entityType: 'Project', entityId: id });
  return updated;
}

async function addMember(projectId, employeeId, actorId) {
  const member = await prisma.projectMember.create({
    data: { projectId, employeeId },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
  await logAudit({ userId: actorId, action: 'ADD_MEMBER', entityType: 'Project', entityId: projectId, newValue: { employeeId } });
  return member;
}

async function removeMember(projectId, employeeId, actorId) {
  await prisma.projectMember.deleteMany({ where: { projectId, employeeId } });
  await logAudit({ userId: actorId, action: 'REMOVE_MEMBER', entityType: 'Project', entityId: projectId, newValue: { employeeId } });
}

async function getProjectMembers(projectId) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { employee: { select: { id: true, name: true, email: true, role: true } } },
  });
}

module.exports = { listProjects, getProjectById, createProject, updateProject, archiveProject, addMember, removeMember, getProjectMembers };
