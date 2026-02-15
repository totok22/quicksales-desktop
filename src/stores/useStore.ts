import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { invoke } from '@tauri-apps/api/core'
import { Product, Customer, Order, Category, TemplateConfig, RemarkPreset, UnitPreset, AppSettings, ViewState, DraftOrderState, OrderTab } from '../types'

// 创建默认草稿订单
const createDefaultDraftOrder = (defaultTemplateId: string = ''): DraftOrderState => ({
  cart: [],
  customer: null,
  date: new Date().toISOString().split('T')[0],
  remark: '',
  templateId: defaultTemplateId,
})

// 创建新标签页
const createNewTab = (orderId?: string, order?: Order, defaultTemplateId: string = ''): OrderTab => {
  const now = new Date().toISOString()
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
    orderId,
    title: orderId ? order?.orderNumber || `订单-${orderId.slice(0, 6)}` : '新订单',
    draftOrder: order ? {
      cart: order.items,
      customer: order.customer,
      date: order.date,
      remark: order.remark,
      templateId: order.templateId || defaultTemplateId,  // ✅ 确保有默认值
      orderNumber: order.orderNumber,
    } : createDefaultDraftOrder(defaultTemplateId),
    isActive: true,
    isDirty: false,
    createdAt: now,
    updatedAt: now,
  }
}

interface AppState {
  // 当前视图
  currentView: ViewState
  setCurrentView: (view: ViewState) => void

  // 数据
  products: Product[]
  customers: Customer[]
  orders: Order[]
  categories: Category[]
  templates: TemplateConfig[]
  remarkPresets: RemarkPreset[]
  unitPresets: UnitPreset[]
  settings: AppSettings

  // 标签页状态
  orderTabs: OrderTab[]
  activeTabId: string

  // 标签页操作方法
  createNewTab: (orderId?: string, order?: Order) => void
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
  updateActiveTab: (updates: Partial<DraftOrderState>) => void
  updateActiveTabTitle: (title: string) => void
  markActiveTabDirty: (isDirty: boolean) => void
  getActiveTab: () => OrderTab | undefined
  clearActiveTabCart: () => void
  updateActiveTabOrderId: (orderId: string) => void

  // 加载状态
  loading: boolean
  setLoading: (loading: boolean) => void

  // 数据更新方法
  setProducts: (products: Product[]) => void
  setCustomers: (customers: Customer[]) => void
  setOrders: (orders: Order[]) => void
  setCategories: (categories: Category[]) => void
  setTemplates: (templates: TemplateConfig[]) => void
  setRemarkPresets: (presets: RemarkPreset[]) => void
  setUnitPresets: (presets: UnitPreset[]) => void
  setSettings: (settings: AppSettings) => void

  // 数据加载方法
  loadCustomers: () => Promise<void>
  loadProducts: () => Promise<void>
  loadCategories: () => Promise<void>
  loadRemarkPresets: () => Promise<void>
  loadTemplates: () => Promise<void>
  loadUnitPresets: () => Promise<void>
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
  updateRemarkPresets: (presets: RemarkPreset[]) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentView: 'order',
      setCurrentView: (view) => set({ currentView: view }),

      products: [],
      customers: [],
      orders: [],
      categories: [],
      templates: [],
      remarkPresets: [],
      unitPresets: [],
      settings: {
        id: 'settings',
        dataDirectory: '',
        outputDirectory: '',
        backupDirectory: '',
        fontSize: 16,
        theme: 'light',
        rememberWindow: true,
        dateFormat: 'YYYY-MM-DD',
        excelDateFormat: 'YYYY.MM.DD',
        orderNumberFormat: 'NO.{SEQ:6}',
        orderNumberPrefix: '',
        orderNumberResetDaily: true,
        orderNumberDigits: 6,
        retainDays: 0,
        autoBackup: true,
        backupInterval: 7,
        backupKeepCount: 10,
        defaultTemplateId: '',
        defaultCategoryId: '',
        excelFilenameFormat: '{date}_{customerName}_{orderNumber}',
        autoOpenExcel: false,
        skipSaveDialog: false,

        // 模板验证规则默认配置
        templateValidation: {
          requireCustomerName: false,    // 客户姓名 - 可选（模板可能自带）
          requireCustomerPhone: false,   // 客户电话 - 可选
          requireCustomerPlate: false,   // 车牌号 - 可选
          requireDate: true,             // 日期 - 必填
          requireOrderNumber: true,      // 订单号 - 必填
          requireOrderRemark: false,     // 订单备注 - 可选
          requireTotalAmount: false,     // 总金额 - 可选（通常计算得出）
          requireItemName: true,         // 商品名称 - 必填
          requireItemUnit: false,         // 单位 - 可选
          requireItemQuantity: true,     // 数量 - 必填
          requireItemPrice: true,        // 单价 - 必填
          requireItemTotal: false,       // 总价 - 可选（通常计算得出）
          requireItemRemark: false,      // 商品备注 - 可选
        },

        updatedAt: new Date().toISOString(),
      },

