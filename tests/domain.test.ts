import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryWorkspaceStorage,
  WorkspaceStore,
  migrateLegacy,
} from "../src/repositories/workspace";
import { NexusActions } from "../src/services/actions";
import { seedWorkspace } from "../src/domain/seed";
import { flowElapsed, projectFinance } from "../src/domain/selectors";
import { createRepositories } from "../src/repositories/contracts";
import {
  MockCalendarProvider,
  NexusContextBuilder,
} from "../src/services/providers";
function setup() {
  const storage = new MemoryWorkspaceStorage();
  const store = new WorkspaceStore(storage);
  store.load();
  return { store, storage, actions: new NexusActions(store) };
}
test("legacy migration preserves all projects, captured text and actual IDs without inventing ideas", () => {
  const seed = seedWorkspace();
  const migrated = migrateLegacy(
    {
      projects: seed.projects,
      inbox: [
        {
          id: "kept-id",
          type: "idea",
          content: "Mi idea privada",
          createdAt: 1234,
        },
        {
          id: "old-money",
          type: "income",
          content: "$720 por confirmar",
          createdAt: 1235,
        },
      ],
    },
    seed.user.id,
  );
  assert.equal(migrated.projects.length, 6);
  assert.equal(migrated.ideas.length, 1);
  assert.equal(migrated.ideas[0].id, "kept-id");
  assert.equal(migrated.ideas[0].title, "Mi idea privada");
  assert.equal(migrated.inbox[1].content, "$720 por confirmar");
  assert.equal(migrated.incomes.length, 1);
  assert.equal(migrated.incomes[0].amount, 400);
});
test("WIP rejects the sixth project and allows activation after pausing one", () => {
  const { store, actions } = setup();
  assert.throws(() => actions.setStatus("nicasa", "active"), /capacidad/);
  assert.equal(
    store.getSnapshot().projects.find((p) => p.id === "nicasa")?.status,
    "backlog",
  );
  actions.setStatus("criscasa", "waiting");
  actions.setStatus("nicasa", "active");
  assert.equal(
    store.getSnapshot().projects.filter((p) => p.status === "active").length,
    5,
  );
});
test("capture routes to its domain; conversion is idempotent and does not consume active capacity", () => {
  const { store, actions } = setup();
  const ideaId = actions.capture({
    type: "idea",
    content: "  Nueva idea  ",
    category: "XARCON",
  });
  const p1 = actions.convertIdea(ideaId);
  const p2 = actions.convertIdea(ideaId);
  assert.equal(p1, p2);
  assert.equal(
    store.getSnapshot().projects.filter((p) => p.id === p1).length,
    1,
  );
  assert.equal(
    store.getSnapshot().projects.find((p) => p.id === p1)?.status,
    "backlog",
  );
  assert.equal(
    store.getSnapshot().ideas.find((i) => i.id === ideaId)?.status,
    "converted",
  );
});
test("task progress can decrease when work is reopened", () => {
  const { store, actions } = setup();
  actions.toggleTask("criscasa", "ct1");
  actions.toggleTask("criscasa", "ct2");
  const completed = store.getSnapshot().projects[0].progress;
  actions.toggleTask("criscasa", "ct1");
  assert.ok(store.getSnapshot().projects[0].progress < completed);
});
test("Flow uses wall time minus pauses, persists and completes only once", () => {
  const { store, storage, actions } = setup();
  actions.startFlow("criscasa", "ct1", 25);
  const flow = store.getSnapshot().activeFlow!;
  assert.equal(
    flowElapsed({ ...flow, startedAt: 0, pausedMs: 1000 }, 10000),
    9,
  );
  assert.equal(
    flowElapsed(
      { ...flow, startedAt: 0, pausedMs: 1000, pausedAt: 5000 },
      20000,
    ),
    4,
  );
  actions.pauseFlow();
  const reopened = new WorkspaceStore(storage);
  reopened.load();
  assert.ok(reopened.getSnapshot().activeFlow?.pausedAt);
  actions.endFlow(true);
  actions.endFlow(true);
  assert.equal(store.getSnapshot().flows.length, 1);
  assert.equal(store.getSnapshot().projects[0].tasks[0].completed, true);
  assert.equal(store.getSnapshot().activeFlow, null);
});
test("invalid finance captures never leave partial Inbox or financial records", () => {
  const { store, actions } = setup();
  const before = store.getSnapshot();
  assert.throws(() =>
    actions.capture({ type: "income", content: "Cobro", amount: NaN }),
  );
  assert.equal(store.getSnapshot(), before);
  actions.capture({
    type: "income",
    content: "Cobro real",
    amount: 100.12,
    projectId: "criscasa",
  });
  assert.equal(
    projectFinance(store.getSnapshot(), store.getSnapshot().projects[0]).paid,
    500.12,
  );
  assert.equal(
    projectFinance(store.getSnapshot(), store.getSnapshot().projects[0])
      .receivable,
    299.88,
  );
});
test("repositories reject access to another owner", async () => {
  const { store } = setup();
  const repos = createRepositories(store);
  await assert.rejects(repos.projects.list("another-owner"), /autorizado/);
});
test("failed persistence preserves last good state; invalid backups are rejected", () => {
  const store = new WorkspaceStore({
    read: () => null,
    write: () => {
      throw new Error("Quota exceeded");
    },
  });
  store.load();
  const before = store.getSnapshot();
  assert.throws(
    () =>
      new NexusActions(store).capture({ type: "idea", content: "No perder" }),
    /guardar/,
  );
  assert.equal(store.getSnapshot(), before);
  const good = setup();
  assert.throws(() => good.store.import({ schemaVersion: 2 }), /compatible/);
});
test("calendar availability excludes overlapping blocks and review scheduling updates one event", async () => {
  const { store, actions } = setup();
  const provider = new MockCalendarProvider(createRepositories(store).calendar);
  const slots = await provider.findAvailability(
    store.userId,
    "2026-09-22T12:00:00-06:00",
    "2026-09-22T14:00:00-06:00",
    60,
  );
  assert.equal(slots.length, 0);
  actions.scheduleReview("seed-1", "2026-10-01");
  actions.scheduleReview("seed-1", "2026-10-02");
  const events = store
    .getSnapshot()
    .events.filter((e) => e.metadata?.ideaId === "seed-1");
  assert.equal(events.length, 1);
  assert.equal(events[0].start.slice(0, 10), "2026-10-02");
});
test("dependency cycles are rejected and unfinished dependencies block completion", () => {
  const { store, actions } = setup();
  const [a, b] = store.getSnapshot().projects[0].tasks;
  actions.addDependency(a, b.id);
  assert.throws(() => actions.addDependency(b, a.id), /ciclo/);
  assert.throws(() => actions.toggleTask("criscasa", a.id), /primero/);
  actions.toggleTask("criscasa", b.id);
  actions.toggleTask("criscasa", a.id);
  assert.ok(store.getSnapshot().projects[0].tasks[0].completed);
});
test("AI context omits disabled categories", () => {
  const w = seedWorkspace();
  w.user.preferences.aiContext = {
    projects: false,
    calendar: false,
    finance: false,
    knowledge: false,
  };
  const context = new NexusContextBuilder().build(w);
  assert.deepEqual(
    [context.projects, context.events, context.finance, context.knowledge],
    [[], [], [], []],
  );
});
test("a new user starts with an isolated empty workspace", async () => {
  const storage = new MemoryWorkspaceStorage();
  const original = new WorkspaceStore(storage);
  original.load();
  new NexusActions(original).capture({
    type: "idea",
    content: "Solo dueño original",
  });
  const other = new WorkspaceStore(storage, "another-owner");
  other.load();
  assert.equal(other.getSnapshot().projects.length, 0);
  assert.equal(other.getSnapshot().ideas.length, 0);
  new NexusActions(other).capture({
    type: "idea",
    content: "Mi espacio separado",
  });
  assert.equal(other.getSnapshot().ideas[0].userId, "another-owner");
  assert.equal(
    (await createRepositories(other).ideas.list("another-owner")).length,
    1,
  );
});
test("restoring malformed preferences cannot replace working data", () => {
  const { store } = setup();
  const before = store.getSnapshot();
  const bad = structuredClone(before);
  delete (bad.user.preferences as Partial<typeof bad.user.preferences>)
    .aiContext;
  assert.throws(() => store.import(bad), /Preferencias/);
  assert.equal(store.getSnapshot(), before);
});
