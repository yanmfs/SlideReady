use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::ipc::Response;

#[derive(Debug, thiserror::Error)]
pub enum FileError {
    #[error("only .pptx files are accepted")]
    NotPptx,
    #[error("reports are saved as .html or .md only")]
    NotReport,
    #[error("could not read the file: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for FileError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

fn is_pptx(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("pptx"))
}

pub fn read_pptx(path: &Path) -> Result<Vec<u8>, FileError> {
    if !is_pptx(path) {
        return Err(FileError::NotPptx);
    }
    Ok(fs::read(path)?)
}

pub fn pptx_size(path: &Path) -> Result<u64, FileError> {
    if !is_pptx(path) {
        return Err(FileError::NotPptx);
    }
    Ok(fs::metadata(path)?.len())
}

/// Family names are lowercased once; the list never changes while the app runs.
pub fn system_fonts() -> &'static BTreeSet<String> {
    static FONTS: OnceLock<BTreeSet<String>> = OnceLock::new();
    FONTS.get_or_init(|| {
        let mut db = fontdb::Database::new();
        db.load_system_fonts();
        db.faces()
            .flat_map(|face| face.families.iter().map(|(name, _)| name.to_lowercase()))
            .collect()
    })
}

#[tauri::command]
pub fn read_pptx_file(path: PathBuf) -> Result<Response, FileError> {
    read_pptx(&path).map(Response::new)
}

#[tauri::command]
pub fn pptx_file_size(path: PathBuf) -> Result<u64, FileError> {
    pptx_size(&path)
}

#[tauri::command]
pub async fn list_system_fonts() -> Vec<String> {
    tauri::async_runtime::spawn_blocking(|| system_fonts().iter().cloned().collect())
        .await
        .unwrap_or_default()
}

// Used for links to local files; only reports presence, never reads the content.
#[tauri::command]
pub fn file_exists(path: PathBuf) -> bool {
    path.exists()
}

fn is_report(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| ["html", "md"].iter().any(|x| e.eq_ignore_ascii_case(x)))
}

// The report is the only file the app writes; the .pptx itself is never touched.
pub fn write_report(path: &Path, contents: &str) -> Result<(), FileError> {
    if !is_report(path) {
        return Err(FileError::NotReport);
    }
    Ok(fs::write(path, contents)?)
}

#[tauri::command]
pub fn write_report_file(path: PathBuf, contents: String) -> Result<(), FileError> {
    write_report(&path, &contents)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("slideready-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn reads_pptx_regardless_of_extension_case() {
        let path = scratch("deck.PPTX");
        fs::write(&path, b"zip-bytes").unwrap();
        assert_eq!(read_pptx(&path).unwrap(), b"zip-bytes");
        assert_eq!(pptx_size(&path).unwrap(), 9);
    }

    #[test]
    fn refuses_other_extensions() {
        let path = scratch("notes.pdf");
        fs::write(&path, b"x").unwrap();
        assert!(matches!(read_pptx(&path), Err(FileError::NotPptx)));
    }

    #[test]
    fn writes_reports_but_never_a_pptx() {
        let html = scratch("report.html");
        write_report(&html, "<p>ok</p>").unwrap();
        assert_eq!(fs::read_to_string(&html).unwrap(), "<p>ok</p>");
        assert!(matches!(
            write_report(&scratch("deck.pptx"), "x"),
            Err(FileError::NotReport)
        ));
    }

    #[test]
    fn reports_missing_files() {
        assert!(!file_exists(scratch("absent.mp4")));
        let present = scratch("present.mp4");
        fs::write(&present, b"x").unwrap();
        assert!(file_exists(present));
    }
}
