import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const apiDir = join(root, "src", "app", "api");
const disabledApiDir = join(root, "src", "app", "__api_native_disabled__");
const hadApiRoutes = existsSync(apiDir);

if (existsSync(disabledApiDir)) {
  throw new Error(
    "Existe un directorio temporal de un build nativo anterior: " +
      disabledApiDir,
  );
}

try {
  if (hadApiRoutes) renameSync(apiDir, disabledApiDir);

  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXUS_NATIVE: "true",
    },
  });

  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error("El export estático de NEXUS terminó con error.");
} finally {
  if (hadApiRoutes && existsSync(disabledApiDir)) {
    renameSync(disabledApiDir, apiDir);
  }
}
