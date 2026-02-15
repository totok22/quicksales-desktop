// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod models;
mod utils;

use database::connection::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 获取应用数据目录
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // 确保目录存在
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            // 数据库文件路径
            let db_path = app_data_dir.join("quicksales.db");

            // 初始化数据库
            let db =
                Database::new(db_path.to_str().unwrap()).expect("Failed to initialize database");

            // 插入默认数据
            db.insert_default_data()
                .expect("Failed to insert default data");

            // 获取连接并管理应用状态
            let conn = db.conn;

            // 将数据库连接存储到全局状态中
            app.manage(conn);

            println!("✅ QuickSales 数据库初始化成功!");
            println!("📁 数据库位置: {:?}", db_path);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 商品相关命令
            commands::get_all_products,
            commands::get_product_by_id,
            commands::search_products,
            commands::get_products_by_category,
            commands::save_product,
            commands::delete_product,
            commands::batch_delete_products,
            commands::update_product_price,
            commands::generate_product_pinyin,
            commands::batch_update_pinyin,
            // 客户相关命令
            commands::get_all_customers,
            commands::get_customer_by_id,
            commands::search_customers,
            commands::save_customer,
            commands::merge_customers,
            commands::delete_customer,
            commands::batch_delete_customers,
            // 分类相关命令
            commands::get_all_categories,
            commands::get_category_by_id,
            commands::get_category_tree,
            commands::save_category,
            commands::save_categories_batch,
            commands::delete_category,
            // 订单和模板相关命令
            commands::get_all_orders,
            commands::save_order,
            commands::get_all_templates,
            commands::save_template,
            commands::delete_template,
            commands::save_settings,
            commands::get_settings,
            commands::update_all_template_filename_patterns,
            // 备注预设相关命令
            commands::get_all_remark_presets,
            commands::get_remark_presets_by_type,
            commands::save_remark_preset,
            commands::delete_remark_preset,
            commands::increment_remark_use_count,
            // 单位预设相关命令
            commands::get_all_unit_presets,
            commands::get_unit_preset_by_id,
            commands::save_unit_preset,
            commands::delete_unit_preset,
            commands::increment_unit_preset_use_count,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
