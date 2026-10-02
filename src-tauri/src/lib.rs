use serde::{Deserialize, Serialize};
use std::{env, process::Command};

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

fn run_volume_script(body: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            r#"
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NexusAudio {{
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public static void Press(byte vk) {{
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
  }}
}}
'@
{}
"#,
            body
        );

        let status = Command::new("powershell.exe")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .status()
            .map_err(|error| format!("Windows no pudo controlar el audio: {error}"))?;

        if status.success() {
            Ok(())
        } else {
            Err("Windows rechazó el control de audio.".to_string())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = body;
        Err("El control de audio de esta beta está habilitado para Windows.".to_string())
    }
}

#[tauri::command]
fn set_volume(value: u8) -> Result<u8, String> {
    let target = value.min(100);
    let up_presses = ((target as u16 + 1) / 2) as usize;
    let body = format!(
        "1..60 | ForEach-Object {{ [NexusAudio]::Press(0xAE) }}\n1..{} | ForEach-Object {{ [NexusAudio]::Press(0xAF) }}",
        up_presses.max(1)
    );

    if target == 0 {
        run_volume_script("1..60 | ForEach-Object { [NexusAudio]::Press(0xAE) }")?;
    } else {
        run_volume_script(&body)?;
    }

    Ok(target)
}

#[tauri::command]
fn adjust_volume(delta: i8) -> Result<i8, String> {
    if delta == 0 {
        return Ok(0);
    }

    let steps = ((delta.unsigned_abs() as u16 + 1) / 2).max(1);
    let vk = if delta > 0 { "0xAF" } else { "0xAE" };
    let body = format!(
        "1..{} | ForEach-Object {{ [NexusAudio]::Press({}) }}",
        steps, vk
    );
    run_volume_script(&body)?;
    Ok(delta)
}

#[tauri::command]
fn toggle_mute() -> Result<(), String> {
    run_volume_script("[NexusAudio]::Press(0xAD)")
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
        Command::new("rundll32.exe")
            .arg("user32.dll,LockWorkStation")
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Windows no pudo bloquear el equipo: {error}"))
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
