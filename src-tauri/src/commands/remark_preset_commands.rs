use tauri::State;
use crate::database::{connection::DbConnection, schema::{RemarkPresetRepository, Repository}};
use crate::models::RemarkPreset;

#[tauri::command]
pub async fn get_all_remark_presets(
    conn: State<'_, DbConnection>,
) -> Result<Vec<RemarkPreset>, String> {
    let repo = RemarkPresetRepository::new(conn.inner().clone());
    repo.get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_remark_presets_by_type(
    preset_type: String,
    conn: State<'_, DbConnection>,
) -> Result<Vec<RemarkPreset>, String> {
    let repo = RemarkPresetRepository::new(conn.inner().clone());
    repo.get_by_type(&preset_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_remark_preset(
    mut preset: RemarkPreset,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = RemarkPresetRepository::new(conn.inner().clone());
    preset.updated_at = chrono::Utc::now().to_rfc3339();

    let existing = repo.get_by_id(&preset.id);
    if existing.is_ok() {
        repo.update(&preset).map_err(|e| e.to_string())
    } else {
        repo.insert(&preset).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn delete_remark_preset(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = RemarkPresetRepository::new(conn.inner().clone());
    repo.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn increment_remark_use_count(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = RemarkPresetRepository::new(conn.inner().clone());
    repo.increment_use_count(&id).map_err(|e| e.to_string())
}