      // 初始化时创建第一个标签页（由于使用了persist，这会被localStorage覆盖）
      orderTabs: [],
      activeTabId: '',

      // 创建新标签页
      createNewTab: (orderId?: string, order?: Order) => {
        const state = get()
        const defaultTemplateId = state.settings.defaultTemplateId || ''  // ✅ 从当前状态读取
        const newTab = createNewTab(orderId, order, defaultTemplateId)

        // 将其他标签页设为非激活
        const updatedTabs = state.orderTabs.map(tab => ({
          ...tab,
          isActive: false,
        }))

        // 如果标签页数量达到4个，移除最旧的未修改标签页
        let finalTabs = [...updatedTabs]
        if (finalTabs.length >= 4) {
          // 找到最旧的未修改标签页（非激活状态）
          const oldestCleanTab = finalTabs
            .filter(tab => !tab.isDirty && tab.id !== state.activeTabId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]

          if (oldestCleanTab) {
            finalTabs = finalTabs.filter(tab => tab.id !== oldestCleanTab.id)
          } else {
            // 如果所有标签页都有未保存修改，移除最旧的
            finalTabs = finalTabs
              .filter(tab => tab.id !== state.activeTabId)
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .slice(0, 3)
            finalTabs.push(updatedTabs.find(tab => tab.id === state.activeTabId)!)
          }
        }

        finalTabs.push(newTab)

        set({
          orderTabs: finalTabs,
          activeTabId: newTab.id,
        })
      },

      // 关闭标签页
      closeTab: (tabId: string) => {
        const state = get()
        const tabs = state.orderTabs
        const tabToClose = tabs.find(t => t.id === tabId)

        // 检查是否有未保存的修改
        if (tabToClose?.isDirty) {
          if (!confirm('此标签页有未保存的修改，确定要关闭吗？')) {
            return
          }
        }

        // 如果是最后一个标签页，不允许关闭
        if (tabs.length === 1) {
          alert('至少需要保留一个标签页')
          return
        }

        // 移除标签页
        const filteredTabs = tabs.filter(t => t.id !== tabId)

        // 如果关闭的是当前激活标签页，激活另一个
        let newActiveTabId = state.activeTabId
        if (tabId === state.activeTabId) {
          // 优先激活右侧标签页，如果没有则激活左侧
          const closedIndex = tabs.findIndex(t => t.id === tabId)
          const newActiveIndex = closedIndex < filteredTabs.length ? closedIndex : filteredTabs.length - 1
          newActiveTabId = filteredTabs[newActiveIndex].id
        }

        // 更新激活状态
        const finalTabs = filteredTabs.map(tab => ({
          ...tab,
          isActive: tab.id === newActiveTabId,
        }))

        set({
          orderTabs: finalTabs,
          activeTabId: newActiveTabId,
        })
      },

      // 切换标签页
      switchTab: (tabId: string) => {
        const state = get()
        const updatedTabs = state.orderTabs.map(tab => ({
          ...tab,
          isActive: tab.id === tabId,
        }))

        set({
          orderTabs: updatedTabs,
          activeTabId: tabId,
        })
      },

      // 更新当前激活标签页的订单数据
      updateActiveTab: (updates: Partial<DraftOrderState>) => {
        const state = get()
        const updatedTabs = state.orderTabs.map(tab => {
          if (tab.id === state.activeTabId) {
            return {
              ...tab,
              draftOrder: { ...tab.draftOrder, ...updates },
              isDirty: true,
              updatedAt: new Date().toISOString(),
            }
          }
          return tab
        })

        set({ orderTabs: updatedTabs })
      },

