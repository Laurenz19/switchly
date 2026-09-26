use crate::model::Config;
use std::path::{Path, PathBuf};

pub struct Store {
    path: PathBuf,
    pub config: Config,
    // ~/.switchly: the per-account git config files.
    pub managed_dir: PathBuf,
    pub home: PathBuf,
}

impl Store {
    pub fn load(config_dir: &Path, home: PathBuf) -> Store {
        let path = config_dir.join("config.json");
        let config = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Store { path, config, managed_dir: home.join(".switchly"), home }
    }

    // Written to a temp file first, so a crash mid-write can't leave a
    // truncated config behind.
    pub fn save(&self) -> Result<(), String> {
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
        }
        let json = serde_json::to_string_pretty(&self.config).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, json).map_err(|e| format!("Could not save settings: {e}"))?;
        std::fs::rename(&tmp, &self.path).map_err(|e| format!("Could not save settings: {e}"))
    }
}
