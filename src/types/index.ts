// ========== 数据模型 ==========

export interface Product {
  id: string
  name: string
  unit: string
  price: number
  categoryId: string
  pinyin?: string
  stock?: number        // 库存数量
  minStock?: number     // 最低库存警告
  trackStock?: boolean  // 是否跟踪库存
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  parentId?: string
  level: number
  path: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  licensePlate: string
  address?: string
  remark?: string
  lastPurchaseAt?: string
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  name: string
  unit: string
  price: number
  quantity: number
  category: string
  discountPrice?: number
  remark?: string
  sortValue: number
}

export interface Order {
  id: string
  orderNumber: string
  date: string
  customerId: string
  customer: Customer
  items: OrderItem[]
  totalAmount: number
  remark?: string
  templateId?: string
  status: 'completed' | 'draft'
  createdAt: string
  updatedAt: string
}

export interface TemplateConfig {
  id: string
  name: string
  templateBase64: string
  fileName: string
  filenamePattern: string
  isDefault: boolean
  mappings: {
    customerName: string
    customerPhone: string
    customerPlate: string
    date: string
    orderNumber: string
    orderRemark: string
    totalAmount: string
    itemStartRow: number
    itemEndRow: number
    columns: {
      name: string
      unit: string
      quantity: string
      price: string
      total: string
      remark: string
    }
  }
  // 模板级别的必填字段设置（用于Excel导出验证）
  requiredFields: {
    requireCustomerName: boolean
    requireCustomerPhone: boolean
    requireCustomerPlate: boolean
    requireDate: boolean
    requireOrderNumber: boolean
    requireOrderRemark: boolean
    requireTotalAmount: boolean
    requireItemName: boolean
    requireItemUnit: boolean
    requireItemQuantity: boolean
    requireItemPrice: boolean
    requireItemTotal: boolean
    requireItemRemark: boolean
  }
  createdAt: string
  updatedAt: string
}

export interface RemarkPreset {
  id: string
  content: string
  type: 'item' | 'order'
  sortOrder: number
  useCount: number
  createdAt: string
  updatedAt: string
}

export interface UnitPreset {
  id: string
  name: string
  sortOrder: number
  useCount: number
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id: string
  dataDirectory: string
  outputDirectory: string
  backupDirectory: string
  fontSize: number
  theme: 'light' | 'dark' | 'auto'
  rememberWindow: boolean
  dateFormat: string
  excelDateFormat: string
  orderNumberFormat: string
  orderNumberPrefix: string
  orderNumberResetDaily: boolean
  orderNumberDigits: number
  retainDays: number
  autoBackup: boolean
  backupInterval: number
  backupKeepCount: number
  defaultTemplateId: string
  defaultCategoryId: string
  excelFilenameFormat: string

  // Excel导出设置
  autoOpenExcel: boolean  // 导出后自动打开Excel
  skipSaveDialog: boolean // 跳过保存对话框，直接保存到默认位置

  // 模板验证规则配置
  templateValidation: {
    requireCustomerName: boolean
    requireCustomerPhone: boolean
    requireCustomerPlate: boolean
    requireDate: boolean
    requireOrderNumber: boolean
    requireOrderRemark: boolean
    requireTotalAmount: boolean
    requireItemName: boolean
    requireItemUnit: boolean
    requireItemQuantity: boolean
    requireItemPrice: boolean
    requireItemTotal: boolean
    requireItemRemark: boolean
  }

  updatedAt: string
}

export type ViewState = 'order' | 'history' | 'products' | 'customers' | 'remark-presets' | 'analytics' | 'settings'

// ========== 购物车草稿状态 ==========

export interface DraftOrderState {
  cart: OrderItem[]
  customer: Customer | null
  date: string
  remark?: string
  templateId?: string
  orderNumber?: string
}

// ========== 订单标签页状态 ==========

export interface OrderTab {
  id: string                      // 标签页唯一ID
  orderId?: string                // 如果是已保存订单，包含订单ID
  title: string                   // 标签标题（订单号或"新订单"）
  draftOrder: DraftOrderState     // 订单草稿数据
  isActive: boolean               // 是否当前激活
  isDirty: boolean                // 是否有未保存修改
  createdAt: string               // 创建时间
  updatedAt: string               // 最后更新时间
}
