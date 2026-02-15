import { invoke } from '@tauri-apps/api/core'
import type { Product, Customer, Category } from '../types'

// ========== 商品服务 ==========

export const productService = {
  // 获取所有商品
  getAll: async (): Promise<Product[]> => {
    return invoke('get_all_products')
  },

  // 根据ID获取商品
  getById: async (id: string): Promise<Product> => {
    return invoke('get_product_by_id', { id })
  },

  // 搜索商品
  search: async (query: string): Promise<Product[]> => {
    return invoke('search_products', { query })
  },

  // 根据分类获取商品
  getByCategory: async (categoryId: string): Promise<Product[]> => {
    return invoke('get_products_by_category', { categoryId })
  },

  // 保存商品（新增或更新）
  save: async (product: Product): Promise<void> => {
    return invoke('save_product', { product })
  },

  // 删除商品
  delete: async (id: string): Promise<void> => {
    return invoke('delete_product', { id })
  },

  // 批量删除商品
  batchDelete: async (ids: string[]): Promise<void> => {
    return invoke('batch_delete_products', { ids })
  },
}

// ========== 客户服务 ==========

export const customerService = {
  // 获取所有客户
  getAll: async (): Promise<Customer[]> => {
    return invoke('get_all_customers')
  },

  // 根据ID获取客户
  getById: async (id: string): Promise<Customer> => {
    return invoke('get_customer_by_id', { id })
  },

  // 搜索客户
  search: async (query: string): Promise<Customer[]> => {
    return invoke('search_customers', { query })
  },

  // 保存客户（新增或更新）
  save: async (customer: Customer): Promise<void> => {
    return invoke('save_customer', { customer })
  },

  // 删除客户
  delete: async (id: string): Promise<void> => {
    return invoke('delete_customer', { id })
  },

  // 批量删除客户
  batchDelete: async (ids: string[]): Promise<void> => {
    return invoke('batch_delete_customers', { ids })
  },
}

// ========== 分类服务 ==========

export const categoryService = {
  // 获取所有分类
  getAll: async (): Promise<Category[]> => {
    return invoke('get_all_categories')
  },

  // 根据ID获取分类
  getById: async (id: string): Promise<Category> => {
    return invoke('get_category_by_id', { id })
  },

  // 获取分类树
  getTree: async (): Promise<Category[]> => {
    return invoke('get_category_tree')
  },

  // 保存分类（新增或更新）
  save: async (category: Category): Promise<void> => {
    return invoke('save_category', { category })
  },

  // 删除分类
  delete: async (id: string): Promise<void> => {
    return invoke('delete_category', { id })
  },
}
