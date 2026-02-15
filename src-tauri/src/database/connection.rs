use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::sync::{Arc, Mutex};

pub type DbConnection = Arc<Mutex<Connection>>;

pub struct Database {
    pub conn: DbConnection,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path).context("Failed to open database")?;

        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };

        // 初始化数据库表
        db.init_tables()?;

        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 商品分类表（支持多级分类）
        conn.execute(
            "CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                level INTEGER NOT NULL DEFAULT 0,
                path TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
            )",
            [],
        )?;

        // 商品表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                unit TEXT NOT NULL,
                price REAL NOT NULL,
                category_id TEXT,
                pinyin TEXT,
                stock REAL,
                min_stock REAL,
                track_stock INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            )",
            [],
        )?;

        // 尝试添加新列（用于升级旧数据库）
        let _ = conn.execute("ALTER TABLE products ADD COLUMN stock REAL", []);
        let _ = conn.execute("ALTER TABLE products ADD COLUMN min_stock REAL", []);
        let _ = conn.execute(
            "ALTER TABLE products ADD COLUMN track_stock INTEGER DEFAULT 0",
            [],
        );

        // 客户表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT,
                license_plate TEXT NOT NULL,
                address TEXT,
                last_purchase_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 订单表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                order_number TEXT UNIQUE NOT NULL,
                date TEXT NOT NULL,
                customer_id TEXT NOT NULL,
                total_amount REAL NOT NULL,
                remark TEXT,
                template_id TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
            )",
            [],
        )?;

        // 订单项表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS order_items (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                product_id TEXT,
                name TEXT NOT NULL,
                unit TEXT NOT NULL,
                price REAL NOT NULL,
                quantity REAL NOT NULL,
                discount_price REAL,
                remark TEXT,
                sort_value INTEGER DEFAULT 0,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )",
            [],
        )?;
        // 尝试升级旧数据库（将 sort_value 列类型改为支持 i64）
        // SQLite 的 INTEGER 本身就是 64 位的，所以不需要 ALTER COLUMN

        // 应用设置表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                id TEXT PRIMARY KEY,
                data_directory TEXT,
                output_directory TEXT,
                backup_directory TEXT,
                font_size INTEGER DEFAULT 16,
                theme TEXT DEFAULT 'light',
                remember_window INTEGER DEFAULT 1,
                date_format TEXT DEFAULT 'YYYY-MM-DD',
                excel_date_format TEXT DEFAULT 'YYYY.MM.DD',
                order_number_format TEXT DEFAULT 'NO.{SEQ:6}',
                order_number_prefix TEXT,
                order_number_reset_daily INTEGER DEFAULT 1,
                order_number_digits INTEGER DEFAULT 6,
                retain_days INTEGER DEFAULT 0,
                auto_backup INTEGER DEFAULT 1,
                backup_interval INTEGER DEFAULT 7,
                backup_keep_count INTEGER DEFAULT 10,
                default_template_id TEXT,
                default_category_id TEXT,
                excel_filename_format TEXT DEFAULT '{date}_{customerName}_{orderNumber}',
                auto_open_excel INTEGER DEFAULT 0,
                skip_save_dialog INTEGER DEFAULT 0,
                template_validation TEXT DEFAULT '{}',
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 尝试为旧版本数据库添加缺失的列
        let _ = conn.execute(
            "ALTER TABLE app_settings ADD COLUMN default_template_id TEXT",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE app_settings ADD COLUMN default_category_id TEXT",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE app_settings ADD COLUMN template_validation TEXT",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE app_settings ADD COLUMN excel_filename_format TEXT DEFAULT '{date}_{customerName}_{orderNumber}'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE app_settings ADD COLUMN auto_open_excel INTEGER DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE app_settings ADD COLUMN skip_save_dialog INTEGER DEFAULT 0",
            [],
        );

        // 模板配置表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                template_base64 TEXT NOT NULL,
                file_name TEXT NOT NULL,
                filename_pattern TEXT NOT NULL,
                is_default INTEGER DEFAULT 0,
                mappings TEXT NOT NULL,
                item_end_row INTEGER DEFAULT 0,
                required_fields TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 尝试添加 required_fields 列（用于升级旧数据库）
        let _ = conn.execute(
            "ALTER TABLE templates ADD COLUMN required_fields TEXT NOT NULL DEFAULT '{}'",
            [],
        );

        // 尝试添加 item_end_row 列（用于升级旧数据库）
        let _ = conn.execute(
            "ALTER TABLE templates ADD COLUMN item_end_row INTEGER DEFAULT 0",
            [],
        );

        // 备注预设表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS remark_presets (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                use_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 单位预设表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS unit_presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                use_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_customers_plate ON customers(license_plate)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_templates_default ON templates(is_default)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_remark_presets_type ON remark_presets(type)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_unit_presets_sort ON unit_presets(sort_order)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level)",
            [],
        )?;

        Ok(())
    }

    pub fn insert_default_data(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();

        // 1. 检查并插入默认分类
        let category_count: i64 =
            conn.query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))?;
        if category_count == 0 {
            let categories = vec![
                ("保养", 0),
                ("配件", 1),
                ("装饰", 2),
                ("清洗", 3),
                ("服务", 4),
                ("其他", 5),
            ];

            for (name, sort_order) in categories {
                let id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO categories (id, name, parent_id, level, path, sort_order, created_at, updated_at) VALUES (?1, ?2, NULL, 0, ?2, ?3, ?4, ?4)",
                    params![&id, name, &sort_order, &now],
                )?;
            }
        }

        // 2. 检查并插入默认单位预设
        let unit_count: i64 =
            conn.query_row("SELECT COUNT(*) FROM unit_presets", [], |row| row.get(0))?;
        if unit_count == 0 {
            let default_units = vec![
                ("件", 0),
                ("个", 1),
                ("套", 2),
                ("箱", 3),
                ("包", 4),
                ("瓶", 5),
                ("盒", 6),
                ("袋", 7),
                ("桶", 8),
                ("斤", 9),
                ("公斤", 10),
                ("克", 11),
                ("升", 12),
                ("毫升", 13),
                ("米", 14),
                ("厘米", 15),
            ];

            for (name, sort_order) in default_units {
                let id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO unit_presets (id, name, sort_order, use_count, created_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?4)",
                    params![&id, name, &sort_order, &now],
                )?;
            }
        }

        // 3. 检查并插入默认模板
        let template_count: i64 =
            conn.query_row("SELECT COUNT(*) FROM templates", [], |row| row.get(0))?;
        if template_count == 0 {
            let template_id = uuid::Uuid::new_v4().to_string();
            let template_mappings = serde_json::json!({
                "customerName": "C3",
                "customerPhone": "E3",
                "customerPlate": "B3",
                "date": "G3",
                "orderNumber": "G2",
                "orderRemark": "G15",
                "totalAmount": "",
                "itemStartRow": 5,
                "itemEndRow": 14,
                "columns": {
                    "name": "B",
                    "unit": "C",
                    "quantity": "D",
                    "price": "E",
                    "total": "F",
                    "remark": "G"
                }
            });
            let template_required_fields = serde_json::json!({
                "customerName": false,
                "customerPhone": false,
                "customerPlate": true,
                "date": true,
                "orderNumber": true,
                "orderRemark": false,
                "totalAmount": false,
                "itemName": true,
                "itemUnit": false,
                "itemQuantity": true,
                "itemPrice": true,
                "itemTotal": false,
                "itemRemark": false
            });

            conn.execute(
                "INSERT INTO templates (id, name, template_base64, file_name, filename_pattern, is_default, mappings, item_end_row, required_fields, created_at, updated_at)
                 VALUES (?1, ?2, '', 'template1.xlsx', '{date}_{customerName}_{orderNumber}', 1, ?3, 14, ?4, ?5, ?5)",
                params![
                    &template_id,
                    "默认模板",
                    &template_mappings.to_string(),
                    &template_required_fields.to_string(),
                    &now
                ],
            )?;
        }

        // 4. 检查并插入默认设置
        let settings_id = "settings";
        let settings_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM app_settings WHERE id = ?1",
            [settings_id],
            |row| row.get(0),
        )?;
        if settings_count == 0 {
            let default_template_id: String = conn
                .query_row(
                    "SELECT id FROM templates WHERE is_default = 1 ORDER BY updated_at DESC LIMIT 1",
                    [],
                    |row| row.get(0),
                )
                .or_else(|_| {
                    conn.query_row(
                        "SELECT id FROM templates ORDER BY updated_at DESC LIMIT 1",
                        [],
                        |row| row.get(0),
                    )
                })
                .unwrap_or_default();

            conn.execute(
                "INSERT INTO app_settings (
                    id, data_directory, output_directory, backup_directory,
                    font_size, theme, remember_window, date_format, excel_date_format,
                    order_number_format, order_number_prefix, order_number_reset_daily,
                    order_number_digits, retain_days, auto_backup, backup_interval,
                    backup_keep_count, default_template_id, default_category_id,
                    excel_filename_format, auto_open_excel, skip_save_dialog,
                    template_validation, updated_at
                ) VALUES (?1, '', '', '', 16, 'light', 1, 'YYYY-MM-DD', 'YYYY.MM.DD',
                          'NO.{SEQ:6}', '', 1, 6, 0, 1, 7, 10, ?2, '', '{date}_{customerName}_{orderNumber}', 0, 0, '{}', ?3)",
                params![settings_id, &default_template_id, &now],
            )?;
        }

        Ok(())
    }
}
