const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create roles
  const roles = await Promise.all([
    prisma.role.upsert({ where: { name: 'RESOURCE_MANAGER' }, update: {}, create: { name: 'RESOURCE_MANAGER' } }),
    prisma.role.upsert({ where: { name: 'PROJECT_MANAGER' }, update: {}, create: { name: 'PROJECT_MANAGER' } }),
    prisma.role.upsert({ where: { name: 'EMPLOYEE' }, update: {}, create: { name: 'EMPLOYEE' } }),
  ]);

  const [rmRole, pmRole, empRole] = roles;
  console.log('Roles created:', roles.map((r) => r.name));

  const hash = (pw) => bcrypt.hash(pw, 10);

  // Create users
  const rm = await prisma.user.upsert({
    where: { email: 'rm@company.com' },
    update: {},
    create: { name: 'Alice Resource', email: 'rm@company.com', passwordHash: await hash('Password123!'), roleId: rmRole.id },
  });

  const pm = await prisma.user.upsert({
    where: { email: 'pm@company.com' },
    update: {},
    create: { name: 'Bob Manager', email: 'pm@company.com', passwordHash: await hash('Password123!'), roleId: pmRole.id },
  });

  const emp1 = await prisma.user.upsert({
    where: { email: 'emp1@company.com' },
    update: {},
    create: { name: 'Charlie Dev', email: 'emp1@company.com', passwordHash: await hash('Password123!'), roleId: empRole.id },
  });

  const emp2 = await prisma.user.upsert({
    where: { email: 'emp2@company.com' },
    update: {},
    create: { name: 'Diana Designer', email: 'emp2@company.com', passwordHash: await hash('Password123!'), roleId: empRole.id },
  });

  console.log('Users created');

  // Create skills
  const skills = await Promise.all([
    prisma.skill.upsert({ where: { name: 'React' }, update: {}, create: { name: 'React', description: 'React.js frontend', createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'Node.js' }, update: {}, create: { name: 'Node.js', description: 'Node.js backend', createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'PostgreSQL' }, update: {}, create: { name: 'PostgreSQL', description: 'Database', createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'UI/UX Design' }, update: {}, create: { name: 'UI/UX Design', description: 'Design skills', createdBy: rm.id } }),
  ]);

  // Assign skills to employees
  await prisma.userSkill.createMany({
    data: [
      { userId: emp1.id, skillId: skills[0].id },
      { userId: emp1.id, skillId: skills[1].id },
      { userId: emp2.id, skillId: skills[3].id },
    ],
    skipDuplicates: true,
  });

  // Create project
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Enterprise Portal',
      description: 'Main enterprise web portal',
      projectManagerId: pm.id,
      createdBy: rm.id,
    },
  });

  // Add members
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, employeeId: emp1.id },
      { projectId: project.id, employeeId: emp2.id },
    ],
    skipDuplicates: true,
  });

  // Create allocations (with permissible time window)
  const allocStart = new Date(`${year}-01-01`);
  const allocEnd = new Date(`${year}-12-31`);
  await prisma.allocation.createMany({
    data: [
      { employeeId: emp1.id, projectId: project.id, allocatedHours: 160, startDate: allocStart, endDate: allocEnd, createdBy: pm.id },
      { employeeId: emp2.id, projectId: project.id, allocatedHours: 120, startDate: allocStart, endDate: allocEnd, createdBy: pm.id },
    ],
    skipDuplicates: true,
  });

  // Create holidays for current year
  const now = new Date();
  const year = now.getFullYear();
  const holidays = [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: `${year}-01-26`, name: 'Republic Day' },
    { date: `${year}-08-15`, name: 'Independence Day' },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
    { date: `${year}-12-25`, name: 'Christmas Day' },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { holidayDate: new Date(h.date) },
      update: {},
      create: { holidayDate: new Date(h.date), holidayName: h.name, createdBy: rm.id },
    });
  }

  console.log('Seed completed successfully!');
  console.log('\nTest credentials:');
  console.log('  Resource Manager: rm@company.com / Password123!');
  console.log('  Project Manager:  pm@company.com / Password123!');
  console.log('  Employee 1:       emp1@company.com / Password123!');
  console.log('  Employee 2:       emp2@company.com / Password123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
