use tauri::State;
use crate::database::{connection::DbConnection, schema::{ProductRepository, Repository}};
use crate::models::Product;
use anyhow::Result;
use pinyin::ToPinyin;

fn generate_search_pinyin(name: &str) -> String {
    let mut initials = String::new();
    let mut full = String::new();

    for c in name.chars() {
        if let Some(py) = c.to_pinyin() {
            let plain = py.plain().to_lowercase();
            if let Some(first) = plain.chars().next() {
                initials.push(first);
            }
            full.push_str(&plain);
        } else if c.is_ascii_alphanumeric() {
            let lower = c.to_ascii_lowercase();
            initials.push(lower);
            full.push(lower);
        }
    }

    if full.is_empty() {
        name.to_lowercase()
    } else {
        format!("{} {}", initials, full)
    }
}

#[tauri::command]
pub async fn get_all_products(
    conn: State<'_, DbConnection>,
) -> Result<Vec<Product>, String> {
    let repo = ProductRepository::new(conn.inner().clone());
    repo.get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_product_by_id(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<Product, String> {
    let repo = ProductRepository::new(conn.inner().clone());
    repo.get_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_products(
    query: String,
    conn: State<'_, DbConnection>,
) -> Result<Vec<Product>, String> {
    let repo = ProductRepository::new(conn.inner().clone());
    repo.search(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_products_by_category(
    category_id: String,
    conn: State<'_, DbConnection>,
) -> Result<Vec<Product>, String> {
    let repo = ProductRepository::new(conn.inner().clone());
    repo.get_by_category(&category_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_product(
    product: Product,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = ProductRepository::new(conn.inner().clone());

    // 检查是新增还是更新
    let existing = repo.get_by_id(&product.id);
    if existing.is_ok() {
        repo.update(&product).map_err(|e| e.to_string())
    } else {
        repo.insert(&product).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn delete_product(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = ProductRepository::new(conn.inner().clone());
    repo.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn batch_delete_products(
    ids: Vec<String>,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = ProductRepository::new(conn.inner().clone());

    for id in ids {
        repo.delete(&id).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn update_product_price(
    product_id: String,
    new_price: f64,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = ProductRepository::new(conn.inner().clone());

    // 获取现有商品
    let mut product = repo.get_by_id(&product_id).map_err(|e| e.to_string())?;

    // 更新价格
    product.price = new_price;
    product.updated_at = chrono::Utc::now().to_rfc3339();

    // 保存更新
    repo.update(&product).map_err(|e| e.to_string())
}

/// 生成商品名称的拼音简码
#[tauri::command]
pub async fn generate_product_pinyin(name: String) -> Result<String, String> {
    Ok(generate_search_pinyin(&name))
}

/// 批量更新所有商品的拼音简码
#[tauri::command]
pub async fn batch_update_pinyin(
    conn: State<'_, DbConnection>,
) -> Result<usize, String> {
    let repo = ProductRepository::new(conn.inner().clone());
    let mut products = repo.get_all().map_err(|e| e.to_string())?;
    
    let mut updated_count = 0;
    for product in &mut products {
        let pinyin_code = generate_search_pinyin(&product.name);
        
        if product.pinyin.as_ref().map(|v| v.to_lowercase()) != Some(pinyin_code.clone()) {
            product.pinyin = Some(pinyin_code);
            product.updated_at = chrono::Utc::now().to_rfc3339();
            repo.update(product).map_err(|e| e.to_string())?;
            updated_count += 1;
        }
    }
    
    Ok(updated_count)
}
