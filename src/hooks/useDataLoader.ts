import { useEffect, useCallback, useRef } from 'react'
import { useStore } from '../stores/useStore'
import { productService, categoryService, customerService } from '../services/api'
import type { Product, Customer, Category } from '../types'
import { invoke } from '@tauri-apps/api/core'
import type { RemarkPreset, UnitPreset } from '../types'

/**
 * 数据加载Hook - 在应用启动时加载所有必要数据
 */
export function useDataLoader() {
  const { setProducts, setCustomers, setCategories, setRemarkPresets, setUnitPresets, setLoading, loadTemplates, loadSettings } = useStore()
  const isInitialized = useRef(false)

  const loadMockData = useCallback(() => {
    console.log('🎭 加载模拟数据...')
    // 模拟数据（开发时使用）
    const mockCategories: Category[] = [
      { id: '1', name: '保养', parentId: undefined, level: 0, path: '保养', sortOrder: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', name: '配件', parentId: undefined, level: 0, path: '配件', sortOrder: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]

    const mockProducts: Product[] = [
      { id: '1', name: '全合成机油 5W-40', unit: '升', price: 85, categoryId: '1', pinyin: 'jiyou', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', name: '空气滤芯', unit: '个', price: 45, categoryId: '1', pinyin: 'konglv', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]

    const mockCustomers: Customer[] = [
      { id: '1', name: '张三', phone: '13800138000', licensePlate: '京A-88888', address: '', lastPurchaseAt: undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]

    setCategories(mockCategories)
    setProducts(mockProducts)
    setCustomers(mockCustomers)

    console.log('⚠️ 使用模拟数据')
  }, [setCategories, setProducts, setCustomers])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      console.log('📡 正在从后端获取数据...')

      // 先加载设置（获取数据库中的默认模板ID）
      await loadSettings()

      // 然后加载模板（会检查并同步默认模板ID到store中）
      await loadTemplates()

      // 然后并行加载其他数据
      const [products, customers, categories, remarkPresets, unitPresets] = await Promise.all([
        productService.getAll().catch(err => {
          console.error('获取商品失败:', err)
          return []
        }),
        customerService.getAll().catch(err => {
          console.error('获取客户失败:', err)
          return []
        }),
        categoryService.getAll().catch(err => {
          console.error('获取分类失败:', err)
          return []
        }),
        invoke<RemarkPreset[]>('get_all_remark_presets').catch(err => {
          console.error('获取备注预设失败:', err)
          return []
        }),
        invoke<UnitPreset[]>('get_all_unit_presets').catch(err => {
          console.error('获取单位预设失败:', err)
          return []
        }),
      ])

      setProducts(products)
      setCustomers(customers)
      setCategories(categories)
      // templates 已由 loadTemplates 设置
      setRemarkPresets(remarkPresets)
      setUnitPresets(unitPresets)

      console.log('✅ 数据加载成功:', {
        products: products.length,
        customers: customers.length,
        categories: categories.length,
        remarkPresets: remarkPresets.length,
        unitPresets: unitPresets.length,
      })
    } catch (error) {
      console.error('❌ 数据加载失败:', error)
      // 如果Tauri命令不可用（开发模式），使用模拟数据
      console.log('📝 切换到模拟数据')
      loadMockData()
    } finally {
      setLoading(false)
      console.log('✨ 数据加载完成')
    }
  }, [setLoading, setProducts, setCustomers, setCategories, setRemarkPresets, setUnitPresets, loadTemplates, loadSettings])

  useEffect(() => {
    // 防止 React 18 Strict Mode 下重复加载
    if (isInitialized.current) return
    isInitialized.current = true

    console.log('🔄 开始加载数据...')
    loadData()
  }, [loadData])
}
