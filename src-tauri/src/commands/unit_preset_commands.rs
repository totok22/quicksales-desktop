use tauri::State;
use crate::database::DbConnection;
use crate::models::UnitPreset;
use crate::database::schema::{UnitPresetRepository, Repository};
use rusqlite::Error as SqliteError;

#[tauri::command]
pub async fn get_all_unit_presets(
    conn: State<'_, DbConnection>,
) -> Result<Vec<UnitPreset>, String> {
    let repo = UnitPresetRepository::new(conn.inner().clone());
    repo.get_all()
        .map_err(|e: SqliteError| e.to_string())
}

#[tauri::command]
pub async fn get_unit_preset_by_id(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<UnitPreset, String> {
    let repo = UnitPresetRepository::new(conn.inner().clone());
    repo.get_by_id(&id)
        .map_err(|e: SqliteError| e.to_string())
}

#[tauri::command]
pub async fn save_unit_preset(
    preset: UnitPreset,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = UnitPresetRepository::new(conn.inner().clone());
    
    // 检查是否已存在
    let existing = repo.get_by_id(&preset.id);
    
    if existing.is_ok() {
        // 更新
        repo.update(&preset)
            .map_err(|e: SqliteError| e.to_string())
    } else {
        // 插入
        repo.insert(&preset)
            .map_err(|e: SqliteError| e.to_string())
    }
}

#[tauri::command]
pub async fn delete_unit_preset(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = UnitPresetRepository::new(conn.inner().clone());
    repo.delete(&id)
        .map_err(|e: SqliteError| e.to_string())
}

#[tauri::command]
pub async fn increment_unit_preset_use_count(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = UnitPresetRepository::new(conn.inner().clone());
    
    // 获取当前预设
    let mut preset = repo.get_by_id(&id)
        .map_err(|e: SqliteError| e.to_string())?;
    
    // 增加使用次数
    preset.use_count += 1;
    preset.updated_at = chrono::Utc::now().to_rfc3339();
    
    // 更新
    repo.update(&preset)
        .map_err(|e: SqliteError| e.to_string())
}
