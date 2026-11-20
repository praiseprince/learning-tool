// Marginalia for the Mac. It carries its own server and Node.js runtime, keeps your data in
// ~/Library/Application Support/Marginalia, uses your installed Claude Code, Codex and cloudflared, and keeps running
// when the window is closed. The menu-bar icon switches the Tunnel and sets the PIN.
// Quitting stops the server and everything it started (tunnel, Firecrawl); if this app dies, the server notices and stops.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{create_dir_all, OpenOptions};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry};

/// The port: 3000, or MARGINALIA_PORT. Shown in strings as `{PORT}`.
#[derive(Clone, Copy)]
struct Port;
impl Port { fn get(self) -> u16 { static P: std::sync::OnceLock<u16> = std::sync::OnceLock::new(); *P.get_or_init(|| std::env::var("MARGINALIA_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3000)) } }
impl std::fmt::Display for Port { fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result { write!(f, "{}", self.get()) } }
const PORT: Port = Port;
const CONTROL_HEADER: &str = "x-marginalia-control";

struct Server {
    child: Mutex<Option<Child>>,
    token: String,
}

struct Tray {
    tunnel: CheckMenuItem<Wry>,
    copy: MenuItem<Wry>,
    url: Mutex<Option<String>>,
}

fn home() -> PathBuf { PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())) }

/// Where your data lives: ~/Library/Application Support/Marginalia (MARGINALIA_DATA overrides, for tests).
fn data_dir() -> PathBuf {
    std::env::var("MARGINALIA_DATA").map(PathBuf::from).unwrap_or_else(|_| home().join("Library/Application Support/Marginalia"))
}

/// PATH as your login shell has it, so the server finds claude, codex and cloudflared like Terminal does.
fn login_path() -> String {
    let fallback = format!("{}/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin", home().display());
    let out = Command::new("/bin/zsh").args(["-lc", "printf %s \"$PATH\""]).stdin(Stdio::null()).stderr(Stdio::null()).output();
    match out { Ok(o) if o.status.success() && !o.stdout.is_empty() => format!("{}:{fallback}", String::from_utf8_lossy(&o.stdout)), _ => fallback }
}

fn log_path() -> PathBuf {
    let dir = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())).join("Library/Logs/Marginalia");
    let _ = create_dir_all(&dir);
    dir.join("server.log")
}

/// A random token for the menu bar to talk to its own server (32 bytes from the system's random source).
fn random_token() -> String {
    let mut buf = [0u8; 32];
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        let _ = f.read_exact(&mut buf);
    } else {
        let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        for (i, b) in buf.iter_mut().enumerate() { *b = (t >> (i % 16 * 8)) as u8 ^ (std::process::id() as u8).wrapping_mul(i as u8 + 1); }
    }
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

fn addr() -> SocketAddr { SocketAddr::from(([127, 0, 0, 1], PORT.get())) }
fn port_in_use() -> bool { TcpStream::connect_timeout(&addr(), Duration::from_millis(300)).is_ok() }

