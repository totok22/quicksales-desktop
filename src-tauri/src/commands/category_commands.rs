use tauri::State;
use crate::database::{connection::DbConnection, schema::{CategoryRepository, Repository}};
use crate::models::Category;
use rusqlite;

#[tauri::command]
pub async fn get_all_categories(
    conn: State<'_, DbConnection>,
) -> Result<Vec<Category>, String> {
    let repo = CategoryRepository::new(conn.inner().clone());
    repo.get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_category_by_id(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<Category, String> {
    let repo = CategoryRepository::new(conn.inner().clone());
    repo.get_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_category_tree(
    conn: State<'_, DbConnection>,
) -> Result<Vec<Category>, String> {
    let repo = CategoryRepository::new(conn.inner().clone());
    repo.get_tree().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_category(
    category: Category,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = CategoryRepository::new(conn.inner().clone());

    let existing = repo.get_by_id(&category.id);
    if existing.is_ok() {
        repo.update(&category).map_err(|e| e.to_string())
    } else {
        repo.insert(&category).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn save_categories_batch(
    categories: Vec<Category>,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = CategoryRepository::new(conn.inner().clone());
    repo.save_batch(&categories).map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
pub async fn delete_category(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = CategoryRepository::new(conn.inner().clone());
    repo.delete(&id).map_err(|e| e.to_string())
}
