-- CreateIndex
CREATE INDEX "Allocation_employeeId_idx" ON "Allocation"("employeeId");

-- CreateIndex
CREATE INDEX "Allocation_projectId_idx" ON "Allocation"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ExceptionRequest_employeeId_status_idx" ON "ExceptionRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "ExceptionRequest_requestDate_requestType_idx" ON "ExceptionRequest"("requestDate", "requestType");

-- CreateIndex
CREATE INDEX "ExceptionRequest_status_idx" ON "ExceptionRequest"("status");

-- CreateIndex
CREATE INDEX "Project_projectManagerId_status_idx" ON "Project"("projectManagerId", "status");

-- CreateIndex
CREATE INDEX "ProjectMember_employeeId_idx" ON "ProjectMember"("employeeId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Timesheet_employeeId_status_idx" ON "Timesheet"("employeeId", "status");

-- CreateIndex
CREATE INDEX "Timesheet_weekStart_idx" ON "Timesheet"("weekStart");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE INDEX "TimesheetEntry_timesheetId_idx" ON "TimesheetEntry"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_projectId_entryDate_idx" ON "TimesheetEntry"("projectId", "entryDate");

-- CreateIndex
CREATE INDEX "TimesheetEntry_entryDate_idx" ON "TimesheetEntry"("entryDate");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
