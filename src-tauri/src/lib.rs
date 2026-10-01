use serde::Serialize;
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdaterRuntimeStatus {
    configured: bool,
    current_version: String,
    channel: String,
    endpoint: String,
}

#[tauri::command]
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
            "open_app".to_string(),
            "lock_device".to_string(),
        ],
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
        Err("Esta primera versión de NEXUS Device está habilitada para Windows.".to_string())
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
        Err("Esta primera versión de NEXUS Device está habilitada para Windows.".to_string())
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
            updater_runtime_status,
            open_app,
            lock_device
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running NEXUS Companion");
}
