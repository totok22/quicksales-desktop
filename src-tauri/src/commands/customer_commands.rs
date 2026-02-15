use tauri::State;
use crate::database::{connection::DbConnection, schema::{CustomerRepository, Repository}};
use crate::models::Customer;
use chrono::Utc;
use rusqlite::params;

fn ensure_placeholder_customer_and_relink_orders(
    conn: &DbConnection,
    original_customer_id: &str,
) -> Result<(), String> {
    let placeholder_id = format!("deleted_{}", original_customer_id);
    let now = Utc::now().to_rfc3339();
    let db = conn.lock().unwrap();

    let exists: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM customers WHERE id = ?1",
            params![&placeholder_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if exists == 0 {
        db.execute(
            "INSERT INTO customers (id, name, phone, license_plate, address, last_purchase_at, created_at, updated_at)
             VALUES (?1, ?2, '', '', ?3, NULL, ?4, ?4)",
            params![
                &placeholder_id,
                "已删除客户（历史保留）",
                format!("原客户ID: {}", original_customer_id),
                &now,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    db.execute(
        "UPDATE orders SET customer_id = ?1, updated_at = ?2 WHERE customer_id = ?3",
        params![&placeholder_id, &now, original_customer_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_all_customers(
    conn: State<'_, DbConnection>,
) -> Result<Vec<Customer>, String> {
    let repo = CustomerRepository::new(conn.inner().clone());
    repo.get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_customer_by_id(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<Customer, String> {
    let repo = CustomerRepository::new(conn.inner().clone());
    repo.get_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_customers(
    query: String,
    conn: State<'_, DbConnection>,
) -> Result<Vec<Customer>, String> {
    let repo = CustomerRepository::new(conn.inner().clone());
    repo.search(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_customer(
    customer: Customer,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = CustomerRepository::new(conn.inner().clone());

    // 客户去重规则：仅电话/车牌号去重（姓名不参与）
    let matched = repo
        .find_by_identity(&customer.phone, &customer.license_plate)
        .map_err(|e| e.to_string())?;

    if let Some(existing) = matched {
        let now = Utc::now().to_rfc3339();
        let incoming_name = customer.name.trim().to_string();
        let incoming_phone = customer.phone.trim().to_string();
        let incoming_plate = customer.license_plate.trim().to_string();

        // 合并策略：优先使用新值，空值回退旧值
        let merged = Customer {
            id: existing.id,
            name: if incoming_name.is_empty() { existing.name } else { incoming_name },
            phone: if incoming_phone.is_empty() { existing.phone } else { incoming_phone },
            license_plate: if incoming_plate.is_empty() { existing.license_plate } else { incoming_plate },
            address: customer.address.or(existing.address),
            last_purchase_at: existing.last_purchase_at,
            created_at: existing.created_at,
            updated_at: now,
        };

        return repo.update(&merged).map_err(|e| e.to_string())
    }

    let existing = repo.get_by_id(&customer.id);
    if existing.is_ok() {
        repo.update(&customer).map_err(|e| e.to_string())
    } else {
        repo.insert(&customer).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn merge_customers(
    source_id: String,
    target_id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    if source_id == target_id {
        return Err("源客户和目标客户不能相同".to_string());
    }

    let repo = CustomerRepository::new(conn.inner().clone());
    let source = repo.get_by_id(&source_id).map_err(|e| e.to_string())?;
    let target = repo.get_by_id(&target_id).map_err(|e| e.to_string())?;

    let merged = Customer {
        id: target.id.clone(),
        name: if target.name.trim().is_empty() { source.name } else { target.name },
        phone: if target.phone.trim().is_empty() { source.phone } else { target.phone },
        license_plate: if target.license_plate.trim().is_empty() { source.license_plate } else { target.license_plate },
        address: target.address.or(source.address),
        last_purchase_at: target.last_purchase_at.or(source.last_purchase_at),
        created_at: target.created_at,
        updated_at: Utc::now().to_rfc3339(),
    };

    // 先更新目标客户信息
    repo.update(&merged).map_err(|e| e.to_string())?;

    // 再将历史订单指向目标客户，并删除源客户
    let db = conn.inner().lock().unwrap();
    db.execute(
        "UPDATE orders SET customer_id = ?1, updated_at = ?2 WHERE customer_id = ?3",
        params![target_id, Utc::now().to_rfc3339(), source_id],
    )
    .map_err(|e| e.to_string())?;

    db.execute("DELETE FROM customers WHERE id = ?1", params![source_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_customer(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    ensure_placeholder_customer_and_relink_orders(conn.inner(), &id)?;
    let repo = CustomerRepository::new(conn.inner().clone());
    repo.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn batch_delete_customers(
    ids: Vec<String>,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = CustomerRepository::new(conn.inner().clone());

    for id in ids {
        ensure_placeholder_customer_and_relink_orders(conn.inner(), &id)?;
        repo.delete(&id).map_err(|e| e.to_string())?;
    }

    Ok(())
}
