//! Loopback proxy for the WebKit app window.
//!
//! WKWebView stores the shell's session cookie (`dsh-auth-*`) but does not
//! send it on the app document's own requests (field-verified: the store lists
//! the cookie while every request still receives the 401 body, and Safari on
//! the same machine authenticates the same URL). Instead of fighting the
//! webview's cookie pipeline, the app window talks to this proxy: every
//! request (HTTP and the WebSocket upgrade) leaves with the session injected
//! as a `Cookie` header, a rewritten `Host`, and a rewritten `Origin`/
//! `Referer`, so the dsh server authenticates it exactly like a browser
//! request that carried the cookie. The webview's own cookie jar is no longer
//! involved.
//!
//! One request per client connection: non-upgrade requests are forwarded with
//! `Connection: close` so the response framing never needs parsing, and upgrade
//! requests (the WebSocket handshake) become a raw duplex pipe after the
//! injected handshake.

use std::sync::{OnceLock, RwLock};

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use crate::dsh_runner::append_startup_log;

/// Upstream target and session of the app window's proxy. Updated on every
/// readiness; connections read it once, so a restarted server on another port
/// takes effect without touching the window.
#[derive(Clone, Debug)]
pub(crate) struct Session {
    /// Loopback port of the live `dsh web` server.
    pub(crate) upstream_port: u16,
    /// `name=value` of the signed browser-session cookie.
    pub(crate) cookie: String,
}

static SESSION: RwLock<Option<Session>> = RwLock::new(None);
static PROXY_PORT: OnceLock<u16> = OnceLock::new();
static START_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Point the proxy at the live server and session. The proxy keeps its own
/// port and the app window keeps its origin, so this is all a restart needs.
pub(crate) fn session_updated(upstream_port: u16, cookie: String) {
    *SESSION.write().expect("proxy session lock") = Some(Session {
        upstream_port,
        cookie,
    });
}

/// Bind the proxy on a free loopback port (once per app run) and return it.
pub(crate) async fn ensure_started() -> Result<u16, String> {
    if let Some(port) = PROXY_PORT.get() {
        return Ok(*port);
    }
    let _guard = START_LOCK.lock().await;
    if let Some(port) = PROXY_PORT.get() {
        return Ok(*port);
    }
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("app proxy bind failed: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("app proxy address failed: {e}"))?
        .port();
    let _ = PROXY_PORT.set(port);
    tauri::async_runtime::spawn(accept_loop(listener));
    append_startup_log(&format!("app proxy listening on 127.0.0.1:{port}"));
    Ok(port)
}

async fn accept_loop(listener: TcpListener) {
    loop {
        match listener.accept().await {
            Ok((client, _peer)) => {
                tauri::async_runtime::spawn(async move {
                    if let Err(err) = serve(client).await {
                        append_startup_log(&format!("app proxy connection: {err}"));
                    }
                });
            }
            Err(err) => {
                append_startup_log(&format!("app proxy accept failed: {err}"));
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        }
    }
}

/// Read one request head, rewrite it for the upstream server, forward it with
/// the session attached, then pipe both directions until either side closes.
async fn serve(mut client: TcpStream) -> Result<(), String> {
    let session = SESSION
        .read()
        .expect("proxy session lock")
        .clone()
        .ok_or("app proxy has no session yet")?;
    let proxy_port = *PROXY_PORT.get().ok_or("app proxy is not listening")?;
    let mut buffer = Vec::with_capacity(8 * 1024);
    let mut chunk = [0u8; 4 * 1024];
    let head_len = loop {
        if let Some(len) = find_head_end(&buffer) {
            break len;
        }
        if buffer.len() > 64 * 1024 {
            return Err("request head exceeds 64 KiB".to_owned());
        }
        let read = client
            .read(&mut chunk)
            .await
            .map_err(|e| format!("client read failed: {e}"))?;
        if read == 0 {
            return Ok(());
        }
        buffer.extend_from_slice(&chunk[..read]);
    };
    let (head, rewrite) = rewrite_head(&buffer[..head_len], proxy_port, &session)
        .ok_or("malformed request head")?;
    let body = &buffer[head_len..];
    let mut upstream = TcpStream::connect(("127.0.0.1", session.upstream_port))
        .await
        .map_err(|e| format!("upstream connect failed: {e}"))?;
    upstream
        .write_all(&head)
        .await
        .map_err(|e| format!("upstream write failed: {e}"))?;
    if !body.is_empty() {
        upstream
            .write_all(body)
            .await
            .map_err(|e| format!("upstream write failed: {e}"))?;
    }
    let _ = rewrite;
    let _ = tokio::io::copy_bidirectional(&mut client, &mut upstream).await;
    Ok(())
}

/// Index just past the blank line that ends a request head.
fn find_head_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|w| w == b"\r\n\r\n").map(|at| at + 4)
}

