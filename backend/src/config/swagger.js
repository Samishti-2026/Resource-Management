const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Resource Management API',
      version: '1.0.0',
      description: `
## Enterprise Timesheet & Resource Management System

A complete REST API for managing employee timesheets, project allocations, approvals, and resource utilization.

### Authentication
All protected endpoints require a **Bearer JWT token** in the Authorization header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

Obtain a token via \`POST /auth/login\`. Access tokens expire in **15 minutes**. Use \`POST /auth/refresh\` to get a new one.

### Roles & Permissions
| Role | Description |
|------|-------------|
| \`RESOURCE_MANAGER\` | Full org access — creates projects, manages users, uploads holidays |
| \`PROJECT_MANAGER\` | Team access — manages allocations, approves timesheets |
| \`EMPLOYEE\` | Self access — submits timesheets, raises work requests |

### Validation Rules
1. Entries cannot be more than **14 days in the past** or **7 days in the future**
2. **Weekend** entries require an approved exception request
3. **Holiday** entries require an approved exception request
4. Maximum **12 hours per day** across all projects
5. Cannot exceed **allocated hours** without an approved exception request
      `,
      contact: {
        name: 'Resource Management Support',
        email: 'support@Resource Management.com',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server — API routes',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server — Health check',
      },
      {
        url: 'https://api.Resource Management.com/api/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
      schemas: {
        // ── Common ──────────────────────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'An error occurred' },
          },
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email address' },
                },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total:      { type: 'integer', example: 42 },
            page:       { type: 'integer', example: 1 },
            limit:      { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 3 },
            hasNext:    { type: 'boolean', example: true },
            hasPrev:    { type: 'boolean', example: false },
          },
        },

        // ── Auth ─────────────────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'rm@company.com' },
            password: { type: 'string', example: 'Password123!' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken:  { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { $ref: '#/components/schemas/UserBasic' },
          },
        },

        // ── User ─────────────────────────────────────────────────────────
        UserBasic: {
          type: 'object',
          properties: {
            id:    { type: 'integer', example: 1 },
            name:  { type: 'string',  example: 'Alice Resource' },
            email: { type: 'string',  example: 'rm@company.com' },
            role:  { type: 'string',  enum: ['RESOURCE_MANAGER', 'PROJECT_MANAGER', 'EMPLOYEE'] },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:        { type: 'integer', example: 1 },
            name:      { type: 'string',  example: 'Alice Resource' },
            email:     { type: 'string',  example: 'rm@company.com' },
            isActive:  { type: 'boolean', example: true },
            createdAt: { type: 'string',  format: 'date-time' },
            role: {
              type: 'object',
              properties: {
                id:   { type: 'integer', example: 1 },
                name: { type: 'string',  example: 'RESOURCE_MANAGER' },
              },
            },
            skills: {
              type: 'array',
              items: { $ref: '#/components/schemas/UserSkill' },
            },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['name', 'email', 'password', 'roleId'],
          properties: {
            name:     { type: 'string',  example: 'John Doe' },
            email:    { type: 'string',  format: 'email', example: 'john@company.com' },
            password: { type: 'string',  minLength: 8, example: 'Password123!' },
            roleId:   { type: 'integer', example: 3 },
          },
        },
        UpdateUserRequest: {
          type: 'object',
          properties: {
            name:     { type: 'string',  example: 'John Updated' },
            roleId:   { type: 'integer', example: 2 },
            isActive: { type: 'boolean', example: false },
            password: { type: 'string',  minLength: 8 },
          },
        },

        // ── Skill ────────────────────────────────────────────────────────
        Skill: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            name:        { type: 'string',  example: 'React' },
            description: { type: 'string',  example: 'React.js frontend development' },
            createdAt:   { type: 'string',  format: 'date-time' },
            _count: {
              type: 'object',
              properties: { userSkills: { type: 'integer', example: 5 } },
            },
          },
        },
        UserSkill: {
          type: 'object',
          properties: {
            skillId: { type: 'integer', example: 1 },
            skill: {
              type: 'object',
              properties: {
                id:   { type: 'integer', example: 1 },
                name: { type: 'string',  example: 'React' },
              },
            },
          },
        },

        // ── Project ──────────────────────────────────────────────────────
        Project: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            name:        { type: 'string',  example: 'Enterprise Portal' },
            description: { type: 'string',  example: 'Main enterprise web portal' },
            status:      { type: 'string',  enum: ['ACTIVE', 'ARCHIVED'], example: 'ACTIVE' },
            createdAt:   { type: 'string',  format: 'date-time' },
            projectManager: { $ref: '#/components/schemas/UserBasic' },
            _count: {
              type: 'object',
              properties: { members: { type: 'integer', example: 4 } },
            },
          },
        },
        CreateProjectRequest: {
          type: 'object',
          required: ['name', 'projectManagerId'],
          properties: {
            name:             { type: 'string',  example: 'Enterprise Portal' },
            description:      { type: 'string',  example: 'Optional description' },
            projectManagerId: { type: 'integer', example: 2 },
          },
        },
        ProjectMember: {
          type: 'object',
          properties: {
            id:         { type: 'integer', example: 1 },
            projectId:  { type: 'integer', example: 1 },
            employeeId: { type: 'integer', example: 3 },
            joinedAt:   { type: 'string',  format: 'date-time' },
            employee:   { $ref: '#/components/schemas/UserBasic' },
          },
        },

        // ── Allocation ───────────────────────────────────────────────────
        Allocation: {
          type: 'object',
          properties: {
            id:             { type: 'integer', example: 1 },
            employeeId:     { type: 'integer', example: 3 },
            projectId:      { type: 'integer', example: 1 },
            allocatedHours: { type: 'number',  example: 160 },
            createdAt:      { type: 'string',  format: 'date-time' },
            employee:       { $ref: '#/components/schemas/UserBasic' },
            project: {
              type: 'object',
              properties: {
                id:   { type: 'integer', example: 1 },
                name: { type: 'string',  example: 'Enterprise Portal' },
              },
            },
          },
        },
        CreateAllocationRequest: {
          type: 'object',
          required: ['employeeId', 'projectId', 'allocatedHours'],
          properties: {
            employeeId:     { type: 'integer', example: 3 },
            projectId:      { type: 'integer', example: 1 },
            allocatedHours: { type: 'number',  minimum: 1, example: 160 },
          },
        },

        // ── Timesheet ────────────────────────────────────────────────────
        Timesheet: {
          type: 'object',
          properties: {
            id:           { type: 'integer', example: 1 },
            employeeId:   { type: 'integer', example: 3 },
            weekStart:    { type: 'string',  format: 'date', example: '2026-05-19' },
            weekEnd:      { type: 'string',  format: 'date', example: '2026-05-25' },
            weekNumber:   { type: 'integer', example: 21 },
            status:       { type: 'string',  enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] },
            submittedAt:  { type: 'string',  format: 'date-time', nullable: true },
            reviewedAt:   { type: 'string',  format: 'date-time', nullable: true },
            rejectReason: { type: 'string',  nullable: true, example: 'Missing project entries' },
            employee:     { $ref: '#/components/schemas/UserBasic' },
            reviewer:     { $ref: '#/components/schemas/UserBasic', nullable: true },
            entries: {
              type: 'array',
              items: { $ref: '#/components/schemas/TimesheetEntry' },
            },
          },
        },
        TimesheetEntry: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            timesheetId: { type: 'integer', example: 1 },
            projectId:   { type: 'integer', example: 1 },
            entryDate:   { type: 'string',  format: 'date', example: '2026-05-19' },
            hours:       { type: 'number',  example: 8 },
            notes:       { type: 'string',  nullable: true, example: 'Worked on login module' },
            project: {
              type: 'object',
              properties: {
                id:   { type: 'integer', example: 1 },
                name: { type: 'string',  example: 'Enterprise Portal' },
              },
            },
          },
        },
        SaveEntriesRequest: {
          type: 'object',
          required: ['entries'],
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                required: ['projectId', 'entryDate', 'hours'],
                properties: {
                  projectId: { type: 'integer', example: 1 },
                  entryDate: { type: 'string',  format: 'date', example: '2026-05-19' },
                  hours:     { type: 'number',  minimum: 0.5, maximum: 12, example: 8 },
                  notes:     { type: 'string',  example: 'Feature development' },
                },
              },
            },
          },
        },
        RejectTimesheetRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 5, example: 'Hours logged on holiday without approval' },
          },
        },

        // ── Exception / Work Request ──────────────────────────────────────
        ExceptionRequest: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            employeeId:  { type: 'integer', example: 3 },
            projectId:   { type: 'integer', example: 1 },
            requestType: { type: 'string',  enum: ['WEEKEND', 'HOLIDAY', 'BACKDATE', 'ALLOCATION_BREACH'] },
            requestDate: { type: 'string',  format: 'date', example: '2026-05-24' },
            reason:      { type: 'string',  example: 'Critical production deployment on Saturday' },
            status:      { type: 'string',  enum: ['PENDING', 'APPROVED', 'REJECTED'] },
            reviewedAt:  { type: 'string',  format: 'date-time', nullable: true },
            createdAt:   { type: 'string',  format: 'date-time' },
            employee:    { $ref: '#/components/schemas/UserBasic' },
            reviewer:    { $ref: '#/components/schemas/UserBasic', nullable: true },
            project: {
              type: 'object',
              properties: {
                id:   { type: 'integer', example: 1 },
                name: { type: 'string',  example: 'Enterprise Portal' },
              },
            },
          },
        },
        CreateExceptionRequest: {
          type: 'object',
          required: ['projectId', 'requestType', 'requestDate', 'reason'],
          properties: {
            projectId:   { type: 'integer', example: 1 },
            requestType: { type: 'string',  enum: ['WEEKEND', 'HOLIDAY', 'BACKDATE', 'ALLOCATION_BREACH'] },
            requestDate: { type: 'string',  format: 'date', example: '2026-05-24' },
            reason:      { type: 'string',  minLength: 10, example: 'Critical production deployment on Saturday' },
          },
        },

        // ── Holiday ──────────────────────────────────────────────────────
        Holiday: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            holidayDate: { type: 'string',  format: 'date', example: '2026-12-25' },
            holidayName: { type: 'string',  example: 'Christmas Day' },
            createdAt:   { type: 'string',  format: 'date-time' },
          },
        },
        BulkHolidayRequest: {
          type: 'object',
          required: ['holidays'],
          properties: {
            holidays: {
              type: 'array',
              items: {
                type: 'object',
                required: ['date', 'name'],
                properties: {
                  date: { type: 'string', format: 'date', example: '2026-12-25' },
                  name: { type: 'string', example: 'Christmas Day' },
                },
              },
            },
          },
        },

        // ── Dashboard ────────────────────────────────────────────────────
        EmployeeDashboard: {
          type: 'object',
          properties: {
            allocatedHours:  { type: 'number',  example: 160 },
            submittedHours:  { type: 'number',  example: 112 },
            utilizationPct:  { type: 'integer', example: 70 },
            pendingApprovals:{ type: 'integer', example: 1 },
            pendingExceptions:{ type: 'integer', example: 0 },
            weeklyTrend: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  weekStart: { type: 'string', format: 'date' },
                  hours:     { type: 'number' },
                },
              },
            },
            projectBreakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  projectId:   { type: 'integer' },
                  projectName: { type: 'string' },
                  hours:       { type: 'number' },
                },
              },
            },
          },
        },
        PMDashboard: {
          type: 'object',
          properties: {
            teamUtilization:   { type: 'number',  example: 73.5 },
            pendingTimesheets: { type: 'integer', example: 4 },
            pendingExceptions: { type: 'integer', example: 2 },
            totalMembers:      { type: 'integer', example: 8 },
            activeProjects:    { type: 'integer', example: 3 },
            projectAnalytics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  projectId:   { type: 'integer' },
                  name:        { type: 'string' },
                  allocated:   { type: 'number' },
                  used:        { type: 'number' },
                  memberCount: { type: 'integer' },
                },
              },
            },
          },
        },
        RMDashboard: {
          type: 'object',
          properties: {
            orgUtilization:    { type: 'number',  example: 68.2 },
            activeProjects:    { type: 'integer', example: 14 },
            totalEmployees:    { type: 'integer', example: 45 },
            pendingTimesheets: { type: 'integer', example: 7 },
            pendingExceptions: { type: 'integer', example: 3 },
            complianceBreaches:{ type: 'integer', example: 2 },
            skillUtilization: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  skill:         { type: 'string' },
                  employeeCount: { type: 'integer' },
                  utilizedCount: { type: 'integer' },
                },
              },
            },
          },
        },
      },

      // ── Reusable responses ─────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: 'Missing or invalid JWT token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: 'Unauthorized' },
            },
          },
        },
        Forbidden: {
          description: 'Insufficient role permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: 'You do not have permission to perform this action' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: 'Resource not found' },
            },
          },
        },
        ValidationError: {
          description: 'Request body validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
      },

      // ── Reusable parameters ────────────────────────────────────────────
      parameters: {
        PageParam: {
          name: 'page', in: 'query', schema: { type: 'integer', default: 1 },
          description: 'Page number',
        },
        LimitParam: {
          name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 },
          description: 'Items per page',
        },
        IdParam: {
          name: 'id', in: 'path', required: true, schema: { type: 'integer' },
          description: 'Resource ID',
        },
      },
    },

    // Apply BearerAuth globally to all endpoints
    security: [{ BearerAuth: [] }],

    tags: [
      { name: 'Auth',        description: 'Authentication — login, refresh, logout' },
      { name: 'Users',       description: 'User management (Resource Manager only for writes)' },
      { name: 'Skills',      description: 'Skill catalog management' },
      { name: 'Projects',    description: 'Project management and team assignments' },
      { name: 'Allocations', description: 'Employee hour allocations per project' },
      { name: 'Timesheets',  description: 'Weekly timesheet submission and approval workflow' },
      { name: 'Work Requests', description: 'Exception requests for restricted timesheet entries' },
      { name: 'Holidays',    description: 'Company holiday calendar management' },
      { name: 'Dashboard',   description: 'Role-specific analytics and metrics' },
      { name: 'Reports',     description: 'Excel report downloads' },
      { name: 'Health',      description: 'Server health check' },
    ],
  },
  apis: ['./src/modules/**/*.routes.js', './src/app.js'],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
