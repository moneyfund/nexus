export type DeviceRuntime = "web" | "native";

export type DeviceCapability =
  | "device_status"
  | "open_app"
  | "lock_device";

export type KnownDesktopApp =
  | "notepad"
  | "calculator"
  | "files"
  | "settings"
  | "terminal";

export interface DeviceStatus {
  connected: boolean;
  runtime: DeviceRuntime;
  platform: string;
  arch: string;
  deviceName: string;
  appVersion: string;
  capabilities: DeviceCapability[];
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

  async openApp(app: KnownDesktopApp) {
    return nativeInvoke<void>("open_app", { app });
  },

  async lockDevice() {
    return nativeInvoke<void>("lock_device");
  },
};
