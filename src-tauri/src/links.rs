use std::time::Duration;

use futures_util::{stream, StreamExt};
use serde::Serialize;

const TIMEOUT: Duration = Duration::from_secs(8);
const MAX_PARALLEL: usize = 6;
const USER_AGENT: &str = concat!(
    "SlideReady/",
    env!("CARGO_PKG_VERSION"),
    " (link check; +https://github.com/yanmfs/slideready)"
);

#[derive(Debug, thiserror::Error)]
pub enum LinkError {
    #[error("could not start the HTTP client: {0}")]
    Client(#[from] reqwest::Error),
}

impl Serialize for LinkError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Failure {
    Dns,
    Timeout,
    Other,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct LinkProbe {
    pub url: String,
    pub status: Option<u16>,
    pub failure: Option<Failure>,
}

fn classify(err: &reqwest::Error) -> Failure {
    if err.is_timeout() {
        return Failure::Timeout;
    }
    let mut source: Option<&dyn std::error::Error> = Some(err);
    while let Some(e) = source {
        let text = e.to_string().to_lowercase();
        if text.contains("dns error")
            || text.contains("failed to lookup")
            || text.contains("nodename nor servname")
            || text.contains("name or service not known")
        {
            return Failure::Dns;
        }
        source = e.source();
    }
    Failure::Other
}

fn outcome(url: String, result: Result<reqwest::Response, reqwest::Error>) -> LinkProbe {
    match result {
        Ok(response) => LinkProbe {
            url,
            status: Some(response.status().as_u16()),
            failure: None,
        },
        Err(err) => LinkProbe {
            url,
            status: None,
            failure: Some(classify(&err)),
        },
    }
}

// Many servers reject HEAD, so a failed or refused HEAD is retried once as GET. Only headers are read.
async fn probe(client: &reqwest::Client, url: String) -> LinkProbe {
    let allowed = reqwest::Url::parse(&url)
        .map(|u| matches!(u.scheme(), "http" | "https"))
        .unwrap_or(false);
    if !allowed {
        return LinkProbe {
            url,
            status: None,
            failure: Some(Failure::Other),
        };
    }
    let head = client.head(&url).send().await;
    let retry = match &head {
        Ok(response) => response.status().as_u16() >= 400,
        Err(err) => classify(err) == Failure::Other,
    };
    if !retry {
        return outcome(url, head);
    }
    let get = client.get(&url).send().await;
    outcome(url, get)
}

pub async fn check(urls: Vec<String>) -> Result<Vec<LinkProbe>, LinkError> {
    let client = reqwest::Client::builder()
        .timeout(TIMEOUT)
        .user_agent(USER_AGENT)
        .build()?;
    let probes = stream::iter(urls)
        .map(|url| {
            let client = client.clone();
            async move { probe(&client, url).await }
        })
        .buffer_unordered(MAX_PARALLEL)
        .collect()
        .await;
    Ok(probes)
}

// Opt-in from the UI: the only command that uses the network.
#[tauri::command]
pub async fn check_links(urls: Vec<String>) -> Result<Vec<LinkProbe>, LinkError> {
    check(urls).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    // Answers by method and path: HEAD /no-head is refused, everything under /gone is 404.
    fn serve() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                let mut buf = [0u8; 1024];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]).to_string();
                let line = request.lines().next().unwrap_or("");
                let status = if line.contains("/gone") {
                    "404 Not Found"
                } else if line.starts_with("HEAD") && line.contains("/no-head") {
                    "405 Method Not Allowed"
                } else {
                    "200 OK"
                };
                let _ = write!(
                    stream,
                    "HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                );
            }
        });
        format!("http://{addr}")
    }

    fn run(urls: Vec<String>) -> Vec<LinkProbe> {
        let mut probes = tauri::async_runtime::block_on(check(urls)).unwrap();
        probes.sort_by(|a, b| a.url.cmp(&b.url));
        probes
    }

    #[test]
    fn reads_statuses_and_retries_refused_head_with_get() {
        let base = serve();
        let probes = run(vec![
            format!("{base}/ok"),
            format!("{base}/gone"),
            format!("{base}/no-head"),
        ]);
        let status = |suffix: &str| {
            probes
                .iter()
                .find(|p| p.url.ends_with(suffix))
                .and_then(|p| p.status)
        };
        assert_eq!(status("/ok"), Some(200));
        assert_eq!(status("/gone"), Some(404));
        assert_eq!(status("/no-head"), Some(200));
    }

    #[test]
    fn refuses_schemes_other_than_http() {
        let probes = run(vec!["file:///etc/hosts".into()]);
        assert_eq!(probes[0].failure, Some(Failure::Other));
        assert_eq!(probes[0].status, None);
    }

    #[test]
    fn reports_a_refused_connection_without_a_status() {
        let probes = run(vec!["http://127.0.0.1:1/".into()]);
        assert_eq!(probes[0].status, None);
        assert!(probes[0].failure.is_some());
    }
}