/// A tiny HTTP/1.1 request to the local server; returns (status, body).
fn http(method: &str, path: &str, token: Option<&str>) -> Option<(u16, String)> { http_body(method, path, token, "") }
fn http_body(method: &str, path: &str, token: Option<&str>, body: &str) -> Option<(u16, String)> {
    let mut s = TcpStream::connect_timeout(&addr(), Duration::from_secs(2)).ok()?;
    s.set_read_timeout(Some(Duration::from_secs(8))).ok()?;
    let auth = token.map(|t| format!("{CONTROL_HEADER}: {t}\r\n")).unwrap_or_default();
    write!(s, "{method} {path} HTTP/1.1\r\nHost: localhost:{PORT}\r\nAccept: application/json\r\nContent-Type: application/json\r\n{auth}Content-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).ok()?;
    let mut out = String::new();
    s.read_to_string(&mut out).ok()?;
    let status = out.split_whitespace().nth(1)?.parse().ok()?;
    let body = out.split_once("\r\n\r\n").map(|(_, b)| b.to_string()).unwrap_or_default();
    Some((status, body))
}

/// The first JSON object in a body (handles chunked responses well enough for these small replies).
fn json(body: &str) -> Option<serde_json::Value> {
    let (a, b) = (body.find('{')?, body.rfind('}')?);
    serde_json::from_str(&body[a..=b]).ok()
}


/// Starts the bundled server with the bundled Node.js, in its own process group so quitting can stop everything it
/// started. Data goes to data_dir(). A debug build without a bundle runs from the project folder instead.
fn start_server(app: &AppHandle, token: &str) -> Result<Child, String> {
    let res = app.path().resource_dir().map_err(|e| e.to_string())?;
    let (server, node) = (res.join("server"), res.join("node/bin/node"));
    let data = data_dir();
    create_dir_all(data.join("workspace")).map_err(|e| format!("Could not create {}: {e}", data.display()))?;
    let log = OpenOptions::new().create(true).append(true).open(log_path()).map_err(|e| e.to_string())?;
    let err = log.try_clone().map_err(|e| e.to_string())?;
    let mut cmd = if server.join("server.js").exists() && node.exists() {
        let mut c = Command::new(&node);
        c.arg("server.js").current_dir(&server)
            .env("FIRECRAWL_LOCAL_BIN", server.join(".tools/bin/firecrawl-local"))
            .env("HOSTNAME", "0.0.0.0").env("NODE_ENV", "production");
        c
    } else {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        if !dir.join("package.json").exists() { return Err(format!("The app's server is missing from {}. Reinstall Marginalia.", res.display())); }
        let mut c = Command::new("/bin/zsh");
        c.args(["-lc", &format!("exec node scripts/local.mjs --prod --port {PORT}")]).current_dir(dir);
        c
    };
    let set = |k: &str, v: String| std::env::var(k).unwrap_or(v);
    cmd.env("PATH", login_path())
        .env("PORT", PORT.to_string())
        .env("MARGINALIA_V2", "1")
        .env("DATABASE_URL", set("DATABASE_URL", data.join("app.db").to_string_lossy().into()))
        .env("MARGINALIA_WORKSPACES", set("MARGINALIA_WORKSPACES", data.join("workspace").to_string_lossy().into()))
        .env("FIRECRAWL_HOME", data.join("firecrawl-home"))
        .env("MARGINALIA_PARENT_PID", std::process::id().to_string())
        .env("MARGINALIA_CONTROL_TOKEN", token)
        .stdin(Stdio::null()).stdout(log).stderr(err)
        .process_group(0)
        .spawn()
        .map_err(|e| format!("Could not start the server: {e}"))
}

/// A native prompt (AppleScript), hidden when it is a PIN. None when cancelled.
fn ask(question: &str, hidden: bool) -> Option<String> {
    let script = format!("display dialog {} default answer \"\" {}with title \"Marginalia\" buttons {{\"Cancel\", \"OK\"}} default button \"OK\"",
        serde_json::Value::String(question.into()), if hidden { "with hidden answer " } else { "" });
    let out = Command::new("/usr/bin/osascript").args(["-e", &script]).output().ok()?;
    if !out.status.success() { return None; }
    String::from_utf8_lossy(&out.stdout).split("text returned:").nth(1).map(|t| t.trim().to_string())
}
fn tell(message: &str) {
    let _ = Command::new("/usr/bin/osascript").args(["-e", &format!("display alert \"Marginalia\" message {}", serde_json::Value::String(message.into()))]).spawn();
}

/// Asks for a new PIN twice and saves it (only as a hash, on the server).
fn set_pin(app: &AppHandle, first: bool) {
    let app = app.clone();
    thread::spawn(move || {
        let intro = if first { "Choose a PIN (4 to 12 digits). Every phone, iPad or browser needs it once to sign in." } else { "New PIN (4 to 12 digits). Devices already signed in stay signed in." };
        let Some(pin) = ask(intro, true) else { return };
        if !(4..=12).contains(&pin.len()) || !pin.chars().all(|c| c.is_ascii_digit()) { tell("Use 4 to 12 digits. The PIN was not changed."); return; }
        let Some(again) = ask("Type the PIN again.", true) else { return };
        if again != pin { tell("The two PINs differ. The PIN was not changed."); return; }
        let Some(server) = app.try_state::<Server>() else { return };
        match http_body("POST", "/api/control/pin", Some(&server.token), &serde_json::json!({"pin": pin}).to_string()) {
            Some((200, _)) => tell("PIN saved."),
            _ => tell("The PIN could not be saved. Is Marginalia still starting?"),
        }
    });
}

/// Stops the server's whole process group: politely, then for sure.
fn stop_server(app: &AppHandle) {
    let Some(state) = app.try_state::<Server>() else { return };
    let Some(mut child) = state.child.lock().unwrap().take() else { return };
    let pgid = child.id() as i32;
    unsafe { libc::killpg(pgid, libc::SIGTERM); }
    let until = Instant::now() + Duration::from_secs(4);
    while Instant::now() < until {
        if let Ok(Some(_)) = child.try_wait() { break; }
        thread::sleep(Duration::from_millis(100));
    }
    unsafe { libc::killpg(pgid, libc::SIGKILL); }
    let _ = child.wait();
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> { app.get_webview_window("main") }

fn show(app: &AppHandle, path: Option<&str>) {
    if let Some(w) = main_window(app) {
        if let Some(p) = path {
            if let Ok(u) = format!("http://localhost:{PORT}{p}").parse() { let _ = w.navigate(u); }
        }
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn eval(app: &AppHandle, js: String) { if let Some(w) = main_window(app) { let _ = w.eval(&js); } }
fn say(app: &AppHandle, f: &str, text: &str) { eval(app, format!("window.{f} && window.{f}({})", serde_json::Value::String(text.into()))); }

/// Waits for the server to answer, then opens it in the window. Building first can take a couple of minutes.
fn wait_and_open(app: AppHandle) {
    thread::spawn(move || {
        let start = Instant::now();
        loop {
            if let Some((code, _)) = http("GET", "/login", None) {
                if code < 500 {
                    if let Some(w) = main_window(&app) {
                        if let Ok(u) = format!("http://localhost:{PORT}/").parse() { let _ = w.navigate(u); }
                    }
                    let token = app.try_state::<Server>().map(|s| s.token.clone()).unwrap_or_default();
                    if let Some((200, body)) = http("GET", "/api/control/pin", Some(&token)) {
                        if json(&body).and_then(|v| v["hasPin"].as_bool()) == Some(false) { set_pin(&app, true); }
                    }
                    return;
                }
            }
            let exited = app.try_state::<Server>().map(|s| matches!(s.child.lock().unwrap().as_mut().map(|c| c.try_wait()), Some(Ok(Some(_))))).unwrap_or(false);
            if exited {
                say(&app, "mgError", &format!("The server stopped while starting. Details are in\n{}", log_path().display()));
                return;
            }
            let secs = start.elapsed().as_secs();
            if secs > 600 {
                say(&app, "mgError", &format!("The server did not start within 10 minutes. Details are in\n{}", log_path().display()));
                return;
            }
            if secs > 8 { say(&app, "mgStatus", "Preparing the app (the first start can take a minute or two)"); }
            thread::sleep(Duration::from_millis(500));
        }
    });
}

/// Keeps the menu-bar Tunnel item in step with the server (it can also be switched from Settings).
fn watch_tunnel(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(2));
        let (Some(server), Some(tray)) = (app.try_state::<Server>(), app.try_state::<Tray>()) else { continue };
        let Some((200, body)) = http("GET", "/api/control/tunnel", Some(&server.token)) else { continue };
        let Some(v) = json(&body) else { continue };
        let status = v["status"].as_str().unwrap_or("off").to_string();
        let url = v["url"].as_str().map(String::from);
        let label = match status.as_str() { "on" => "Tunnel: On", "starting" => "Tunnel: Starting…", "failed" => "Tunnel: Failed (try again)", _ => "Tunnel" };
        let _ = tray.tunnel.set_text(label);
        let _ = tray.tunnel.set_checked(status == "on" || status == "starting");
        let _ = tray.copy.set_enabled(url.is_some());
        *tray.url.lock().unwrap() = url;
    });
}

fn set_tunnel(app: &AppHandle, on: bool) {
    let app = app.clone();
    thread::spawn(move || {
        let Some(server) = app.try_state::<Server>() else { return };
        let _ = http("POST", if on { "/api/control/tunnel?on=1" } else { "/api/control/tunnel?on=0" }, Some(&server.token));
    });
}

fn copy_text(text: &str) {
    if let Ok(mut c) = Command::new("/usr/bin/pbcopy").stdin(Stdio::piped()).spawn() {
        if let Some(mut i) = c.stdin.take() { let _ = i.write_all(text.as_bytes()); }
        let _ = c.wait();
    }
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Marginalia")
                .inner_size(1280.0, 860.0)
                .min_inner_size(380.0, 560.0)
                .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15 Marginalia/0.1")
                .build()?;

            // a fixed token can be given for tests; otherwise a new random one each launch
            let token = std::env::var("MARGINALIA_CONTROL_TOKEN").ok().filter(|t| t.len() >= 32).unwrap_or_else(random_token);
            if port_in_use() {
                app.manage(Server { child: Mutex::new(None), token });
                let h = handle.clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_millis(600));
                    say(&h, "mgError", &format!("Port {PORT} is already in use, probably by Marginalia started from Terminal.\nStop that one, then open this app again."));
                });
            } else {
                match start_server(&handle, &token) {
                    Ok(child) => { app.manage(Server { child: Mutex::new(Some(child)), token }); wait_and_open(handle.clone()); }
                    Err(e) => {
                        app.manage(Server { child: Mutex::new(None), token });
                        let h = handle.clone();
                        thread::spawn(move || { thread::sleep(Duration::from_millis(600)); say(&h, "mgError", &e); });
                    }
                }
            }

            let open = MenuItem::with_id(app, "open", "Open Marginalia", true, None::<&str>)?;
            let tunnel = CheckMenuItem::with_id(app, "tunnel", "Tunnel", true, false, None::<&str>)?;
            let copy = MenuItem::with_id(app, "copy", "Copy Tunnel Address", false, None::<&str>)?;
            let phone = MenuItem::with_id(app, "phone", "Phone and iPad…", true, None::<&str>)?;
            let pin = MenuItem::with_id(app, "pin", "Set PIN…", true, None::<&str>)?;
            let unlock = MenuItem::with_id(app, "unlock", "Unlock Sign-in", true, None::<&str>)?;
            let data = MenuItem::with_id(app, "data", "Show Data Folder", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Marginalia", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &tunnel, &copy, &phone, &PredefinedMenuItem::separator(app)?, &pin, &unlock, &data, &PredefinedMenuItem::separator(app)?, &quit])?;
            app.manage(Tray { tunnel, copy, url: Mutex::new(None) });

            TrayIconBuilder::with_id("marginalia")
                .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true)
                .tooltip("Marginalia")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show(app, None),
                    "phone" => show(app, Some("/you#phone")),
                    "tunnel" => {
                        let on = app.try_state::<Tray>().map(|t| t.tunnel.is_checked().unwrap_or(false)).unwrap_or(false);
                        set_tunnel(app, on);
                    }
                    "copy" => { if let Some(u) = app.try_state::<Tray>().and_then(|t| t.url.lock().unwrap().clone()) { copy_text(&u); } }
                    "pin" => set_pin(app, false),
                    "unlock" => {
                        let app = app.clone();
                        thread::spawn(move || {
                            let ok = app.try_state::<Server>().and_then(|s| http("POST", "/api/control/unlock", Some(&s.token))).map(|r| r.0 == 200).unwrap_or(false);
                            tell(if ok { "Sign-in is unlocked. Wrong PINs start counting again from zero." } else { "Could not reach the server." });
                        });
                    }
                    "data" => { let _ = Command::new("/usr/bin/open").arg(data_dir()).spawn(); }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            watch_tunnel(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window keeps Marginalia running; the Dock icon or the menu bar brings it back.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("Marginalia could not start");

    app.run(|app, event| match event {
        RunEvent::Reopen { .. } => show(app, None),
        RunEvent::Exit => stop_server(app),
        _ => {}
    });
}
