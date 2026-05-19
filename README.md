# Enterprise Timesheet & Resource Management System

A full-stack enterprise application for managing employee timesheets, project allocations, and resource utilization with role-based access control.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite, Tailwind CSS v4, React Router v7, TanStack Query, Zustand, React Hook Form + Zod, Recharts |
| Backend | Node.js + Express 5, Prisma ORM v7, JWT Auth, Zod validation |
| Database | PostgreSQL 16 |
| Deployment | Docker + Docker Compose |

## Roles

| Role | Capabilities |
|------|-------------|
| **Resource Manager** | Create/archive projects, manage users, upload holidays, manage skills, org-wide reports |
| **Project Manager** | Manage team, set allocations, approve/reject timesheets & exceptions, team dashboard |
| **Employee** | Fill timesheets, submit for approval, raise exception requests, personal dashboard |

## Quick Start (Docker)

```bash
# Clone and start everything
docker-compose up --build

# App available at:
# Frontend: http://localhost:80
# Backend API: http://localhost:3000
# API Health: http://localhost:3000/health
```

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL 16 running locally

### Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
# Edit .env — set DATABASE_URL to your PostgreSQL connection string

# Run database migrations
npx prisma migrate dev --name init

# Seed demo data
npm run db:seed

# Start dev server (port 3000)
npm run dev
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (port 5173, proxies /api to localhost:3000)
npm run dev
```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Resource Manager | rm@company.com | Password123! |
| Project Manager | pm@company.com | Password123! |
| Employee 1 | emp1@company.com | Password123! |
| Employee 2 | emp2@company.com | Password123! |

## API Reference

All endpoints prefixed with `/api/v1`. Auth: `Authorization: Bearer <token>`

```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /users                    (RM)
POST   /users                    (RM)
PATCH  /users/:id                (RM)
DELETE /users/:id                (RM)
POST   /users/:id/skills         (RM)

GET    /projects
POST   /projects                 (RM)
PATCH  /projects/:id             (RM/PM)
PATCH  /projects/:id/archive     (RM)
GET    /projects/:id/members
POST   /projects/:id/members     (RM/PM)
DELETE /projects/:id/members/:uid (RM/PM)

GET    /allocations
POST   /allocations              (RM/PM)
PATCH  /allocations/:id          (RM/PM)
DELETE /allocations/:id          (RM/PM)

GET    /timesheets
POST   /timesheets               (Employee)
GET    /timesheets/:id
PATCH  /timesheets/:id           (Employee — save entries)
POST   /timesheets/:id/submit    (Employee)
POST   /timesheets/:id/copy-previous (Employee)
POST   /timesheets/:id/approve   (PM/RM)
POST   /timesheets/:id/reject    (PM/RM)

GET    /exceptions
POST   /exceptions               (Employee)
POST   /exceptions/:id/approve  (PM/RM)
POST   /exceptions/:id/reject   (PM/RM)

GET    /holidays?year=
POST   /holidays/bulk            (RM)
DELETE /holidays/:id             (RM)

GET    /skills
POST   /skills                   (RM)
PATCH  /skills/:id               (RM)
DELETE /skills/:id               (RM)

GET    /dashboard/employee
GET    /dashboard/pm
GET    /dashboard/rm

GET    /reports/employee/:id?from=&to=   → Excel download
GET    /reports/project/:id?from=&to=    → Excel download
GET    /reports/utilization?from=&to=    → Excel download (RM)
```

## Validation Rules

The system enforces these rules on every timesheet entry:

1. **Date Range** — max 2 weeks past, 1 week future
2. **Weekend Restriction** — no weekend entries without approved exception
3. **Holiday Restriction** — no holiday entries without approved exception
4. **Max 12h/day** — total across all projects cannot exceed 12 hours
5. **Allocation Limit** — cannot exceed allocated project hours without approved exception

## Exception Workflow

```
Employee raises request → Project Manager approves/rejects → Employee can submit restricted entry
```

Exception types: `WEEKEND`, `HOLIDAY`, `BACKDATE`, `ALLOCATION_BREACH`

## Project Structure

```
timesheet-app/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── app.js
│       ├── config/          (env, database, logger)
│       ├── middleware/      (authenticate, authorize, validate, errorHandler)
│       ├── services/        (validationEngine, utilizationEngine, excelExport, auditService)
│       ├── utils/           (apiResponse, dateUtils, pagination, constants)
│       └── modules/
│           ├── auth/
│           ├── users/
│           ├── projects/
│           ├── allocations/
│           ├── timesheets/
│           ├── exceptions/
│           ├── dashboard/
│           ├── holidays/
│           ├── reports/
│           └── skills/
└── frontend/
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── store/           (authStore, uiStore)
        ├── services/        (api, auth, timesheet, project, ...)
        ├── hooks/           (useRBAC, useToast)
        ├── utils/           (dateHelpers, constants)
        ├── routes/          (AppRouter, PrivateRoute, RoleRoute)
        ├── layouts/         (AppLayout, Sidebar)
        ├── components/
        │   ├── ui/          (Modal, Toast, StatusBadge, StatCard, ConfirmDialog)
        │   └── charts/      (UtilizationDonut, WeeklyBarChart)
        └── pages/
            ├── Login/
            ├── Dashboard/   (Employee, PM, RM dashboards)
            ├── Timesheets/  (List + weekly grid detail)
            ├── Projects/
            ├── Allocations/
            ├── Exceptions/
            ├── Holidays/
            ├── Skills/
            ├── Users/
            └── Reports/
```

## Production Deployment

See `docker-compose.yml` for containerized deployment. For AWS:

- **API**: ECS Fargate (2+ tasks, auto-scale)
- **Frontend**: ECS Fargate with Nginx, or S3 + CloudFront
- **Database**: RDS PostgreSQL Multi-AZ
- **Secrets**: AWS Secrets Manager (never commit `.env`)

Run migrations before deploying: `npx prisma migrate deploy`
