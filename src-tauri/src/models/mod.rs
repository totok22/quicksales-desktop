use serde::{Deserialize, Serialize};

// ========== 数据模型 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: String,
    pub name: String,
    pub unit: String,
    pub price: f64,
    #[serde(alias = "category_id")]
    pub category_id: String,
    pub pinyin: Option<String>,
    pub stock: Option<f64>, // 库存数量
    #[serde(alias = "min_stock")]
    pub min_stock: Option<f64>, // 最低库存警告
    #[serde(alias = "track_stock")]
    pub track_stock: Option<bool>, // 是否跟踪库存
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    #[serde(alias = "parent_id")]
    pub parent_id: Option<String>,
    pub level: i32,
    pub path: String,
    #[serde(alias = "sort_order")]
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub phone: String,
    #[serde(alias = "license_plate")]
    pub license_plate: String,
    pub address: Option<String>,
    #[serde(alias = "last_purchase_at")]
    pub last_purchase_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderItem {
    pub id: String,
    pub name: String,
    pub unit: String,
    pub price: f64,
    pub quantity: f64,
    pub category: String,
    #[serde(alias = "discount_price")]
    pub discount_price: Option<f64>,
    pub remark: Option<String>,
    #[serde(alias = "sort_value")]
    pub sort_value: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Order {
    pub id: String,
    #[serde(alias = "order_number")]
    pub order_number: String,
    pub date: String,
    #[serde(alias = "customer_id")]
    pub customer_id: String,
    pub customer: Customer,
    pub items: Vec<OrderItem>,
    #[serde(alias = "total_amount")]
    pub total_amount: f64,
    pub remark: Option<String>,
    #[serde(alias = "template_id")]
    pub template_id: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateConfig {
    pub id: String,
    pub name: String,
    #[serde(alias = "template_base64")]
    pub template_base64: String,
    #[serde(alias = "file_name")]
    pub file_name: String,
    #[serde(alias = "filename_pattern")]
    pub filename_pattern: String,
    #[serde(alias = "is_default")]
    pub is_default: bool,
    #[serde(default)]
    pub mappings: TemplateMappings,
    #[serde(alias = "required_fields", default)]
    pub required_fields: RequiredFields,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequiredFields {
    #[serde(alias = "customer_name", alias = "customerName", default)]
    pub require_customer_name: bool,
    #[serde(alias = "customer_phone", alias = "customerPhone", default)]
    pub require_customer_phone: bool,
    #[serde(alias = "customer_plate", alias = "customerPlate", default)]
    pub require_customer_plate: bool,
    #[serde(alias = "date", default)]
    pub require_date: bool,
    #[serde(alias = "order_number", alias = "orderNumber", default)]
    pub require_order_number: bool,
    #[serde(alias = "order_remark", alias = "orderRemark", default)]
    pub require_order_remark: bool,
    #[serde(alias = "total_amount", alias = "totalAmount", default)]
    pub require_total_amount: bool,
    #[serde(alias = "item_name", alias = "itemName", default)]
    pub require_item_name: bool,
    #[serde(alias = "item_unit", alias = "itemUnit", default)]
    pub require_item_unit: bool,
    #[serde(alias = "item_quantity", alias = "itemQuantity", default)]
    pub require_item_quantity: bool,
    #[serde(alias = "item_price", alias = "itemPrice", default)]
    pub require_item_price: bool,
    #[serde(alias = "item_total", alias = "itemTotal", default)]
    pub require_item_total: bool,
    #[serde(alias = "item_remark", alias = "itemRemark", default)]
    pub require_item_remark: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TemplateMappings {
    #[serde(alias = "customer_name", default)]
    pub customer_name: String,
    #[serde(alias = "customer_phone", default)]
    pub customer_phone: String,
    #[serde(alias = "customer_plate", default)]
    pub customer_plate: String,
    #[serde(default)]
    pub date: String,
    #[serde(alias = "order_number", default)]
    pub order_number: String,
    #[serde(alias = "order_remark", default)]
    pub order_remark: String,
    #[serde(alias = "total_amount", default)]
    pub total_amount: String,
    #[serde(alias = "item_start_row", default)]
    pub item_start_row: i32,
    #[serde(alias = "item_end_row", default)]
    pub item_end_row: i32,
    #[serde(default)]
    pub columns: TemplateColumns,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TemplateColumns {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub unit: String,
    #[serde(default)]
    pub quantity: String,
    #[serde(default)]
    pub price: String,
    #[serde(default)]
    pub total: String,
    #[serde(default)]
    pub remark: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemarkPreset {
    pub id: String,
    pub content: String,
    pub r#type: String, // "item" | "order"
    #[serde(alias = "sort_order")]
    pub sort_order: i32,
    #[serde(alias = "use_count")]
    pub use_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitPreset {
    pub id: String,
    pub name: String,
    #[serde(alias = "sort_order")]
    pub sort_order: i32,
    #[serde(alias = "use_count")]
    pub use_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub id: String,
    #[serde(alias = "data_directory")]
    pub data_directory: String,
    #[serde(alias = "output_directory")]
    pub output_directory: String,
    #[serde(alias = "backup_directory")]
    pub backup_directory: String,
    #[serde(alias = "font_size")]
    pub font_size: i32,
    pub theme: String,
    #[serde(alias = "remember_window")]
    pub remember_window: bool,
    #[serde(alias = "date_format")]
    pub date_format: String,
    #[serde(alias = "excel_date_format")]
    pub excel_date_format: String,
    #[serde(alias = "order_number_format")]
    pub order_number_format: String,
    #[serde(alias = "order_number_prefix")]
    pub order_number_prefix: String,
    #[serde(alias = "order_number_reset_daily")]
    pub order_number_reset_daily: bool,
    #[serde(alias = "order_number_digits")]
    pub order_number_digits: i32,
    #[serde(alias = "retain_days")]
    pub retain_days: i32,
    #[serde(alias = "auto_backup")]
    pub auto_backup: bool,
    #[serde(alias = "backup_interval")]
    pub backup_interval: i32,
    #[serde(alias = "backup_keep_count")]
    pub backup_keep_count: i32,
    #[serde(alias = "default_template_id")]
    pub default_template_id: String,
    #[serde(alias = "default_category_id")]
    pub default_category_id: String,
    #[serde(alias = "excel_filename_format")]
    pub excel_filename_format: String,
    #[serde(alias = "auto_open_excel")]
    pub auto_open_excel: bool,
    #[serde(alias = "skip_save_dialog")]
    pub skip_save_dialog: bool,
    #[serde(alias = "template_validation")]
    pub template_validation: Option<RequiredFields>,
    pub updated_at: String,
}