      // 更新当前激活标签页的标题
      updateActiveTabTitle: (title: string) => {
        const state = get()
        const updatedTabs = state.orderTabs.map(tab => {
          if (tab.id === state.activeTabId) {
            return { ...tab, title, updatedAt: new Date().toISOString() }
          }
          return tab
        })

        set({ orderTabs: updatedTabs })
      },

      // 标记当前激活标签页是否有未保存修改
      markActiveTabDirty: (isDirty: boolean) => {
        const state = get()
        const updatedTabs = state.orderTabs.map(tab => {
          if (tab.id === state.activeTabId) {
            return { ...tab, isDirty, updatedAt: new Date().toISOString() }
          }
          return tab
        })

        set({ orderTabs: updatedTabs })
      },

      // 更新当前激活标签页的订单ID
      updateActiveTabOrderId: (orderId: string) => {
        const state = get()
        const updatedTabs = state.orderTabs.map(tab => {
          if (tab.id === state.activeTabId) {
            return { ...tab, orderId, updatedAt: new Date().toISOString() }
          }
          return tab
        })

        set({ orderTabs: updatedTabs })
      },

      // 获取当前激活标签页（如果没有标签页，自动创建一个）
      getActiveTab: () => {
        const state = get()

        // 如果没有标签页，创建一个
        if (state.orderTabs.length === 0) {
          const newTab = createNewTab(undefined, undefined, state.settings.defaultTemplateId)
          set({
            orderTabs: [newTab],
            activeTabId: newTab.id,
          })
          return newTab
        }

        // 如果有标签页但 activeTabId 无效，使用第一个标签页
        let activeTab = state.orderTabs.find(tab => tab.id === state.activeTabId)
        if (!activeTab) {
          activeTab = state.orderTabs[0]
          set({ activeTabId: activeTab.id })
        }

        return activeTab
      },

      // 清空当前激活标签页的购物车
      clearActiveTabCart: () => {
        const state = get()
        const updatedTabs = state.orderTabs.map(tab => {
          if (tab.id === state.activeTabId) {
            return {
              ...tab,
              draftOrder: { ...tab.draftOrder, cart: [] },
              isDirty: true,
              updatedAt: new Date().toISOString(),
            }
          }
          return tab
        })

        set({ orderTabs: updatedTabs })
      },

      loading: true,
      setLoading: (loading) => set({ loading }),

      // 数据更新方法
      setProducts: (products) => set({ products }),
      setCustomers: (customers) => set({ customers }),
      setOrders: (orders) => set({ orders }),
      setCategories: (categories) => set({ categories }),
      setTemplates: (templates) => set({ templates }),
      setRemarkPresets: (presets) => set({ remarkPresets: presets }),
      setUnitPresets: (presets: UnitPreset[]) => set({ unitPresets: presets }),
      setSettings: (settings) => set({ settings }),

      // 数据加载方法
      loadCustomers: async () => {
        try {
          const customers = await invoke<Customer[]>('get_all_customers')
          set({ customers })
        } catch (error) {
          console.error('加载客户列表失败:', error)
        }
      },

      loadProducts: async () => {
        try {
          const products = await invoke<Product[]>('get_all_products')
          set({ products })
        } catch (error) {
          console.error('加载商品列表失败:', error)
        }
      },

      loadCategories: async () => {
        try {
          const categories = await invoke<Category[]>('get_all_categories')
          set({ categories })
        } catch (error) {
          console.error('加载分类列表失败:', error)
        }
      },

      loadRemarkPresets: async () => {
        try {
          const presets = await invoke<RemarkPreset[]>('get_all_remark_presets')
          set({ remarkPresets: presets })
        } catch (error) {
          console.error('加载备注预设失败:', error)
        }
      },

