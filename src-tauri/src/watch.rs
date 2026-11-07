use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, thiserror::Error)]
pub enum WatchError {
    #[error("the file has no folder to watch")]
    NoParent,
    #[error("could not watch the file: {0}")]
    Notify(#[from] notify::Error),
}

impl serde::Serialize for WatchError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Default)]
pub struct DeckWatcher(Mutex<Option<RecommendedWatcher>>);

// PowerPoint saves through a temporary file and a rename, so the folder is watched and events
// are matched by file name instead of by the inode of the original file.
fn touches(event: &Event, name: &std::ffi::OsStr) -> bool {
    matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_))
        && event.paths.iter().any(|p| p.file_name() == Some(name))
}

fn start(app: AppHandle, path: &Path) -> Result<RecommendedWatcher, WatchError> {
    let dir = path.parent().ok_or(WatchError::NoParent)?;
    let name = path.file_name().ok_or(WatchError::NoParent)?.to_owned();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<Event>| {
        if event.is_ok_and(|e| touches(&e, &name)) {
            let _ = app.emit("deck-changed", ());
        }
    })?;
    watcher.watch(dir, RecursiveMode::NonRecursive)?;
    Ok(watcher)
}

// Watching a new file drops the previous watcher, so only one deck is followed at a time.
#[tauri::command]
pub fn watch_deck(
    app: AppHandle,
    state: State<DeckWatcher>,
    path: PathBuf,
) -> Result<(), WatchError> {
    let watcher = start(app, &path)?;
    if let Ok(mut slot) = state.0.lock() {
        *slot = Some(watcher);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, ModifyKind};

    fn event(kind: EventKind, path: &str) -> Event {
        Event::new(kind).add_path(PathBuf::from(path))
    }

    #[test]
    fn matches_saves_of_the_watched_file_only() {
        let name = std::ffi::OsString::from("talk.pptx");
        let modify = EventKind::Modify(ModifyKind::Any);
        assert!(touches(&event(modify, "/docs/talk.pptx"), &name));
        assert!(touches(
            &event(EventKind::Create(CreateKind::File), "/docs/talk.pptx"),
            &name
        ));
        assert!(!touches(&event(modify, "/docs/other.pptx"), &name));
        assert!(!touches(
            &event(
                EventKind::Remove(notify::event::RemoveKind::File),
                "/docs/talk.pptx"
            ),
            &name
        ));
    }
}
