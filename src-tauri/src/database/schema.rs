use crate::database::DbConnection;
use crate::models::{
    AppSettings, Category, Customer, Order, OrderItem, Product, RemarkPreset, RequiredFields,
    TemplateConfig, TemplateMappings, UnitPreset,
};

use chrono::Utc;
use rusqlite::{params, Result};
use serde_json;

// ========== Repository Trait ==========

pub trait Repository<T> {
    fn get_all(&self) -> Result<Vec<T>>;
    fn get_by_id(&self, id: &str) -> Result<T>;
    fn insert(&self, item: &T) -> Result<()>;
    fn update(&self, item: &T) -> Result<()>;
    fn delete(&self, id: &str) -> Result<()>;
}

// ========== Product Repository ==========

pub struct ProductRepository {
    pub conn: DbConnection,
}

impl ProductRepository {
    pub fn new(conn: DbConnection) -> Self {
        Self { conn }
    }

    pub fn search(&self, query: &str) -> Result<Vec<Product>> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT id, name, unit, price, category_id, pinyin, stock, min_stock, track_stock, created_at, updated_at
             FROM products
             WHERE name LIKE ?1 OR pinyin LIKE ?2 OR id IN (
                 SELECT category_id FROM categories WHERE name LIKE ?1
             )
             ORDER BY name"
        )?;

        let products = stmt
            .query_map(params![pattern, pattern], |row: &rusqlite::Row| {
                Ok(Product {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    unit: row.get::<_, String>(2)?,
                    price: row.get::<_, f64>(3)?,
                    category_id: row.get::<_, String>(4)?,
                    pinyin: row.get::<_, Option<String>>(5)?,
                    stock: row.get::<_, Option<f64>>(6)?,
                    min_stock: row.get::<_, Option<f64>>(7)?,
                    track_stock: row.get::<_, Option<i32>>(8)?.map(|v| v != 0),
                    created_at: row.get::<_, String>(9)?,
                    updated_at: row.get::<_, String>(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(products)
    }

    pub fn get_by_category(&self, category_id: &str) -> Result<Vec<Product>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, unit, price, category_id, pinyin, stock, min_stock, track_stock, created_at, updated_at
             FROM products
             WHERE category_id = ?1
             ORDER BY name"
        )?;

        let products = stmt
            .query_map(params![category_id], |row: &rusqlite::Row| {
                Ok(Product {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    unit: row.get::<_, String>(2)?,
                    price: row.get::<_, f64>(3)?,
                    category_id: row.get::<_, String>(4)?,
                    pinyin: row.get::<_, Option<String>>(5)?,
                    stock: row.get::<_, Option<f64>>(6)?,
                    min_stock: row.get::<_, Option<f64>>(7)?,
                    track_stock: row.get::<_, Option<i32>>(8)?.map(|v| v != 0),
                    created_at: row.get::<_, String>(9)?,
                    updated_at: row.get::<_, String>(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(products)
    }

    /// 扣减库存
    pub fn deduct_stock(&self, product_id: &str, quantity: f64) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 只扣减启用了库存跟踪的商品
        conn.execute(
            "UPDATE products
             SET stock = CASE WHEN track_stock = 1 AND stock IS NOT NULL THEN MAX(0, stock - ?1) ELSE stock END,
                 updated_at = ?2
             WHERE id = ?3 AND track_stock = 1",
            params![
                quantity,
                Utc::now().to_rfc3339(),
                product_id,
            ],
        )?;

        Ok(())
    }

    /// 批量扣减库存
    pub fn deduct_stock_batch(&self, items: &[(String, f64)]) -> Result<()> {
        for (product_id, quantity) in items {
            self.deduct_stock(product_id, *quantity)?;
        }
        Ok(())
    }
}

impl Repository<Product> for ProductRepository {
    fn get_all(&self) -> Result<Vec<Product>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, unit, price, category_id, pinyin, stock, min_stock, track_stock, created_at, updated_at
             FROM products
             ORDER BY name"
        )?;

        let products = stmt
            .query_map([], |row: &rusqlite::Row| {
                Ok(Product {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    unit: row.get::<_, String>(2)?,
                    price: row.get::<_, f64>(3)?,
                    category_id: row.get::<_, String>(4)?,
                    pinyin: row.get::<_, Option<String>>(5)?,
                    stock: row.get::<_, Option<f64>>(6)?,
                    min_stock: row.get::<_, Option<f64>>(7)?,
                    track_stock: row.get::<_, Option<i32>>(8)?.map(|v| v != 0),
                    created_at: row.get::<_, String>(9)?,
                    updated_at: row.get::<_, String>(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(products)
    }

    fn get_by_id(&self, id: &str) -> Result<Product> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT id, name, unit, price, category_id, pinyin, stock, min_stock, track_stock, created_at, updated_at
             FROM products WHERE id = ?1",
            params![id],
            |row: &rusqlite::Row| {
                Ok(Product {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    unit: row.get::<_, String>(2)?,
                    price: row.get::<_, f64>(3)?,
                    category_id: row.get::<_, String>(4)?,
                    pinyin: row.get::<_, Option<String>>(5)?,
                    stock: row.get::<_, Option<f64>>(6)?,
                    min_stock: row.get::<_, Option<f64>>(7)?,
                    track_stock: row.get::<_, Option<i32>>(8)?.map(|v| v != 0),
                    created_at: row.get::<_, String>(9)?,
                    updated_at: row.get::<_, String>(10)?,
                })
            },
        )
    }

    fn insert(&self, product: &Product) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO products (id, name, unit, price, category_id, pinyin, stock, min_stock, track_stock, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                &product.id,
                &product.name,
                &product.unit,
                &product.price,
                &product.category_id,
                &product.pinyin,
                &product.stock,
                &product.min_stock,
                &product.track_stock.map(|v| if v { 1 } else { 0 }),
                &product.created_at,
                &product.updated_at,
            ],
        )?;

        Ok(())
    }

    fn update(&self, product: &Product) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE products SET name = ?1, unit = ?2, price = ?3, category_id = ?4,
             pinyin = ?5, stock = ?6, min_stock = ?7, track_stock = ?8, updated_at = ?9 WHERE id = ?10",
            params![
                &product.name,
                &product.unit,
                &product.price,
                &product.category_id,
                &product.pinyin,
                &product.stock,
                &product.min_stock,
                &product.track_stock.map(|v| if v { 1 } else { 0 }),
                &product.updated_at,
                &product.id,
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM products WHERE id = ?1", params![id])?;
        Ok(())
    }
}

// ========== Customer Repository ==========

pub struct CustomerRepository {
    pub conn: DbConnection,
}

impl CustomerRepository {
    pub fn new(conn: DbConnection) -> Self {
        Self { conn }
    }

    pub fn find_by_identity(
        &self,
        phone: &str,
        license_plate: &str,
    ) -> Result<Option<Customer>> {
        let conn = self.conn.lock().unwrap();

        let result = conn.query_row(
            "SELECT id, name, phone, license_plate, address, last_purchase_at, created_at, updated_at
             FROM customers
             WHERE (?1 <> '' AND phone = ?1)
                OR (?2 <> '' AND license_plate = ?2)
             ORDER BY updated_at DESC
             LIMIT 1",
            params![phone, license_plate],
            |row: &rusqlite::Row| {
                Ok(Customer {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    phone: row.get::<_, String>(2)?,
                    license_plate: row.get::<_, String>(3)?,
                    address: row.get::<_, Option<String>>(4)?,
                    last_purchase_at: row.get::<_, Option<String>>(5)?,
                    created_at: row.get::<_, String>(6)?,
                    updated_at: row.get::<_, String>(7)?,
                })
            },
        );

        match result {
            Ok(customer) => Ok(Some(customer)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn search(&self, query: &str) -> Result<Vec<Customer>> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT id, name, phone, license_plate, address, last_purchase_at, created_at, updated_at
             FROM customers
             WHERE id NOT LIKE 'temp_%'
               AND id NOT LIKE 'order_customer_%'
               AND id NOT LIKE 'deleted_%'
               AND (name LIKE ?1 OR license_plate LIKE ?2 OR phone LIKE ?3)
             ORDER BY name"
        )?;

        let customers = stmt
            .query_map(params![pattern, pattern, pattern], |row: &rusqlite::Row| {
                Ok(Customer {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    phone: row.get::<_, String>(2)?,
                    license_plate: row.get::<_, String>(3)?,
                    address: row.get::<_, Option<String>>(4)?,
                    last_purchase_at: row.get::<_, Option<String>>(5)?,
                    created_at: row.get::<_, String>(6)?,
                    updated_at: row.get::<_, String>(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(customers)
    }
}

impl Repository<Customer> for CustomerRepository {
    fn get_all(&self) -> Result<Vec<Customer>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, phone, license_plate, address, last_purchase_at, created_at, updated_at
             FROM customers
             WHERE id NOT LIKE 'temp_%'
               AND id NOT LIKE 'order_customer_%'
               AND id NOT LIKE 'deleted_%'
             ORDER BY name"
        )?;

        let customers = stmt
            .query_map([], |row: &rusqlite::Row| {
                Ok(Customer {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    phone: row.get::<_, String>(2)?,
                    license_plate: row.get::<_, String>(3)?,
                    address: row.get::<_, Option<String>>(4)?,
                    last_purchase_at: row.get::<_, Option<String>>(5)?,
                    created_at: row.get::<_, String>(6)?,
                    updated_at: row.get::<_, String>(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(customers)
    }

    fn get_by_id(&self, id: &str) -> Result<Customer> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT id, name, phone, license_plate, address, last_purchase_at, created_at, updated_at
             FROM customers WHERE id = ?1",
            params![id],
            |row: &rusqlite::Row| {
                Ok(Customer {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    phone: row.get::<_, String>(2)?,
                    license_plate: row.get::<_, String>(3)?,
                    address: row.get::<_, Option<String>>(4)?,
                    last_purchase_at: row.get::<_, Option<String>>(5)?,
                    created_at: row.get::<_, String>(6)?,
                    updated_at: row.get::<_, String>(7)?,
                })
            },
        )
    }

    fn insert(&self, customer: &Customer) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO customers (id, name, phone, license_plate, address, last_purchase_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &customer.id,
                &customer.name,
                &customer.phone,
                &customer.license_plate,
                &customer.address,
                &customer.last_purchase_at,
                &customer.created_at,
                &customer.updated_at,
            ],
        )?;

        Ok(())
    }

    fn update(&self, customer: &Customer) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE customers SET name = ?1, phone = ?2, license_plate = ?3,
             address = ?4, updated_at = ?5 WHERE id = ?6",
            params![
                &customer.name,
                &customer.phone,
                &customer.license_plate,
                &customer.address,
                &customer.updated_at,
                &customer.id,
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM customers WHERE id = ?1", params![id])?;
        Ok(())
    }
}

// ========== Category Repository ==========

pub struct CategoryRepository {
    pub conn: DbConnection,
}

impl CategoryRepository {
    pub fn new(conn: DbConnection) -> Self {
        Self { conn }
    }

    pub fn get_tree(&self) -> Result<Vec<Category>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, parent_id, level, path, sort_order, created_at, updated_at
             FROM categories
             ORDER BY sort_order, name",
        )?;

        let categories = stmt
            .query_map([], |row: &rusqlite::Row| {
                Ok(Category {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    parent_id: row.get::<_, Option<String>>(2)?,
                    level: row.get::<_, i32>(3)?,
                    path: row.get::<_, String>(4)?,
                    sort_order: row.get::<_, i32>(5)?,
                    created_at: row.get::<_, String>(6)?,
                    updated_at: row.get::<_, String>(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(categories)
    }
    pub fn save_batch(&self, categories: &[Category]) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        {
            let mut stmt_insert = tx.prepare(
                "INSERT OR REPLACE INTO categories (id, name, parent_id, level, path, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
            )?;

            for category in categories {
                stmt_insert.execute(params![
                    &category.id,
                    &category.name,
                    &category.parent_id,
                    &category.level,
                    &category.path,
                    &category.sort_order,
                    &category.created_at,
                    &category.updated_at,
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }
}

impl Repository<Category> for CategoryRepository {
    fn get_all(&self) -> Result<Vec<Category>> {
        self.get_tree()
    }

    fn get_by_id(&self, id: &str) -> Result<Category> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT id, name, parent_id, level, path, sort_order, created_at, updated_at
             FROM categories WHERE id = ?1",
            params![id],
            |row: &rusqlite::Row| {
                Ok(Category {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    parent_id: row.get::<_, Option<String>>(2)?,
                    level: row.get::<_, i32>(3)?,
                    path: row.get::<_, String>(4)?,
                    sort_order: row.get::<_, i32>(5)?,
                    created_at: row.get::<_, String>(6)?,
                    updated_at: row.get::<_, String>(7)?,
                })
            },
        )
    }

    fn insert(&self, category: &Category) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO categories (id, name, parent_id, level, path, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &category.id,
                &category.name,
                &category.parent_id,
                &category.level,
                &category.path,
                &category.sort_order,
                &category.created_at,
                &category.updated_at,
            ],
        )?;

        Ok(())
    }

    fn update(&self, category: &Category) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE categories SET name = ?1, parent_id = ?2, level = ?3,
             path = ?4, sort_order = ?5, updated_at = ?6 WHERE id = ?7",
            params![
                &category.name,
                &category.parent_id,
                &category.level,
                &category.path,
                &category.sort_order,
                &category.updated_at,
                &category.id,
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
        Ok(())
    }
}

// ========== Template Repository ==========

pub struct TemplateRepository {
    pub conn: DbConnection,
}

impl TemplateRepository {
    pub fn new(conn: DbConnection) -> Self {
        Self { conn }
    }
}

impl Repository<TemplateConfig> for TemplateRepository {
    fn get_all(&self) -> Result<Vec<TemplateConfig>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, template_base64, file_name, filename_pattern, is_default, mappings, item_end_row, required_fields, created_at, updated_at
             FROM templates
             ORDER BY name"
        )?;

        let templates = stmt
            .query_map([], |row| {
                let mappings_json: String = row.get(6)?;
                let mut mappings: TemplateMappings =
                    serde_json::from_str(&mappings_json).map_err(|e| {
                        rusqlite::Error::ToSqlConversionFailure(
                            Box::new(e) as Box<dyn std::error::Error + Send + Sync>
                        )
                    })?;

                let item_end_row: i32 = row.get(7)?;
                // 将 item_end_row 合并到 mappings 中
                mappings.item_end_row = item_end_row;

                let required_fields_json: String = row.get(8)?;
                let required_fields: RequiredFields = serde_json::from_str(&required_fields_json)
                    .map_err(|e| {
                    rusqlite::Error::ToSqlConversionFailure(
                        Box::new(e) as Box<dyn std::error::Error + Send + Sync>
                    )
                })?;

                Ok(TemplateConfig {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    template_base64: row.get(2)?,
                    file_name: row.get(3)?,
                    filename_pattern: row.get(4)?,
                    is_default: row.get(5)?,
                    mappings,
                    required_fields,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(templates)
    }

    fn get_by_id(&self, id: &str) -> Result<TemplateConfig> {
        let conn = self.conn.lock().unwrap();

        conn.query_row(
            "SELECT id, name, template_base64, file_name, filename_pattern, is_default, mappings, item_end_row, required_fields, created_at, updated_at
             FROM templates WHERE id = ?1",
            params![id],
            |row: &rusqlite::Row| {
                let mappings_json: String = row.get(6)?;
                let mut mappings: TemplateMappings = serde_json::from_str(&mappings_json).unwrap_or_default();

                let item_end_row: i32 = row.get(7)?;
                // 将 item_end_row 合并到 mappings 中
                mappings.item_end_row = item_end_row;

                let required_fields_json: Option<String> = row.get(8).ok();
                let required_fields: RequiredFields = required_fields_json
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default();

                Ok(TemplateConfig {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    template_base64: row.get::<_, String>(2)?,
                    file_name: row.get::<_, String>(3)?,
                    filename_pattern: row.get::<_, String>(4)?,
                    is_default: row.get::<_, i32>(5)? != 0,
                    mappings,
                    required_fields,
                    created_at: row.get::<_, String>(9)?,
                    updated_at: row.get::<_, String>(10)?,
                })
            },
        )
    }

    fn insert(&self, template: &TemplateConfig) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        let mappings_json = serde_json::to_string(&template.mappings).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(
                Box::new(e) as Box<dyn std::error::Error + Send + Sync>
            )
        })?;

        let required_fields_json =
            serde_json::to_string(&template.required_fields).map_err(|e| {
                rusqlite::Error::ToSqlConversionFailure(
                    Box::new(e) as Box<dyn std::error::Error + Send + Sync>
                )
            })?;

        conn.execute(
            "INSERT INTO templates (id, name, template_base64, file_name, filename_pattern, is_default, mappings, item_end_row, required_fields, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                &template.id,
                &template.name,
                &template.template_base64,
                &template.file_name,
                &template.filename_pattern,
                &template.is_default,
                &mappings_json,
                &template.mappings.item_end_row,
                &required_fields_json,
                &template.created_at,
                &template.updated_at,
            ],
        )?;

        Ok(())
    }

    fn update(&self, template: &TemplateConfig) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        let mappings_json = serde_json::to_string(&template.mappings).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(
                Box::new(e) as Box<dyn std::error::Error + Send + Sync>
            )
        })?;

        let required_fields_json =
            serde_json::to_string(&template.required_fields).map_err(|e| {
                rusqlite::Error::ToSqlConversionFailure(
                    Box::new(e) as Box<dyn std::error::Error + Send + Sync>
                )
            })?;

        conn.execute(
            "UPDATE templates SET name = ?1, template_base64 = ?2, file_name = ?3,
             filename_pattern = ?4, is_default = ?5, mappings = ?6, item_end_row = ?7, required_fields = ?8, updated_at = ?9 WHERE id = ?10",
            params![
                &template.name,
                &template.template_base64,
                &template.file_name,
                &template.filename_pattern,
                &template.is_default,
                &mappings_json,
                &template.mappings.item_end_row,
                &required_fields_json,
                &template.updated_at,
                &template.id,
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM templates WHERE id = ?1", params![id])?;
        Ok(())
    }
}

// ========== Settings Repository ==========

pub struct SettingsRepository {
    pub conn: DbConnection,
}

impl SettingsRepository {
    pub fn new(conn: DbConnection) -> Self {
        Self { conn }
    }

    pub fn get_settings(&self) -> Result<Option<AppSettings>> {
        let conn = self.conn.lock().unwrap();

        let result = conn.query_row(
            "SELECT id, data_directory, output_directory, backup_directory, font_size, theme,
              remember_window, date_format, excel_date_format, order_number_format, order_number_prefix,
              order_number_reset_daily, order_number_digits, retain_days, auto_backup, backup_interval,
              backup_keep_count, default_template_id, default_category_id,
              excel_filename_format, auto_open_excel, skip_save_dialog,
              template_validation, updated_at
              FROM app_settings WHERE id = 'settings'",
            [],
            |row: &rusqlite::Row| {
                Ok(AppSettings {
                    id: row.get::<_, String>(0)?,
                    data_directory: row.get::<_, String>(1)?,
                    output_directory: row.get::<_, String>(2)?,
                    backup_directory: row.get::<_, String>(3)?,
                    font_size: row.get::<_, i32>(4)?,
                    theme: row.get::<_, String>(5)?,
                    remember_window: row.get::<_, i32>(6)? != 0,
                    date_format: row.get::<_, String>(7)?,
                    excel_date_format: row.get::<_, String>(8)?,
                    order_number_format: row.get::<_, String>(9)?,
                    order_number_prefix: row.get::<_, String>(10)?,
                    order_number_reset_daily: row.get::<_, i32>(11)? != 0,
                    order_number_digits: row.get::<_, i32>(12)?,
                    retain_days: row.get::<_, i32>(13)?,
                    auto_backup: row.get::<_, i32>(14)? != 0,
                    backup_interval: row.get::<_, i32>(15)?,
                    backup_keep_count: row.get::<_, i32>(16)?,
                    default_template_id: row.get::<_, String>(17)?,
                    default_category_id: row.get::<_, String>(18)?,
                    excel_filename_format: row.get::<_, String>(19)?,
                    auto_open_excel: row.get::<_, i32>(20)? != 0,
                    skip_save_dialog: row.get::<_, i32>(21)? != 0,
                    template_validation: {
                        let val: Option<String> = row.get(22)?;
                        val.and_then(|v| serde_json::from_str::<crate::models::RequiredFields>(&v).ok())
                    },
                    updated_at: row.get::<_, String>(23)?,
                })
            },
        );

        match result {
            Ok(settings) => Ok(Some(settings)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR REPLACE INTO app_settings
             (id, data_directory, output_directory, backup_directory, font_size, theme,
              remember_window, date_format, excel_date_format, order_number_format, order_number_prefix,
              order_number_reset_daily, order_number_digits, retain_days, auto_backup, backup_interval,
              backup_keep_count, default_template_id, default_category_id,
              excel_filename_format, auto_open_excel, skip_save_dialog,
              template_validation, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            params![
                &settings.id,
                &settings.data_directory,
                &settings.output_directory,
                &settings.backup_directory,
                &settings.font_size,
                &settings.theme,
                &settings.remember_window,
                &settings.date_format,
                &settings.excel_date_format,
                &settings.order_number_format,
                &settings.order_number_prefix,
                &settings.order_number_reset_daily,
                &settings.order_number_digits,
                &settings.retain_days,
                &settings.auto_backup,
                &settings.backup_interval,
                &settings.backup_keep_count,
                &settings.default_template_id,
                &settings.default_category_id,
                &settings.excel_filename_format,
                &settings.auto_open_excel,
                &settings.skip_save_dialog,
                &serde_json::to_string(&settings.template_validation.clone().unwrap_or_default()).unwrap_or_else(|_| "{}".to_string()),
                &settings.updated_at,
            ],
        )?;

        Ok(())
    }
}

// ========== Order Repository ==========

pub struct OrderRepository {
    pub conn: DbConnection,
}

impl OrderRepository {
    pub fn new(conn: DbConnection) -> Self {
        Self { conn }
    }

    pub fn get_order_items(&self, order_id: &str) -> Result<Vec<OrderItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, product_id, name, unit, price, quantity, discount_price, remark, sort_value
             FROM order_items WHERE order_id = ?1 ORDER BY sort_value",
        )?;
        let items = stmt
            .query_map(params![order_id], |row: &rusqlite::Row| {
                Ok(OrderItem {
                    id: row.get::<_, String>(1)?, // 映射数据库中的 product_id 回到结构体的 id
                    name: row.get::<_, String>(2)?,
                    unit: row.get::<_, String>(3)?,
                    price: row.get::<_, f64>(4)?,
                    quantity: row.get::<_, f64>(5)?,
                    category: "".to_string(),
                    discount_price: row.get::<_, Option<f64>>(6)?,
                    remark: row.get::<_, Option<String>>(7)?,
                    sort_value: row.get::<_, i64>(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    pub fn generate_order_number(
        &self,
        settings: &AppSettings,
        _order_date: &str,
    ) -> Result<String> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now();

        let format = &settings.order_number_format;

        // 第一步：替换日期变量（使用当前日期）
        let mut result = format.clone();
        result = result.replace("{YYYY}", &now.format("%Y").to_string());
        result = result.replace("{YY}", &now.format("%y").to_string());
        result = result.replace("{MM}", &now.format("%m").to_string());
        result = result.replace("{DD}", &now.format("%d").to_string());
        result = result.replace("{M}", &now.format("%-m").to_string());
        result = result.replace("{D}", &now.format("%-d").to_string());

        // 第二步：处理序号 {SEQ} 或 {SEQ:N}
        let seq_re = regex::Regex::new(r"\{SEQ(?::(\d+))?\}").unwrap();

        if let Some(caps) = seq_re.captures(&result) {
            // 提取序号位数（默认6位）
            let seq_len = caps
                .get(1)
                .and_then(|m| m.as_str().parse::<usize>().ok())
                .unwrap_or(settings.order_number_digits as usize);

            // 第三步：查询最后的订单号（使用当前日期）
            let today = now.format("%Y-%m-%d").to_string();
            let last_number: Option<String> = if settings.order_number_reset_daily {
                // 每日重置：查询今天的最后订单号
                conn.query_row(
                    "SELECT order_number FROM orders WHERE date = ?1 ORDER BY created_at DESC LIMIT 1",
                    params![today],
                    |row: &rusqlite::Row| row.get::<_, String>(0),
                ).ok()
            } else {
                // 不重置：查询所有订单的最后订单号
                conn.query_row(
                    "SELECT order_number FROM orders ORDER BY created_at DESC LIMIT 1",
                    [],
                    |row: &rusqlite::Row| row.get::<_, String>(0),
                ).ok()
            };

            // 第四步：提取序号（健壮的正则提取）
            let next_seq = if let Some(last_num) = last_number {
                // 使用正则提取所有数字序列，取最后一个
                let num_re = regex::Regex::new(r"(\d+)").unwrap();
                let numbers: Vec<u32> = num_re
                    .find_iter(&last_num)
                    .filter_map(|m| m.as_str().parse::<u32>().ok())
                    .collect();

                if let Some(&last_seq) = numbers.last() {
                    last_seq + 1
                } else {
                    1
                }
            } else {
                1
            };

            // 第五步：替换 {SEQ:N} 为格式化的序号
            let seq_str = format!("{:0width$}", next_seq, width = seq_len);
            let seq_pattern = if let Some(len_match) = caps.get(1) {
                format!("{{SEQ:{}}}", len_match.as_str())
            } else {
                "{SEQ}".to_string()
            };
            result = result.replace(&seq_pattern, &seq_str);
        }

        Ok(result)
    }
}

impl Repository<Order> for OrderRepository {
    fn get_all(&self) -> Result<Vec<Order>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, order_number, date, customer_id, total_amount, remark, template_id, status, created_at, updated_at
             FROM orders ORDER BY created_at DESC"
        )?;
        let orders = stmt
            .query_map([], |row: &rusqlite::Row| {
                Ok(Order {
                    id: row.get::<_, String>(0)?,
                    order_number: row.get::<_, String>(1)?,
                    date: row.get::<_, String>(2)?,
                    customer_id: row.get::<_, String>(3)?,
                    customer: Customer {
                        id: "".to_string(),
                        name: "".to_string(),
                        phone: "".to_string(),
                        license_plate: "".to_string(),
                        address: None,
                        last_purchase_at: None,
                        created_at: "".to_string(),
                        updated_at: "".to_string(),
                    },
                    items: vec![],
                    total_amount: row.get::<_, f64>(4)?,
                    remark: row.get::<_, Option<String>>(5)?,
                    template_id: row.get::<_, Option<String>>(6)?,
                    status: row.get::<_, String>(7)?,
                    created_at: row.get::<_, String>(8)?,
                    updated_at: row.get::<_, String>(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(orders)
    }

    fn get_by_id(&self, id: &str) -> Result<Order> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, order_number, date, customer_id, total_amount, remark, template_id, status, created_at, updated_at FROM orders WHERE id = ?1",
            params![id],
            |row: &rusqlite::Row| {
                Ok(Order {
                    id: row.get::<_, String>(0)?,
                    order_number: row.get::<_, String>(1)?,
                    date: row.get::<_, String>(2)?,
                    customer_id: row.get::<_, String>(3)?,
                    customer: Customer {
                        id: "".to_string(),
                        name: "".to_string(),
                        phone: "".to_string(),
                        license_plate: "".to_string(),
                        address: None,
                        last_purchase_at: None,
                        created_at: "".to_string(),
                        updated_at: "".to_string(),
                    },
                    items: vec![],
                    total_amount: row.get::<_, f64>(4)?,
                    remark: row.get::<_, Option<String>>(5)?,
                    template_id: row.get::<_, Option<String>>(6)?,
                    status: row.get::<_, String>(7)?,
                    created_at: row.get::<_, String>(8)?,
                    updated_at: row.get::<_, String>(9)?,
                })
            },
        )
    }

    fn insert(&self, order: &Order) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO orders (id, order_number, date, customer_id, total_amount, remark, template_id, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                &order.id, &order.order_number, &order.date, &order.customer_id,
                &order.total_amount, &order.remark, &order.template_id, &order.status,
                &order.created_at, &order.updated_at,
            ],
        )?;
        for item in &order.items {
            conn.execute(
                "INSERT INTO order_items (id, order_id, product_id, name, unit, price, quantity, discount_price, remark, sort_value)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    &format!("{}_{}", order.id, item.id), &order.id, &item.id,
                    &item.name, &item.unit, &item.price, &item.quantity,
                    &item.discount_price, &item.remark, &item.sort_value,
                ],
            )?;
        }
        Ok(())
    }

    fn update(&self, order: &Order) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE orders SET order_number = ?1, date = ?2, customer_id = ?3, total_amount = ?4, remark = ?5, template_id = ?6, status = ?7, updated_at = ?8 WHERE id = ?9",
            params![
                &order.order_number, &order.date, &order.customer_id, &order.total_amount,
                &order.remark, &order.template_id, &order.status, &order.updated_at, &order.id,
            ],
        )?;
        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM orders WHERE id = ?1", params![id])?;
        Ok(())
    }
}

// ========== Remark Preset Repository ==========

pub struct RemarkPresetRepository {
    pub conn: DbConnection,
}

impl RemarkPresetRepository {
    pub fn new(conn: DbConnection) -> Self {
        Self { conn }
    }

    pub fn get_by_type(&self, preset_type: &str) -> Result<Vec<RemarkPreset>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content, type, sort_order, use_count, created_at, updated_at
             FROM remark_presets WHERE type = ?1 ORDER BY sort_order ASC",
        )?;
        let presets = stmt
            .query_map(params![preset_type], |row: &rusqlite::Row| {
                Ok(RemarkPreset {
                    id: row.get::<_, String>(0)?,
                    content: row.get::<_, String>(1)?,
                    r#type: row.get::<_, String>(2)?,
                    sort_order: row.get::<_, i32>(3)?,
                    use_count: row.get::<_, i32>(4)?,
                    created_at: row.get::<_, String>(5)?,
                    updated_at: row.get::<_, String>(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(presets)
    }

    pub fn increment_use_count(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE remark_presets SET use_count = use_count + 1 WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }
}

impl Repository<RemarkPreset> for RemarkPresetRepository {
    fn get_all(&self) -> Result<Vec<RemarkPreset>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content, type, sort_order, use_count, created_at, updated_at
             FROM remark_presets ORDER BY type, sort_order ASC",
        )?;
        let presets = stmt
            .query_map([], |row: &rusqlite::Row| {
                Ok(RemarkPreset {
                    id: row.get::<_, String>(0)?,
                    content: row.get::<_, String>(1)?,
                    r#type: row.get::<_, String>(2)?,
                    sort_order: row.get::<_, i32>(3)?,
                    use_count: row.get::<_, i32>(4)?,
                    created_at: row.get::<_, String>(5)?,
                    updated_at: row.get::<_, String>(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(presets)
    }

    fn get_by_id(&self, id: &str) -> Result<RemarkPreset> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, content, type, sort_order, use_count, created_at, updated_at FROM remark_presets WHERE id = ?1",
            params![id],
            |row: &rusqlite::Row| {
                Ok(RemarkPreset {
                    id: row.get::<_, String>(0)?,
                    content: row.get::<_, String>(1)?,
                    r#type: row.get::<_, String>(2)?,
                    sort_order: row.get::<_, i32>(3)?,
                    use_count: row.get::<_, i32>(4)?,
                    created_at: row.get::<_, String>(5)?,
                    updated_at: row.get::<_, String>(6)?,
                })
            },
        )
    }

    fn insert(&self, preset: &RemarkPreset) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO remark_presets (id, content, type, sort_order, use_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &preset.id, &preset.content, &preset.r#type, &preset.sort_order,
                &preset.use_count, &preset.created_at, &preset.updated_at,
            ],
        )?;
        Ok(())
    }

    fn update(&self, preset: &RemarkPreset) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE remark_presets SET content = ?1, type = ?2, sort_order = ?3, updated_at = ?4 WHERE id = ?5",
            params![&preset.content, &preset.r#type, &preset.sort_order, &preset.updated_at, &preset.id],
        )?;
        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM remark_presets WHERE id = ?1", params![id])?;
        Ok(())
    }
}

// ========== Unit Preset Repository ==========

pub struct UnitPresetRepository {
    pub conn: DbConnection,
}

impl UnitPresetRepository {
    pub fn new(conn: DbConnection) -> Self {
        Self { conn }
    }
}

impl Repository<UnitPreset> for UnitPresetRepository {
    fn get_all(&self) -> Result<Vec<UnitPreset>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, sort_order, use_count, created_at, updated_at
             FROM unit_presets ORDER BY sort_order ASC",
        )?;
        let presets = stmt
            .query_map([], |row: &rusqlite::Row| {
                Ok(UnitPreset {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    sort_order: row.get::<_, i32>(2)?,
                    use_count: row.get::<_, i32>(3)?,
                    created_at: row.get::<_, String>(4)?,
                    updated_at: row.get::<_, String>(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(presets)
    }

    fn get_by_id(&self, id: &str) -> Result<UnitPreset> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, sort_order, use_count, created_at, updated_at FROM unit_presets WHERE id = ?1",
            params![id],
            |row: &rusqlite::Row| {
                Ok(UnitPreset {
                    id: row.get::<_, String>(0)?,
                    name: row.get::<_, String>(1)?,
                    sort_order: row.get::<_, i32>(2)?,
                    use_count: row.get::<_, i32>(3)?,
                    created_at: row.get::<_, String>(4)?,
                    updated_at: row.get::<_, String>(5)?,
                })
            },
        )
    }

    fn insert(&self, preset: &UnitPreset) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO unit_presets (id, name, sort_order, use_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                &preset.id,
                &preset.name,
                &preset.sort_order,
                &preset.use_count,
                &preset.created_at,
                &preset.updated_at,
            ],
        )?;
        Ok(())
    }

    fn update(&self, preset: &UnitPreset) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE unit_presets SET name = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4",
            params![
                &preset.name,
                &preset.sort_order,
                &preset.updated_at,
                &preset.id
            ],
        )?;
        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM unit_presets WHERE id = ?1", params![id])?;
        Ok(())
    }
}