      loadTemplates: async () => {
        try {
          const templates = await invoke<TemplateConfig[]>('get_all_templates')

          // 如果列表为空，初始化默认模板
          if (templates.length === 0) {
            const { DEFAULT_TEMPLATE_BASE64 } = await import('../constants/defaultTemplateBase64')

            const defaultTemplate: TemplateConfig = {
              id: 'default_template_v1',
              name: '默认模板',
              templateBase64: DEFAULT_TEMPLATE_BASE64,
              fileName: 'template1.xlsx',
              filenamePattern: '{date}_{customerName}_{orderNumber}',
              isDefault: true,
              mappings: {
                // 默认映射配置 (基于 template1.xlsx)
                customerName: 'C3',
                customerPhone: 'E3',
                customerPlate: 'B3',
                date: 'G3',
                orderNumber: 'G2',
                orderRemark: 'G15',
                totalAmount: '',
                itemStartRow: 5,
                itemEndRow: 14,
                columns: {
                  name: 'B',
                  unit: 'C',
                  quantity: 'D',
                  price: 'E',
                  total: 'F',
                  remark: 'G',
                },
              },
              requiredFields: {
                requireCustomerName: false,
                requireCustomerPhone: false,
                requireCustomerPlate: true,
                requireDate: true,
                requireOrderNumber: true,
                requireOrderRemark: false,
                requireTotalAmount: false,
                requireItemName: true,
                requireItemUnit: true,
                requireItemQuantity: true,
                requireItemPrice: true,
                requireItemTotal: false,
                requireItemRemark: true,
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            try {
              await invoke('save_template', { template: defaultTemplate })
              // 重新加载以确认
              const newTemplates = await invoke<TemplateConfig[]>('get_all_templates')
              set({ templates: newTemplates })
              // 同步更新默认模板ID到设置中
              set((state) => ({
                settings: { ...state.settings, defaultTemplateId: defaultTemplate.id }
              }))
            } catch (err) {
              console.error('初始化默认模板失败:', err)
              set({ templates: [] })
            }
          } else {
            set({ templates })
            // 如果模板列表不为空，优先使用 settings 中已保存的默认模板；
            // 若无效则回退到模板标记默认项，再回退到第一个模板，并同步持久化
            const state = get()
            const currentDefaultId = state.settings.defaultTemplateId
            const hasCurrentDefault = !!currentDefaultId && templates.some(t => t.id === currentDefaultId)
            const fallbackDefaultId = templates.find(t => t.isDefault)?.id || templates[0]?.id || ''
            const targetDefaultId = hasCurrentDefault ? currentDefaultId : fallbackDefaultId

            if (targetDefaultId && targetDefaultId !== currentDefaultId) {
              const newSettings = {
                ...state.settings,
                defaultTemplateId: targetDefaultId,
                updatedAt: new Date().toISOString(),
              }

              try {
                await invoke('save_settings', { settings: newSettings })
              } catch (err) {
                console.error('同步默认模板ID到设置失败:', err)
              }

              set((prev) => ({
                settings: { ...prev.settings, defaultTemplateId: targetDefaultId }
              }))
            }
          }
        } catch (error) {
          console.error('加载模板列表失败:', error)
          set({ templates: [] })
        }
      },

      loadUnitPresets: async () => {
        try {
          const presets = await invoke<UnitPreset[]>('get_all_unit_presets')
          set({ unitPresets: presets })
        } catch (error) {
          console.error('加载单位预设失败:', error)
        }
      },

      loadSettings: async () => {
        try {
          const settings = await invoke<AppSettings | null>('get_settings')
          if (settings) {
            set({ settings })
          }
        } catch (error) {
          console.error('加载设置失败:', error)
        }
      },

      updateSettings: async (updates) => {
        const state = get()
        const newSettings = {
          ...state.settings,
          ...updates,
          updatedAt: new Date().toISOString()
        }

        try {
          // 立即保存到数据库
          await invoke('save_settings', { settings: newSettings })
          // 保存成功后更新内存状态
          set({ settings: newSettings })
          return newSettings
        } catch (error) {
          console.error('更新设置失败:', error)
          throw error
        }
      },

      updateRemarkPresets: (presets) => {
        set({ remarkPresets: presets })
      },
    }),
    {
      name: 'quicksales-storage', // localStorage key
      partialize: (state) => ({
        orderTabs: state.orderTabs,
        activeTabId: state.activeTabId,
        // ❌ 不持久化 settings，完全由数据库管理
      }), // 持久化标签页
    }
  )
)
