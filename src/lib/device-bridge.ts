export type DeviceRuntime = "web" | "native";

export type DeviceCapability =
  | "device_status"
  | "system_snapshot"
  | "open_app"
  | "set_volume"
  | "adjust_volume"
  | "toggle_mute"
  | "take_screenshot"
  | "lock_device";

export type KnownDesktopApp =
  | "notepad"
  | "calculator"
  | "files"
  | "settings"
  | "terminal";

export type AIAllowedDesktopApp = Exclude<KnownDesktopApp, "terminal">;

export interface DeviceStatus {
  connected: boolean;
  runtime: DeviceRuntime;
  platform: string;
  arch: string;
  deviceName: string;
  appVersion: string;
  capabilities: DeviceCapability[];
}

export interface DeviceSystemSnapshot {
  batteryPercent: number | null;
  networkConnected: boolean;
}

type NativeDeviceStatus = Omit<DeviceStatus, "connected" | "runtime">;

function hasTauriRuntime() {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

async function nativeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!hasTauriRuntime())
    throw new Error(
      "Esta acción requiere NEXUS Companion Desktop. La PWA no tiene permisos nativos del sistema.",
    );

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) throw new Error("El volumen indicado no es válido.");
  return Math.max(0, Math.min(100, Math.round(value)));
}

export const deviceBridge = {
  isNativeRuntime: hasTauriRuntime,

  async status(): Promise<DeviceStatus> {
    if (!hasTauriRuntime()) {
      return {
        connected: false,
        runtime: "web",
        platform:
          typeof navigator === "undefined" ? "unknown" : navigator.platform,
        arch: "browser",
        deviceName: "Navegador",
        appVersion: "PWA",
        capabilities: [],
      };
    }

    const native = await nativeInvoke<NativeDeviceStatus>("device_status");
    return {
      ...native,
      connected: true,
      runtime: "native",
    };
  },

  async systemSnapshot(): Promise<DeviceSystemSnapshot> {
    if (!hasTauriRuntime())
      return { batteryPercent: null, networkConnected: false };
    return nativeInvoke<DeviceSystemSnapshot>("system_snapshot");
  },

  async openApp(app: KnownDesktopApp) {
    return nativeInvoke<void>("open_app", { app });
  },

  async setVolume(value: number) {
    return nativeInvoke<number>("set_volume", { value: clampVolume(value) });
  },

  async adjustVolume(delta: number) {
    if (!Number.isFinite(delta) || delta === 0)
      throw new Error("Indica cuánto debe cambiar el volumen.");
    const normalized = Math.max(-100, Math.min(100, Math.round(delta)));
    return nativeInvoke<number>("adjust_volume", { delta: normalized });
  },

  async toggleMute() {
    return nativeInvoke<void>("toggle_mute");
  },

  async takeScreenshot() {
    return nativeInvoke<string>("take_screenshot");
  },

  async lockDevice() {
    return nativeInvoke<void>("lock_device");
  },
};