/// Rewrite one request head for the upstream server: the `Cookie` header is
/// replaced with the session, `Host` points at the server authority the
/// session was minted for, and `Origin`/`Referer` lose the proxy origin.
/// Non-upgrade requests are made one-shot (`Connection: close`) so no request
/// framing is needed past the head. Returns the rewritten head (including the
/// terminating blank line) and whether the request upgrades.
fn rewrite_head(head: &[u8], proxy_port: u16, session: &Session) -> Option<(Vec<u8>, bool)> {
    let text = std::str::from_utf8(head).ok()?;
    let mut lines = text.split("\r\n");
    let request_line = lines.next()?;
    if !request_line.contains(" HTTP/1.") {
        return None;
    }
    let upgrade = text.to_ascii_lowercase().contains("\r\nupgrade:");
    let upstream = format!("127.0.0.1:{}", session.upstream_port);
    let proxy_origin = format!("http://localhost:{proxy_port}");
    let trusted_origin = format!("http://{upstream}");
    let mut out = String::with_capacity(text.len() + session.cookie.len() + 64);
    out.push_str(request_line);
    out.push_str("\r\n");
    for line in lines {
        if line.is_empty() {
            continue;
        }
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("host:") {
            out.push_str(&format!("Host: {upstream}\r\n"));
            continue;
        }
        if lower.starts_with("cookie:") {
            // Replaced wholesale: the webview's stale cookie jar never leaks
            // into the upstream request.
            continue;
        }
        if lower.starts_with("origin:") || lower.starts_with("referer:") {
            out.push_str(&line.replace(&proxy_origin, &trusted_origin));
            out.push_str("\r\n");
            continue;
        }
        out.push_str(line);
        out.push_str("\r\n");
    }
    out.push_str(&format!("Cookie: {}\r\n", session.cookie));
    if !upgrade {
        out.push_str("Connection: close\r\n");
    }
    out.push_str("\r\n");
    Some((out.into_bytes(), upgrade))
}

#[cfg(test)]
mod tests {
    use super::{find_head_end, rewrite_head, Session};

    fn session() -> Session {
        Session {
            upstream_port: 3081,
            cookie: "dsh-auth-abc=value".to_owned(),
        }
    }

    fn head(text: &str) -> (String, bool) {
        let (bytes, upgrade) = rewrite_head(text.as_bytes(), 40000, &session()).unwrap();
        (String::from_utf8(bytes).unwrap(), upgrade)
    }

    #[test]
    fn find_head_end_reports_just_past_the_blank_line() {
        assert_eq!(find_head_end(b"GET / HTTP/1.1\r\nA: b\r\n\r\nrest"), Some(24));
        assert_eq!(find_head_end(b"GET / HTTP/1.1\r\nA: b"), None);
    }

    #[test]
    fn rewrite_replaces_host_cookie_and_origin() {
        let (out, upgrade) = head(
            "GET /index.html HTTP/1.1\r\nHost: localhost:40000\r\nCookie: stale=1; other=2\r\nOrigin: http://localhost:40000\r\nReferer: http://localhost:40000/index.html\r\nAccept: */*\r\n\r\n",
        );
        assert!(!upgrade);
        assert!(out.starts_with("GET /index.html HTTP/1.1\r\n"));
        assert!(out.contains("Host: 127.0.0.1:3081\r\n"));
        assert!(!out.contains("stale=1"));
        assert!(!out.contains("other=2"));
        assert_eq!(out.matches("Cookie: ").count(), 1);
        assert!(out.contains("Cookie: dsh-auth-abc=value\r\n"));
        assert!(out.contains("Origin: http://127.0.0.1:3081\r\n"));
        assert!(out.contains("Referer: http://127.0.0.1:3081/index.html\r\n"));
        assert!(out.contains("Accept: */*\r\n"));
        assert!(out.ends_with("Connection: close\r\n\r\n"));
    }

    #[test]
    fn rewrite_keeps_upgrade_connections_open() {
        let (out, upgrade) = head(
            "GET /api/remote.mux HTTP/1.1\r\nHost: localhost:40000\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: x\r\n\r\n",
        );
        assert!(upgrade);
        assert!(!out.contains("Connection: close"));
        assert!(out.contains("Cookie: dsh-auth-abc=value\r\n"));
        assert!(out.contains("Host: 127.0.0.1:3081\r\n"));
    }

    #[test]
    fn rewrite_rejects_non_http_heads() {
        assert!(rewrite_head(b"not a request\r\n\r\n", 40000, &session()).is_none());
        assert!(rewrite_head(&[0xff, 0x00, 0x0d], 40000, &session()).is_none());
    }
}
