// Utility function for generating unique IDs
// Currently unused but kept for future use
#[allow(dead_code)]
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
