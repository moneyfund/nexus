import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseSqlReads,
  nexusDataModeInfo,
  parseNexusDataMode,
  shouldShadowSqlWrites,
} from "../src/config/data-backend";

test("data backend defaults safely to Firestore", () => {
  assert.equal(parseNexusDataMode(undefined), "firestore");
  assert.equal(parseNexusDataMode("garbage"), "firestore");
  const info = nexusDataModeInfo("firestore");
  assert.equal(info.primaryRead, "firestore");
  assert.equal(info.primaryWrite, "firestore");
});

test("shadow mode never makes PostgreSQL authoritative", () => {
  const info = nexusDataModeInfo("shadow-sql");
  assert.equal(info.primaryRead, "firestore");
  assert.equal(info.primaryWrite, "firestore");
  assert.equal(info.shadowWrite, "sql");
  assert.equal(shouldShadowSqlWrites("shadow-sql"), true);
  assert.equal(canUseSqlReads("shadow-sql"), false);
});

test("SQL cutover modes are explicit", () => {
  assert.equal(canUseSqlReads("sql-read"), true);
  assert.equal(canUseSqlReads("sql"), true);
  assert.equal(nexusDataModeInfo("sql").primaryWrite, "sql");
});
