import test from "node:test";
import assert from "node:assert/strict";
import { galaxyBudget, orbitOrder, orbitPosition } from "../src/lib/orbits";

test("project orbit bands stay ordered for empty, small and crowded workspaces", () => {
  for (const count of [0, 3, 20, 200]) {
    let previous = 0;
    for (const status of orbitOrder) {
      const nodes = Array.from({ length: Math.max(1, count) }, (_, i) =>
        orbitPosition(status, i, count),
      );
      assert.ok(
        nodes.every((n) => Number.isFinite(n.angle) && n.radius > previous),
      );
      previous = Math.max(...nodes.map((n) => n.radius));
    }
  }
});

test("galaxy quality budgets favor low idle cost and short interaction boosts", () => {
  for (const quality of ["auto", "low", "high"] as const) {
    const mobile = galaxyBudget(quality, 390);
    const desktop = galaxyBudget(quality, 1200);
    assert.ok(mobile.particles > 0);
    assert.ok(mobile.particles <= desktop.particles);
    assert.ok(mobile.dpr <= 1.25);
    assert.ok(mobile.fps <= 20);
    assert.ok(mobile.interactionFps >= mobile.fps);
    assert.ok(desktop.interactionFps >= desktop.fps);
    assert.ok(desktop.ringCount <= 16);
  }
  const auto = galaxyBudget("auto", 1200);
  assert.ok(auto.particles <= 1000);
  assert.ok(auto.fps <= 24);
  assert.ok(auto.dpr <= 1.25);
});
