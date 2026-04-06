-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "extractMode" TEXT NOT NULL,
    "attributeName" TEXT,
    "conditionOperator" TEXT NOT NULL,
    "conditionValue" TEXT,
    "proxyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "proxyProtocol" TEXT NOT NULL DEFAULT 'http',
    "proxyHost" TEXT,
    "proxyPort" INTEGER,
    "proxyUsername" TEXT,
    "proxyPassword" TEXT,
    "onMatchBehavior" TEXT NOT NULL DEFAULT 'continue',
    "notificationMode" TEXT NOT NULL DEFAULT 'transition_only',
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastValue" TEXT,
    "lastConditionMatched" BOOLEAN NOT NULL DEFAULT false,
    "lastNotifiedAt" DATETIME,
    "lastRunAt" DATETIME,
    "lastError" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("attributeName", "conditionOperator", "conditionValue", "createdAt", "enabled", "extractMode", "id", "lastError", "lastRunAt", "lastValue", "name", "proxyEnabled", "proxyHost", "proxyPassword", "proxyPort", "proxyProtocol", "proxyUsername", "runCount", "schedule", "selector", "status", "triggerCount", "updatedAt", "url", "userId") SELECT "attributeName", "conditionOperator", "conditionValue", "createdAt", "enabled", "extractMode", "id", "lastError", "lastRunAt", "lastValue", "name", "proxyEnabled", "proxyHost", "proxyPassword", "proxyPort", "proxyProtocol", "proxyUsername", "runCount", "schedule", "selector", "status", "triggerCount", "updatedAt", "url", "userId" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
