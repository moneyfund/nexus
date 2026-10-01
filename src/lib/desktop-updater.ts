import { deviceBridge } from "@/lib/device-bridge";

export interface DesktopUpdaterRuntimeStatus {
  configured: boolean;
  currentVersion: string;
  channel: string;
  endpoint: string;
}

export interface DesktopUpdateInfo {
  version: string;
  currentVersion: string;
  notes: string;
  date: string | null;
}

export type DesktopUpdateProgress =
  | { stage: "started"; totalBytes: number | null }
  | { stage: "progress"; downloadedBytes: number; totalBytes: number | null }
  | { stage: "finished"; totalBytes: number | null };

async function invokeNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!deviceBridge.isNativeRuntime())
    throw new Error("Las actualizaciones automáticas solo están disponibles en NEXUS Companion.");

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export const desktopUpdater = {
  async runtimeStatus(): Promise<DesktopUpdaterRuntimeStatus> {
    if (!deviceBridge.isNativeRuntime()) {
      return {
        configured: false,
        currentVersion: "PWA",
        channel: "web",
        endpoint: "GitHub Pages",
      };
    }

    return invokeNative<DesktopUpdaterRuntimeStatus>("updater_runtime_status");
  },

  async check(): Promise<DesktopUpdateInfo | null> {
    const runtime = await this.runtimeStatus();
    if (!runtime.configured) return null;

    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check({ timeout: 15_000 });
    if (!update) return null;

    return {
      version: update.version,
      currentVersion: runtime.currentVersion,
      notes: update.body ?? "",
      date: update.date ?? null,
    };
  },

  async installLatest(
    onProgress?: (progress: DesktopUpdateProgress) => void,
  ): Promise<void> {
    const runtime = await this.runtimeStatus();
    if (!runtime.configured)
      throw new Error(
        "Este build de NEXUS Companion todavía no tiene firma de actualizaciones configurada.",
      );

    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check({ timeout: 15_000 });
    if (!update)
      throw new Error("No hay una actualización nueva disponible.");

    let downloadedBytes = 0;
    let totalBytes: number | null = null;

    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        totalBytes = event.data.contentLength ?? null;
        onProgress?.({ stage: "started", totalBytes });
      } else if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        onProgress?.({
          stage: "progress",
          downloadedBytes,
          totalBytes,
        });
      } else if (event.event === "Finished") {
        onProgress?.({ stage: "finished", totalBytes });
      }
    });

    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  },
};
