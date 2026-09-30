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

test("mobile retains a rendered universe with a bounded quality budget", () => {
  for (const quality of ["auto", "low", "high"] as const) {
    const mobile = galaxyBudget(quality, 390);
    assert.ok(mobile.particles > 0);
    assert.ok(mobile.particles <= galaxyBudget(quality, 1200).particles);
    assert.ok(mobile.dpr <= 1.25);
    assert.equal(mobile.fps, 30);
  }
  assert.equal(galaxyBudget("auto", 1200).fps, 60);
});
