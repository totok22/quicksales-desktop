use crate::database::DbConnection;
use tauri::State;

#[tauri::command]
pub async fn update_all_template_filename_patterns(
    conn: State<'_, DbConnection>,
) -> Result<usize, String> {
    let conn = conn.lock().unwrap();
    
    let updated = conn.execute(
        "UPDATE templates 
         SET filename_pattern = '{date}_{customerName}_{orderNumber}',
             updated_at = datetime('now')
         WHERE filename_pattern != '{date}_{customerName}_{orderNumber}'",
        [],
    ).map_err(|e| format!("Failed to update templates: {}", e))?;
    
    Ok(updated)
}
