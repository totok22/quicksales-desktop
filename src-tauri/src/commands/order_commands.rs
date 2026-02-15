use tauri::State;
use crate::database::connection::DbConnection;
use crate::database::schema::{OrderRepository, CustomerRepository, ProductRepository, TemplateRepository, SettingsRepository, Repository};
use crate::models::{Order, TemplateConfig, AppSettings};
use chrono::Utc;

#[tauri::command]
pub async fn get_all_orders(
    conn: State<'_, DbConnection>,
) -> Result<Vec<Order>, String> {
    let order_repo = OrderRepository::new(conn.inner().clone());
    let customer_repo = CustomerRepository::new(conn.inner().clone());
    
    let mut orders = order_repo.get_all().map_err(|e| e.to_string())?;
    
    // 填充客户信息和订单项
    for order in &mut orders {
        // 获取客户信息
        if let Ok(customer) = customer_repo.get_by_id(&order.customer_id) {
            order.customer = customer;
        }
        
        // 获取订单项
        if let Ok(items) = order_repo.get_order_items(&order.id) {
            order.items = items;
        }
    }
    
    Ok(orders)
}

#[tauri::command]
pub async fn save_order(
    mut order: Order,
    conn: State<'_, DbConnection>,
) -> Result<String, String> {
    let order_repo = OrderRepository::new(conn.inner().clone());
    let customer_repo = CustomerRepository::new(conn.inner().clone());
    let product_repo = ProductRepository::new(conn.inner().clone());

    // 获取设置以生成正确的订单号
    let settings_repo = SettingsRepository::new(conn.inner().clone());
    let settings = settings_repo.get_settings()
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| AppSettings {
            id: "settings".to_string(),
            data_directory: "".to_string(),
            output_directory: "".to_string(),
            backup_directory: "".to_string(),
            font_size: 14,
            theme: "light".to_string(),
            remember_window: true,
            date_format: "YYYY-MM-DD".to_string(),
            excel_date_format: "YYYY-MM-DD".to_string(),
            order_number_format: "YYYYMMDD_{SEQ:6}".to_string(),
            order_number_prefix: "".to_string(),
            order_number_reset_daily: true,
            order_number_digits: 6,
            retain_days: 90,
            auto_backup: true,
            backup_interval: 24,
            backup_keep_count: 10,
            default_template_id: "".to_string(),
            default_category_id: "".to_string(),
            excel_filename_format: "{date}_{customerName}_{orderNumber}".to_string(),
            auto_open_excel: false,
            skip_save_dialog: false,
            template_validation: None,
            updated_at: Utc::now().to_rfc3339(),
        });

    // 只有在订单号为空时才生成
    let order_number = if order.order_number.is_empty() {
        let generated = order_repo.generate_order_number(&settings, &order.date)
            .map_err(|e| e.to_string())?;
        order.order_number = generated.clone();
        generated
    } else {
        order.order_number.clone()
    };

    order.updated_at = Utc::now().to_rfc3339();

    // 处理客户引用：
    // - 正式客户：沿用 customer_id（不存在则写入 customers）
    // - 临时客户：不写入 customers，转为订单专用快照客户ID，避免污染客户管理
    if order.customer_id.starts_with("temp_") {
        let snapshot_customer_id = format!("order_customer_{}", order.id);
        order.customer_id = snapshot_customer_id.clone();
        order.customer.id = snapshot_customer_id.clone();

        let customer_exists = customer_repo.get_by_id(&snapshot_customer_id).is_ok();
        if !customer_exists {
            customer_repo.insert(&order.customer).map_err(|e| e.to_string())?;
        }
    } else {
        let customer_exists = customer_repo.get_by_id(&order.customer_id).is_ok();
        if !customer_exists {
            customer_repo.insert(&order.customer).map_err(|e| e.to_string())?;
        }
    }

    // 检查订单是否已存在来决定是插入还是更新
    let existing = order_repo.get_by_id(&order.id);
    if existing.is_ok() {
        order_repo.update(&order).map_err(|e| e.to_string())?;
    } else {
        order_repo.insert(&order).map_err(|e| e.to_string())?;
    }

    // 扣减库存（仅在新建订单时扣减，如果是更新，逻辑可能更复杂，暂保持原样或调整）
    // 注意：如果是更新订单，可能需要处理旧商品的库存返还，这里简单处理只在新建时扣减
    if existing.is_err() {
        let stock_items: Vec<(String, f64)> = order.items.iter()
            .map(|item| (item.id.clone(), item.quantity))
            .collect();
        product_repo.deduct_stock_batch(&stock_items).map_err(|e| e.to_string())?;
    }

    // 更新客户最后购买时间（仅正式客户）
    if !order.customer_id.starts_with("order_customer_") {
        let mut customer = order.customer;
        customer.last_purchase_at = Some(Utc::now().to_rfc3339());
        customer.updated_at = Utc::now().to_rfc3339();
        customer_repo.update(&customer).map_err(|e| e.to_string())?;
    }

    Ok(order_number)
}

#[tauri::command]
pub async fn get_all_templates(
    conn: State<'_, DbConnection>,
) -> Result<Vec<TemplateConfig>, String> {
    let repo = TemplateRepository::new(conn.inner().clone());
    repo.get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_template(
    mut template: TemplateConfig,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = TemplateRepository::new(conn.inner().clone());
    template.updated_at = Utc::now().to_rfc3339();

    let existing = repo.get_by_id(&template.id);
    if existing.is_ok() {
        repo.update(&template).map_err(|e| e.to_string())?;
    } else {
        repo.insert(&template).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_template(
    id: String,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = TemplateRepository::new(conn.inner().clone());
    repo.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_settings(
    mut settings: AppSettings,
    conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let repo = SettingsRepository::new(conn.inner().clone());
    settings.id = "settings".to_string();
    settings.updated_at = Utc::now().to_rfc3339();
    repo.save_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_settings(
    conn: State<'_, DbConnection>,
) -> Result<Option<AppSettings>, String> {
    let repo = SettingsRepository::new(conn.inner().clone());
    repo.get_settings().map_err(|e| e.to_string())
}
