use std::process::{Command, Child};
use tauri::Manager;

fn get_dashboard_url() -> String {
    std::env::var("DASHBOARD_URL").unwrap_or_else(|_| "https://desktop-6acpbav.tailcf1d70.ts.net".to_string())
}

fn start_server() -> Option<Child> {
    let server_path = std::env::current_dir()
        .ok()?
        .join("dashboard")
        .join("api")
        .join("index.js");

    if !server_path.exists() {
        eprintln!("Server not found at: {:?}", server_path);
        return None;
    }

    let child = Command::new("node")
        .arg(&server_path)
        .env("DASHBOARD_PORT", "3001")
        .spawn()
        .ok()?;

    Some(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let standalone = std::env::args().any(|a| a == "--standalone");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();

            if standalone {
                if let Some(_child) = start_server() {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
            }

            let url = get_dashboard_url();
            let _ = window.navigate(url.parse().unwrap());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
