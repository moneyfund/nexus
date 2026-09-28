import assert from "node:assert/strict";
import test from "node:test";
import { seedWorkspace } from "../src/domain/seed";
import {
  buildSqlMigrationPlan,
  summarizeSqlMigrationPlan,
  usdToMinorUnits,
} from "../src/migrations/sql-connect";

test("usdToMinorUnits stores currency safely as integer cents", () => {
  assert.equal(usdToMinorUnits(12.34), 1234);
  assert.equal(usdToMinorUnits(0.1 + 0.2), 30);
  assert.throws(() => usdToMinorUnits(Number.NaN));
});

test("SQL migration plan preserves source entities without writing data", () => {
  const workspace = seedWorkspace();
  const uid = "firebase-test-user";
  const plan = buildSqlMigrationPlan(workspace, uid);
  const summary = summarizeSqlMigrationPlan(plan);

  assert.equal(plan.firebaseUid, uid);
  assert.equal(plan.user.uid, uid);
  assert.equal(plan.workspace.kind, "personal");
  assert.equal(plan.workspace.timezone, workspace.user.preferences.timezone);
  assert.equal(summary.projects, workspace.projects.length);
  assert.equal(
    summary.tasks,
    workspace.projects.reduce((total, p) => total + p.tasks.length, 0),
  );
  assert.equal(summary.ideas, workspace.ideas.length);
  assert.equal(summary.goals, workspace.goals.length);
  assert.equal(summary.calendarEvents, workspace.events.length);

  const sourceProjectIds = new Set(workspace.projects.map((p) => p.id));
  for (const project of plan.projects)
    assert.ok(sourceProjectIds.has(String(project.legacyId)));
});

test("task milestone mapping only links an exact unique source milestone", () => {
  const workspace = seedWorkspace();
  const project = workspace.projects.find((p) => p.tasks.length && p.milestones.length);
  assert.ok(project);

  const task = project.tasks[0];
  task.milestone = project.milestones[0].title;

  const plan = buildSqlMigrationPlan(workspace, "firebase-test-user");
  const migrated = plan.tasks.find((item) => item.legacyId === task.id);

  assert.equal(migrated?.milestoneLegacyId, project.milestones[0].id);
});
