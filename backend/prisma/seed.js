const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { addDays, startOfWeek, subDays, getISOWeek } = require('date-fns');

const prisma = new PrismaClient();

function getMonday(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}
function toDate(str) { return new Date(str); }

async function main() {
  console.log('Seeding database with Indian data...');

  const now  = new Date();
  const year = now.getFullYear();
  const hash = (pw) => bcrypt.hash(pw, 10);

  /* ── Roles ──────────────────────────────────────────────────────────────── */
  const [rmRole, pmRole, empRole] = await Promise.all([
    prisma.role.upsert({ where: { name: 'RESOURCE_MANAGER' }, update: {}, create: { name: 'RESOURCE_MANAGER' } }),
    prisma.role.upsert({ where: { name: 'PROJECT_MANAGER'  }, update: {}, create: { name: 'PROJECT_MANAGER'  } }),
    prisma.role.upsert({ where: { name: 'EMPLOYEE'         }, update: {}, create: { name: 'EMPLOYEE'         } }),
  ]);

  /* ── Users ──────────────────────────────────────────────────────────────── */
  const rm = await prisma.user.upsert({
    where: { email: 'rm@samishti.com' }, update: {},
    create: { name: 'Rajesh Sharma', email: 'rm@samishti.com', passwordHash: await hash('Password123!'), roleId: rmRole.id },
  });
  const pm1 = await prisma.user.upsert({
    where: { email: 'pm1@samishti.com' }, update: {},
    create: { name: 'Priya Nair', email: 'pm1@samishti.com', passwordHash: await hash('Password123!'), roleId: pmRole.id },
  });
  const pm2 = await prisma.user.upsert({
    where: { email: 'pm2@samishti.com' }, update: {},
    create: { name: 'Amit Kulkarni', email: 'pm2@samishti.com', passwordHash: await hash('Password123!'), roleId: pmRole.id },
  });
  const emp1 = await prisma.user.upsert({
    where: { email: 'emp1@samishti.com' }, update: {},
    create: { name: 'Vikram Desai', email: 'emp1@samishti.com', passwordHash: await hash('Password123!'), roleId: empRole.id },
  });
  const emp2 = await prisma.user.upsert({
    where: { email: 'emp2@samishti.com' }, update: {},
    create: { name: 'Sneha Patil', email: 'emp2@samishti.com', passwordHash: await hash('Password123!'), roleId: empRole.id },
  });
  const emp3 = await prisma.user.upsert({
    where: { email: 'emp3@samishti.com' }, update: {},
    create: { name: 'Rohit Joshi', email: 'emp3@samishti.com', passwordHash: await hash('Password123!'), roleId: empRole.id },
  });
  const emp4 = await prisma.user.upsert({
    where: { email: 'emp4@samishti.com' }, update: {},
    create: { name: 'Ananya Iyer', email: 'emp4@samishti.com', passwordHash: await hash('Password123!'), roleId: empRole.id },
  });
  console.log('Users created');

  /* ── Skills ─────────────────────────────────────────────────────────────── */
  const [sReact, sNode, sPG, sDesign, sQA, sBA, sJava, sPython] = await Promise.all([
    prisma.skill.upsert({ where: { name: 'React'              }, update: {}, create: { name: 'React',               description: 'React.js frontend development',   createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'Node.js'            }, update: {}, create: { name: 'Node.js',             description: 'Node.js backend development',     createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'PostgreSQL'         }, update: {}, create: { name: 'PostgreSQL',          description: 'Relational database',             createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'UI/UX Design'       }, update: {}, create: { name: 'UI/UX Design',        description: 'Figma, wireframing, prototyping', createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'QA Testing'         }, update: {}, create: { name: 'QA Testing',          description: 'Manual & automation testing',     createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'Business Analysis'  }, update: {}, create: { name: 'Business Analysis',   description: 'Requirements & process analysis', createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'Java'               }, update: {}, create: { name: 'Java',                description: 'Java Spring Boot backend',        createdBy: rm.id } }),
    prisma.skill.upsert({ where: { name: 'Python'             }, update: {}, create: { name: 'Python',              description: 'Python data & scripting',         createdBy: rm.id } }),
  ]);

  await prisma.userSkill.createMany({
    skipDuplicates: true,
    data: [
      { userId: emp1.id, skillId: sReact.id  },
      { userId: emp1.id, skillId: sNode.id   },
      { userId: emp1.id, skillId: sPG.id     },
      { userId: emp2.id, skillId: sDesign.id },
      { userId: emp2.id, skillId: sReact.id  },
      { userId: emp3.id, skillId: sQA.id     },
      { userId: emp3.id, skillId: sJava.id   },
      { userId: emp4.id, skillId: sBA.id     },
      { userId: emp4.id, skillId: sPython.id },
      { userId: emp4.id, skillId: sPG.id     },
    ],
  });

  /* ── Projects ───────────────────────────────────────────────────────────── */
  const proj1 = await prisma.project.upsert({
    where: { id: 1 }, update: {},
    create: {
      name: 'Samishti ERP Portal',
      description: 'Internal ERP system for HR, Finance and Operations',
      projectManagerId: pm1.id, createdBy: rm.id,
    },
  });
  const proj2 = await prisma.project.upsert({
    where: { id: 2 }, update: {},
    create: {
      name: 'Citizen Services Mobile App',
      description: 'Government citizen services mobile application for Maharashtra',
      projectManagerId: pm1.id, createdBy: rm.id,
    },
  });
  const proj3 = await prisma.project.upsert({
    where: { id: 3 }, update: {},
    create: {
      name: 'GST Analytics Dashboard',
      description: 'Business intelligence dashboard for GST compliance and reporting',
      projectManagerId: pm2.id, createdBy: rm.id,
    },
  });
  console.log('Projects created');

  /* ── Project Members ────────────────────────────────────────────────────── */
  await prisma.projectMember.createMany({
    skipDuplicates: true,
    data: [
      // Samishti ERP Portal: Vikram, Sneha, Rohit
      { projectId: proj1.id, employeeId: emp1.id },
      { projectId: proj1.id, employeeId: emp2.id },
      { projectId: proj1.id, employeeId: emp3.id },
      // Citizen Services Mobile App: Vikram, Sneha
      { projectId: proj2.id, employeeId: emp1.id },
      { projectId: proj2.id, employeeId: emp2.id },
      // GST Analytics Dashboard: Rohit, Ananya
      { projectId: proj3.id, employeeId: emp3.id },
      { projectId: proj3.id, employeeId: emp4.id },
    ],
  });

  /* ── Allocations (full year window) ─────────────────────────────────────── */
  const allocStart = toDate(`${year}-01-01`);
  const allocEnd   = toDate(`${year}-12-31`);

  await prisma.allocation.deleteMany({
    where: { projectId: { in: [proj1.id, proj2.id, proj3.id] } },
  });
  await prisma.allocation.createMany({
    data: [
      // Samishti ERP Portal
      { employeeId: emp1.id, projectId: proj1.id, allocatedHours: 200, startDate: allocStart, endDate: allocEnd, createdBy: pm1.id },
      { employeeId: emp2.id, projectId: proj1.id, allocatedHours: 160, startDate: allocStart, endDate: allocEnd, createdBy: pm1.id },
      { employeeId: emp3.id, projectId: proj1.id, allocatedHours: 120, startDate: allocStart, endDate: allocEnd, createdBy: pm1.id },
      // Citizen Services Mobile App
      { employeeId: emp1.id, projectId: proj2.id, allocatedHours: 100, startDate: allocStart, endDate: allocEnd, createdBy: pm1.id },
      { employeeId: emp2.id, projectId: proj2.id, allocatedHours:  80, startDate: allocStart, endDate: allocEnd, createdBy: pm1.id },
      // GST Analytics Dashboard
      { employeeId: emp3.id, projectId: proj3.id, allocatedHours: 150, startDate: allocStart, endDate: allocEnd, createdBy: pm2.id },
      { employeeId: emp4.id, projectId: proj3.id, allocatedHours: 180, startDate: allocStart, endDate: allocEnd, createdBy: pm2.id },
    ],
  });
  console.log('Allocations created');

  /* ── Timesheets: last 2 weeks + current week ────────────────────────────── */
  // weekOffset -2 → APPROVED, -1 → SUBMITTED, 0 → DRAFT
  // NOTE: we only create entries for offsets -1 and 0 (within the 14-day window).
  // The APPROVED timesheet (offset -2) is created with status only — no entries,
  // so it never triggers "out of range" validation issues.
  for (const { emp, projects: empProjs, hoursPerProj } of [
    { emp: emp1, projects: [proj1, proj2], hoursPerProj: [6, 2] },
    { emp: emp2, projects: [proj1, proj2], hoursPerProj: [5, 3] },
    { emp: emp3, projects: [proj1, proj3], hoursPerProj: [4, 4] },
  ]) {
    for (const weekOffset of [-2, -1, 0]) {
      const anchor    = weekOffset < 0 ? subDays(now, Math.abs(weekOffset) * 7) : now;
      const weekStart = getMonday(anchor);
      const weekEnd   = addDays(weekStart, 6);
      const weekNum   = getISOWeek(weekStart);
      const status    = weekOffset === -2 ? 'APPROVED' : weekOffset === -1 ? 'SUBMITTED' : 'DRAFT';

      let ts = await prisma.timesheet.findUnique({
        where: { employeeId_weekStart: { employeeId: emp.id, weekStart } },
      });
      if (!ts) {
        ts = await prisma.timesheet.create({
          data: {
            employeeId: emp.id, weekStart, weekEnd, weekNumber: weekNum, status,
            remarks: weekOffset === 0 ? 'Work in progress' : null,
            submittedAt: weekOffset <= -1 ? addDays(weekStart, 5) : null,
            reviewedAt:  weekOffset === -2 ? addDays(weekStart, 6) : null,
            reviewedBy:  weekOffset === -2 ? pm1.id : null,
          },
        });
      }

      await prisma.timesheetEntry.deleteMany({ where: { timesheetId: ts.id } });

      // Only create entries for weeks within the 14-day allowed window (offset -1 and 0)
      // offset -2 is ~14 days ago — skip entries to avoid out-of-range issues
      if (weekOffset === -2) continue;

      const entries = [];
      for (let d = 0; d < 5; d++) { // Mon–Fri only
        const entryDate = addDays(weekStart, d);
        empProjs.forEach((proj, pi) => {
          entries.push({ timesheetId: ts.id, projectId: proj.id, entryDate, hours: hoursPerProj[pi] });
        });
      }
      await prisma.timesheetEntry.createMany({ data: entries });
    }
  }

  // Ananya: current week only, DRAFT, partial entries
  const emp4WeekStart = getMonday(now);
  const emp4WeekEnd   = addDays(emp4WeekStart, 6);
  let emp4Ts = await prisma.timesheet.findUnique({
    where: { employeeId_weekStart: { employeeId: emp4.id, weekStart: emp4WeekStart } },
  });
  if (!emp4Ts) {
    emp4Ts = await prisma.timesheet.create({
      data: {
        employeeId: emp4.id, weekStart: emp4WeekStart, weekEnd: emp4WeekEnd,
        weekNumber: getISOWeek(emp4WeekStart), status: 'DRAFT',
      },
    });
  }
  await prisma.timesheetEntry.deleteMany({ where: { timesheetId: emp4Ts.id } });
  for (let d = 0; d < 3; d++) {
    await prisma.timesheetEntry.create({
      data: { timesheetId: emp4Ts.id, projectId: proj3.id, entryDate: addDays(emp4WeekStart, d), hours: 7 },
    });
  }
  console.log('Timesheets and entries created');

  /* ── Indian Public Holidays ─────────────────────────────────────────────── */
  const holidays = [
    { date: `${year}-01-01`, name: "New Year's Day"      },
    { date: `${year}-01-26`, name: 'Republic Day'        },
    { date: `${year}-03-14`, name: 'Holi'                },
    { date: `${year}-04-14`, name: 'Ambedkar Jayanti'    },
    { date: `${year}-04-18`, name: 'Good Friday'         },
    { date: `${year}-05-01`, name: 'Maharashtra Day'     },
    { date: `${year}-08-15`, name: 'Independence Day'    },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti'      },
    { date: `${year}-10-20`, name: 'Dussehra'            },
    { date: `${year}-11-05`, name: 'Diwali'              },
    { date: `${year}-11-15`, name: 'Guru Nanak Jayanti'  },
    { date: `${year}-12-25`, name: 'Christmas Day'       },
  ];
  for (const h of holidays) {
    await prisma.holiday.upsert({
      where:  { holidayDate: toDate(h.date) },
      update: { holidayName: h.name },
      create: { holidayDate: toDate(h.date), holidayName: h.name, createdBy: rm.id },
    });
  }
  console.log('Holidays created');

  console.log('\n✅ Seed completed successfully!');
  console.log('\nTest credentials (password: Password123!):');
  console.log('  Resource Manager : rm@samishti.com    → Rajesh Sharma');
  console.log('  Project Manager 1: pm1@samishti.com   → Priya Nair       (ERP Portal, Mobile App)');
  console.log('  Project Manager 2: pm2@samishti.com   → Amit Kulkarni    (GST Analytics)');
  console.log('  Employee 1       : emp1@samishti.com  → Vikram Desai     (ERP Portal + Mobile App)');
  console.log('  Employee 2       : emp2@samishti.com  → Sneha Patil      (ERP Portal + Mobile App)');
  console.log('  Employee 3       : emp3@samishti.com  → Rohit Joshi      (ERP Portal + GST Analytics)');
  console.log('  Employee 4       : emp4@samishti.com  → Ananya Iyer      (GST Analytics)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
