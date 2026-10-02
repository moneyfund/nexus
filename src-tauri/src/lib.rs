use serde::{Deserialize, Serialize};
use std::{env, process::Command};

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn keybd_event(b_vk: u8, b_scan: u8, dw_flags: u32, dw_extra_info: usize);
    fn LockWorkStation() -> i32;
}

#[cfg(target_os = "windows")]
const KEYEVENTF_KEYUP: u32 = 0x0002;
#[cfg(target_os = "windows")]
const VK_VOLUME_MUTE: u8 = 0xAD;
#[cfg(target_os = "windows")]
const VK_VOLUME_DOWN: u8 = 0xAE;
#[cfg(target_os = "windows")]
const VK_VOLUME_UP: u8 = 0xAF;

#[cfg(target_os = "windows")]
fn press_media_key(vk: u8) {
    unsafe {
        keybd_event(vk, 0, 0, 0);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceStatus {
    platform: String,
    arch: String,
    device_name: String,
    app_version: String,
    capabilities: Vec<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SystemSnapshot {
    battery_percent: Option<u8>,
    network_connected: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdaterRuntimeStatus {
    configured: bool,
    current_version: String,
    channel: String,
    endpoint: String,
}

#[tauri::command]
fn updater_runtime_status() -> UpdaterRuntimeStatus {
    let configured = option_env!("NEXUS_UPDATER_PUBKEY")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);

    UpdaterRuntimeStatus {
        configured,
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        channel: "beta".to_string(),
        endpoint: "GitHub Releases".to_string(),
    }
}

#[tauri::command]
fn device_status() -> DeviceStatus {
    let device_name = env::var("COMPUTERNAME")
        .or_else(|_| env::var("HOSTNAME"))
        .unwrap_or_else(|_| "NEXUS Device".to_string());

    DeviceStatus {
        platform: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        device_name,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        capabilities: vec![
            "device_status".to_string(),
            "system_snapshot".to_string(),
            "open_app".to_string(),
            "set_volume".to_string(),
            "adjust_volume".to_string(),
            "toggle_mute".to_string(),
            "take_screenshot".to_string(),
            "lock_device".to_string(),
        ],
    }
}

#[tauri::command]
fn system_snapshot() -> Result<SystemSnapshot, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
$up = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1
[pscustomobject]@{
  batteryPercent = if ($null -eq $b) { $null } else { [int]$b.EstimatedChargeRemaining }
  networkConnected = [bool]($null -ne $up)
} | ConvertTo-Json -Compress
"#;

        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", script])
            .output()
            .map_err(|error| format!("Windows no pudo consultar el estado del sistema: {error}"))?;

        if !output.status.success() {
            return Err("Windows no pudo consultar batería y red.".to_string());
        }

        serde_json::from_slice::<SystemSnapshot>(&output.stdout)
            .map_err(|error| format!("NEXUS no pudo interpretar el estado del sistema: {error}"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("NEXUS Device Stage 02 está habilitado para Windows.".to_string())
    }
}

#[tauri::command]
fn open_app(app: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let child = match app.as_str() {
            "notepad" => Command::new("notepad.exe").spawn(),
            "calculator" => Command::new("calc.exe").spawn(),
            "files" => Command::new("explorer.exe").spawn(),
            "settings" => Command::new("cmd.exe")
                .args(["/C", "start", "", "ms-settings:"])
                .spawn(),
            "terminal" => Command::new("cmd.exe").spawn(),
            _ => return Err("Aplicación no autorizada por NEXUS Device.".to_string()),
        };

        child
            .map(|_| ())
            .map_err(|error| format!("Windows no pudo abrir la aplicación: {error}"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("NEXUS Device Stage 02 está habilitado para Windows.".to_string())
    }
}

#[tauri::command]
fn set_volume(value: u8) -> Result<u8, String> {
    #[cfg(target_os = "windows")]
    {
        let target = value.min(100);

        // Windows' media keys usually move the master volume in ~2% steps.
        // Driving user32 directly avoids starting PowerShell for every command.
        for _ in 0..52 {
            press_media_key(VK_VOLUME_DOWN);
        }

        let up_presses = ((target as u16 + 1) / 2) as usize;
        for _ in 0..up_presses {
            press_media_key(VK_VOLUME_UP);
        }

        Ok(target)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = value;
        Err("El control de audio de esta beta está habilitado para Windows.".to_string())
    }
}

#[tauri::command]
fn adjust_volume(delta: i8) -> Result<i8, String> {
    #[cfg(target_os = "windows")]
    {
        if delta == 0 {
            return Ok(0);
        }

        let steps = ((delta.unsigned_abs() as u16 + 1) / 2).max(1);
        let key = if delta > 0 {
            VK_VOLUME_UP
        } else {
            VK_VOLUME_DOWN
        };

        for _ in 0..steps {
            press_media_key(key);
        }

        Ok(delta)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = delta;
        Err("El control de audio de esta beta está habilitado para Windows.".to_string())
    }
}

#[tauri::command]
fn toggle_mute() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        press_media_key(VK_VOLUME_MUTE);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("El control de audio de esta beta está habilitado para Windows.".to_string())
    }
}

#[tauri::command]
fn take_screenshot() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)
  $dir = Join-Path ([Environment]::GetFolderPath('MyPictures')) 'NEXUS'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $path = Join-Path $dir ("NEXUS-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.png')
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $path
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
"#;

        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", script])
            .output()
            .map_err(|error| format!("Windows no pudo capturar la pantalla: {error}"))?;

        if !output.status.success() {
            return Err("Windows rechazó la captura de pantalla.".to_string());
        }

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Err("La captura se creó, pero Windows no devolvió su ubicación.".to_string())
        } else {
            Ok(path)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("La captura de pantalla de esta beta está habilitada para Windows.".to_string())
    }
}

#[tauri::command]
fn lock_device() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let result = unsafe { LockWorkStation() };
        if result != 0 {
            Ok(())
        } else {
            Err("Windows no pudo bloquear el equipo.".to_string())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("NEXUS Device Stage 02 está habilitado para Windows.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            if let Some(pubkey) = option_env!("NEXUS_UPDATER_PUBKEY")
                .filter(|value| !value.trim().is_empty())
            {
                app.handle().plugin(
                    tauri_plugin_updater::Builder::new()
                        .pubkey(pubkey)
                        .build(),
                )?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            device_status,
            system_snapshot,
            updater_runtime_status,
            open_app,
            set_volume,
            adjust_volume,
            toggle_mute,
            take_screenshot,
            lock_device
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running NEXUS Companion");
}
