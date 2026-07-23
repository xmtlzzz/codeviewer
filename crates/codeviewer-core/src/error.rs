use std::fmt;

#[derive(Debug)]
pub enum ScanError {
    PathNotFound(String),
    NotAGitRepo(String),
    Git(String),
    Io(String),
    Json(String),
    Toml(String),
}

impl fmt::Display for ScanError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ScanError::PathNotFound(p) => write!(f, "path does not exist: {p}"),
            ScanError::NotAGitRepo(p) => write!(f, "not a git repository: {p}"),
            ScanError::Git(msg) => write!(f, "git error: {msg}"),
            ScanError::Io(msg) => write!(f, "io error: {msg}"),
            ScanError::Json(msg) => write!(f, "json error: {msg}"),
            ScanError::Toml(msg) => write!(f, "toml error: {msg}"),
        }
    }
}

impl std::error::Error for ScanError {}

impl From<git2::Error> for ScanError {
    fn from(e: git2::Error) -> Self {
        ScanError::Git(e.to_string())
    }
}
impl From<std::io::Error> for ScanError {
    fn from(e: std::io::Error) -> Self {
        ScanError::Io(e.to_string())
    }
}
impl From<serde_json::Error> for ScanError {
    fn from(e: serde_json::Error) -> Self {
        ScanError::Json(e.to_string())
    }
}
impl From<toml::de::Error> for ScanError {
    fn from(e: toml::de::Error) -> Self {
        ScanError::Toml(e.to_string())
    }
}
