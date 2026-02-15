import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Save, FileDown, ShoppingCart, RotateCcw, X, User, Phone, Car, MapPin, Search, AlertTriangle } from 'lucide-react'
import { useStore } from '../stores/useStore'
import { Button, Input, Label } from '../components/ui'
import { RemarkPresetSelector } from '../components/RemarkPresetSelector'
import { ResizablePanel } from '../components/ResizablePanel'
import { QuickProductModal } from '../components/order/QuickProductModal'
import { ProductSelection } from '../components/order/ProductSelection'
import { CartItemList } from '../components/order/CartItemList'
import { formatCurrency } from '../lib/utils'
import { exportOrderWithTemplate } from '../services/excelService'
import type { Product, Customer, OrderItem, TemplateConfig, Order } from '../types'
import { invoke } from '@tauri-apps/api/core'
import { openPath } from '@tauri-apps/plugin-opener'

// 快速创建商品模态框


export const OrderEntry: React.FC = () => {
  const {
    products,
    categories,
    customers,
    orderTabs,
    getActiveTab,
    createNewTab,
    closeTab,
    switchTab,
    updateActiveTab,
    updateActiveTabTitle,
    markActiveTabDirty,
    clearActiveTabCart,
    loadCustomers,
    loadProducts,
    templates,
    settings,
    updateActiveTabOrderId
  } = useStore()

  const activeTab = getActiveTab()
  const today = new Date().toISOString().split('T')[0]

  const resolvedDefaultTemplateId = useMemo(() => {
    if (settings.defaultTemplateId && templates.some((t) => t.id === settings.defaultTemplateId)) {
      return settings.defaultTemplateId
    }

    const templateDefault = templates.find((t) => t.isDefault)?.id
    return templateDefault || templates[0]?.id || ''
  }, [settings.defaultTemplateId, templates])

  const hasManualOrderNumberPattern = useMemo(
    () => !settings.orderNumberFormat.includes('{SEQ'),
    [settings.orderNumberFormat]
  )

  const shouldResetOrderNumberOnContextChange = useMemo(
    () => !hasManualOrderNumberPattern,
    [hasManualOrderNumberPattern]
  )

  const draftOrder = activeTab?.draftOrder || {
    cart: [],
    customer: null,
    date: today,
    remark: '',
    templateId: resolvedDefaultTemplateId,
  }

  // 本地状态
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [orderDate, setOrderDate] = useState(draftOrder.date)
  const [orderRemark, setOrderRemark] = useState(draftOrder.remark || '')
  const [itemRemarks, setItemRemarks] = useState<Record<string, string>>({})
  // 使用系统默认模板ID作为初始值，如果草稿中有则使用草稿的
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    draftOrder.templateId || resolvedDefaultTemplateId
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('')

  // 客户信息（直接从 draftOrder.customer 读取）
  const customer = draftOrder.customer
  const customerName = customer?.name || ''
  const customerPhone = customer?.phone || ''
  const customerPlate = customer?.licensePlate || ''
  const customerAddress = customer?.address || ''
  const isTemporaryCustomer = customer?.id.startsWith('temp_') || false
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)

  // 快速创建商品模态框状态
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false)



  // 初始化加载
  const isInitialized = useRef(false)
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true
      loadCustomers()
    }
  }, [loadCustomers])

  // 同步标签页数据到本地状态
  const activeTabId = activeTab?.id
  useEffect(() => {
    if (activeTab) {
      setOrderDate(activeTab.draftOrder.date)
      setOrderRemark(activeTab.draftOrder.remark || '')

      // 同步模板选择：优先草稿，其次解析后的默认模板
      const currentId = activeTab.draftOrder.templateId || resolvedDefaultTemplateId
      setSelectedTemplateId(currentId)

      // 如果草稿中确实没有模板ID，但系统有默认值，则静默更新草稿以保持一致
      if (!activeTab.draftOrder.templateId && currentId) {
        updateActiveTab({ templateId: currentId })
      }
    }
  }, [activeTabId, resolvedDefaultTemplateId, updateActiveTab])

  // 统一的客户字段更新函数
  const updateCustomerField = useCallback((field: string, value: string) => {
    const currentCustomer = draftOrder.customer || {
      id: `temp_${Date.now()}`,
      name: '',
      phone: '',
      licensePlate: '',
      address: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    updateActiveTab({
      customer: {
        ...currentCustomer,
        [field]: value,
        updatedAt: new Date().toISOString(),
      }
    })
  }, [draftOrder.customer, updateActiveTab])

  // 更新临时客户状态
  const updateTemporaryCustomerStatus = useCallback((isTemporary: boolean) => {
    if (!draftOrder.customer) return

    const newId = isTemporary
      ? (draftOrder.customer.id.startsWith('temp_') ? draftOrder.customer.id : `temp_${Date.now()}`)
      : (draftOrder.customer.id.startsWith('temp_') ? Date.now().toString() : draftOrder.customer.id)

    updateActiveTab({
      customer: {
        ...draftOrder.customer,
        id: newId,
        updatedAt: new Date().toISOString(),
      }
    })
  }, [draftOrder.customer, updateActiveTab])

  // 过滤商品


  // 过滤客户建议 - 改进：任一字段匹配即可
  const filteredCustomers = customerSearch.length > 0 ? customers.filter((c: Customer) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.licensePlate.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.toLowerCase().includes(customerSearch.toLowerCase()))
  ).slice(0, 5) : []

  // 添加商品到购物车
  const addToCart = (product: Product) => {
    const existingItem = draftOrder.cart.find(item => item.id === product.id)

    if (existingItem) {
      const updatedCart = draftOrder.cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
      updateActiveTab({ cart: updatedCart })
    } else {
      const newItem: OrderItem = {
        id: product.id,
        name: product.name,
        unit: product.unit,
        price: product.price,
        quantity: 1,
        category: product.categoryId,
        sortValue: Date.now(),
      }
      updateActiveTab({ cart: [...draftOrder.cart, newItem] })
    }
  }

  // 更新购物车
  const handleUpdateCart = (newCart: OrderItem[]) => {
    updateActiveTab({ cart: newCart })
  }



  // 清空购物车
  const clearCart = () => {
    if (confirm('确定要清空购物车吗？')) {
      clearActiveTabCart()
    }
  }

  // 选择客户建议
  const handleSelectCustomerSuggestion = (customer: Customer) => {
    updateActiveTab({ customer })
    setCustomerSearch('')
    setShowCustomerSuggestions(false)
  }

  // 创建/更新客户对象
  const buildCustomerObject = useCallback((): Customer => {
    if (!draftOrder.customer) {
      throw new Error('客户信息不存在')
    }

    const currentCustomer = draftOrder.customer

    // 如果是临时客户，直接返回
    if (isTemporaryCustomer) {
      return currentCustomer
    }

    // 如果当前ID是临时ID，需要转换为正式客户
    if (currentCustomer.id.startsWith('temp_')) {
      // 查找是否有匹配的现有客户（通过车牌号或姓名+电话）
      const existingCustomer = customers.find(c => {
        const samePlate = !!currentCustomer.licensePlate && c.licensePlate === currentCustomer.licensePlate
        const sameName = !!currentCustomer.name && c.name === currentCustomer.name
        const samePhone = !!currentCustomer.phone && c.phone === currentCustomer.phone
        return samePlate || sameName || samePhone
      })

      if (existingCustomer) {
        // 使用现有客户ID，但更新信息
        return {
          ...existingCustomer,
          name: currentCustomer.name,
          phone: currentCustomer.phone,
          licensePlate: currentCustomer.licensePlate,
          address: currentCustomer.address,
          updatedAt: new Date().toISOString(),
        }
      } else {
        // 创建新的正式客户ID
        return {
          ...currentCustomer,
          id: Date.now().toString(),
          updatedAt: new Date().toISOString(),
        }
      }
    }

    // 如果已经是正式客户ID，直接返回
    return currentCustomer
  }, [draftOrder.customer, isTemporaryCustomer, customers])

  // 新建订单
  const newOrder = () => {
    createNewTab()
    setSearchTerm('')
    setSelectedCategory(null)
    setItemRemarks({})
    setCustomerSearch('')
    // 不需要清空客户信息，因为已经没有本地状态了
  }

  // 快速添加商品
  const handleQuickAddProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newProduct = {
        ...product,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await invoke('save_product', { product: newProduct })
      await loadProducts()
      addToCart(newProduct as Product)
      alert('商品添加成功！')
    } catch (error) {
      console.error('添加商品失败:', error)
      alert('添加商品失败: ' + error)
    }
  }

  // 计算总金额
  const totalAmount = draftOrder.cart.reduce((sum, item) => {
    const price = item.discountPrice ?? item.price
    return sum + (price * item.quantity)
  }, 0)

  // 检查库存不足的商品
  const stockWarnings = useMemo(() => {
    const warnings: { itemId: string; productName: string; requested: number; available: number }[] = []
    draftOrder.cart.forEach(item => {
      const product = products.find(p => p.id === item.id)
      if (product?.trackStock && product.stock !== undefined) {
        if (item.quantity > product.stock) {
          warnings.push({
            itemId: item.id,
            productName: item.name,
            requested: item.quantity,
            available: product.stock
          })
        }
      }
    })
    return warnings
  }, [draftOrder.cart, products])



  // 保存订单
  const saveOrder = async (exportExcel: boolean = false) => {
    // 根据设置中的验证规则检查必填字段
    // 合并默认值，确保 templateValidation 完整
    const templateValidation = Object.assign({
      requireCustomerName: false,
      requireCustomerPhone: false,
      requireCustomerPlate: false,
    }, settings?.templateValidation || {})

    // 检查至少填写一个客户字段
    const hasName = customerName.trim().length > 0
    const hasPhone = customerPhone.trim().length > 0
    const hasPlate = customerPlate.trim().length > 0
    const hasAnyField = hasName || hasPhone || hasPlate

    if (!hasAnyField) {
      alert('请至少填写一个客户信息（姓名、电话或车牌号）')
      return
    }

    // 检查用户设置的必填字段
    const missingFields: string[] = []
    if (templateValidation.requireCustomerName && !hasName) {
      missingFields.push('客户姓名')
    }
    if (templateValidation.requireCustomerPhone && !hasPhone) {
      missingFields.push('联系电话')
    }
    if (templateValidation.requireCustomerPlate && !hasPlate) {
      missingFields.push('车牌号')
    }

    // 如果有必填字段缺失
    if (missingFields.length > 0) {
      alert(`请填写以下必填字段：\n${missingFields.join('、')}`)
      return
    }

    const customer = buildCustomerObject()

    if (draftOrder.cart.length === 0) {
      alert('请添加商品！')
      return
    }

    try {
      // 后端会自动处理客户保存，这里不需要手动保存
      // 无论是临时客户还是正式客户，后端都会确保满足外键约束

      const effectiveTemplateId = selectedTemplateId || resolvedDefaultTemplateId

      const order: Order = {
        id: activeTab?.orderId || Date.now().toString(),
        orderNumber: draftOrder.orderNumber || '',
        date: orderDate,
        customerId: customer.id,
        customer,
        items: draftOrder.cart.map(item => ({
          ...item,
          remark: itemRemarks[item.id] || item.remark || '',
        })),
        totalAmount,
        remark: orderRemark,
        templateId: effectiveTemplateId || undefined,
        status: 'completed' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const orderNumber = await invoke('save_order', { order }) as string
      order.orderNumber = orderNumber

      // 刷新商品列表（库存可能已扣减）
      await loadProducts()

      if (exportExcel) {
        // 找到选定的模板
        const selectedTemplate = templates.find((t: TemplateConfig) => t.id === effectiveTemplateId)

        // 检查是否有模板
        if (!selectedTemplate) {
          alert('请先在设置中配置Excel模板！')
          return
        }

        // 检查模板是否有上传的文件
        if (!selectedTemplate.templateBase64) {
          alert(`模板 "${selectedTemplate.name}" 没有上传Excel文件，请先在设置中上传模板文件！`)
          return
        }

        try {
          // 使用模板导出
          const filePath = await exportOrderWithTemplate(order, selectedTemplate, {
            outputDirectory: settings.outputDirectory,
            filenameFormat: settings.excelFilenameFormat,
            skipDialog: settings.skipSaveDialog,
          })

          if (filePath) {
            // 根据设置决定是否自动打开文件
            if (settings.autoOpenExcel) {
              try {
                console.log('自动打开文件:', filePath)
                await openPath(filePath)
                console.log('文件打开成功')
                alert(`订单保存成功！单号：${orderNumber}\n\nExcel文件已导出并打开：${filePath}`)
              } catch (e) {
                console.error('打开文件失败:', e)
                alert(`订单保存成功！单号：${orderNumber}\n\nExcel文件已导出到：${filePath}\n\n但打开文件失败: ${e}`)
              }
            } else {
              alert(`订单保存成功！单号：${orderNumber}\n\nExcel文件已导出到：${filePath}`)
            }
          } else {
            alert(`订单保存成功！单号：${orderNumber}\n\n（导出已取消）`)
          }
        } catch (exportError) {
          console.error('导出Excel失败:', exportError)
          alert(`订单保存成功！单号：${orderNumber}\n\n但导出Excel失败: ${exportError}`)
        }
      } else {
        alert(`订单保存成功！单号：${orderNumber}`)
      }

      // 保存成功后更新标签页标题 - 优先显示订单号
      if (orderNumber) {
        updateActiveTabTitle(orderNumber)
      } else if (customer.name) {
        updateActiveTabTitle(`${customer.name} - ${draftOrder.cart.length}件商品`)
      } else if (customer.licensePlate) {
        updateActiveTabTitle(`${customer.licensePlate} - ${draftOrder.cart.length}件商品`)
      }

      updateActiveTabOrderId(order.id)
      updateActiveTab({ orderNumber })
      markActiveTabDirty(false)

      // 清空本地状态（保留客户信息，只清空购物车）
      // setCustomerName('')
      // setCustomerPhone('')
      // setCustomerPlate('')
      // setCustomerAddress('')
      // setIsTemporaryCustomer(false)
      setCustomerSearch('')
      setOrderRemark('')
      setItemRemarks({})
      setSearchTerm('')
      setSelectedCategory(null)
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败: ' + error)
    }
  }

  // 生成标签页显示标题
  const getTabDisplayTitle = (tab: typeof orderTabs[0]) => {
    const name = tab.draftOrder.customer?.name || '未选客户'
    const itemCount = tab.draftOrder.cart.length
    if (itemCount === 0) return tab.title
    return `${name} (${itemCount})`
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 顶部工具栏 */}
      <div className="bg-card border-b border-border flex-shrink-0">
        {/* 标签页栏 */}
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-border/50">
          {orderTabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all cursor-pointer ${tab.isActive
                ? 'bg-background text-foreground border-t border-x border-border -mb-px'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
            >
              <span className="text-sm font-medium whitespace-nowrap max-w-[120px] truncate">
                {getTabDisplayTitle(tab)}
              </span>
              {tab.isDirty && (
                <span className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0" title="未保存"></span>
              )}
              {orderTabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={newOrder}
            className="ml-1 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="新建订单"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* 操作栏 */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">新建订单</h1>
              <p className="text-sm text-muted-foreground">选择商品和填写客户信息</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedTemplateId(val)
                  const updates: Partial<typeof draftOrder> = { templateId: val }
                  if (shouldResetOrderNumberOnContextChange) {
                    updates.orderNumber = undefined
                  }
                  updateActiveTab(updates)
                }}
                className="form-select text-sm h-9 w-40"
                disabled={templates.length === 0}
              >
                <option value="">请选择模板</option>
                {templates.map((template: TemplateConfig) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {!template.templateBase64 && ' (未上传文件)'}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  setIsRefreshing(true)
                  try {
                    await invoke('batch_update_pinyin')
                    await Promise.all([loadCustomers(), loadProducts()])
                    setLastRefreshedAt(new Date().toLocaleTimeString())
                  } finally {
                    setIsRefreshing(false)
                  }
                }}
                disabled={isRefreshing}
              >
                <RotateCcw size={16} />
                {isRefreshing ? '刷新中...' : '刷新'}
              </Button>
              {lastRefreshedAt && (
                <span className="text-xs text-muted-foreground">
                  已刷新 {lastRefreshedAt}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 - 三栏可拖动布局 */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanel
          initialSizes={[40, 35, 25]}
          minSizes={[25, 20, 15]}
          maxSizes={[55, 50, 40]}
        >
          {/* 左侧：商品选择 */}
          <ProductSelection
            products={products}
            categories={categories}
            cart={draftOrder.cart}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            onAddToCart={addToCart}
            onOpenQuickAdd={() => setQuickProductModalOpen(true)}
          />

          {/* 中间：购物车 */}
          <div className="flex flex-col h-full bg-card">
            {/* 购物车头部 */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-primary" />
                <span className="font-semibold text-foreground">购物清单</span>
                <span className="text-sm text-muted-foreground">({draftOrder.cart.length})</span>
              </div>
              {draftOrder.cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-destructive hover:text-destructive/80 font-medium"
                >
                  清空
                </button>
              )}
            </div>

            {/* 库存警告 */}
            {stockWarnings.length > 0 && (
              <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex-shrink-0">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-destructive">
                    <span className="font-medium">库存不足：</span>
                    {stockWarnings.map((w, i) => (
                      <span key={w.itemId}>
                        {i > 0 && '、'}
                        {w.productName}(需{w.requested}/库存{w.available})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 购物车列表 */}
            <div className="flex-1 overflow-auto scrollbar-thin">
              <CartItemList
                cart={draftOrder.cart}
                products={products}
                stockWarnings={stockWarnings}
                onUpdateCart={handleUpdateCart}
              />
            </div>

            {/* 购物车底部 - 总计和操作 */}
            {draftOrder.cart.length > 0 && (
              <div className="border-t border-border p-4 bg-muted/30 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground">合计</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => saveOrder(false)}
                    className="h-11"
                  >
                    <Save size={18} />
                    保存订单
                  </Button>
                  <Button
                    onClick={() => saveOrder(true)}
                    variant="success"
                    className="h-11"
                  >
                    <FileDown size={18} />
                    保存并导出
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：客户信息和备注（内联填写） */}
          <div className="flex flex-col h-full bg-muted/30 overflow-auto">
            {/* 客户信息 */}
            <div className="p-4 bg-card border-b border-border flex-shrink-0">
              <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
                <User size={16} className="text-primary" />
                客户信息
              </h3>

              <div className="space-y-3">
                {/* 客户搜索 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    placeholder="搜索已有客户..."
                    className="pl-9 h-9 text-sm"
                    value={customerSearch}
                    onChange={e => {
                      setCustomerSearch(e.target.value)
                      setShowCustomerSuggestions(true)
                    }}
                    onFocus={() => setShowCustomerSuggestions(true)}
                  />
                  {/* 客户建议列表 */}
                  {showCustomerSuggestions && filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg bg-card shadow-lg z-10 max-h-40 overflow-auto">
                      {filteredCustomers.map((customer: Customer) => (
                        <button
                          key={customer.id}
                          onClick={() => handleSelectCustomerSuggestion(customer)}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-0"
                        >
                          <div className="font-medium text-foreground text-sm">{customer.name}</div>
                          <div className="text-xs text-muted-foreground">{customer.licensePlate} | {customer.phone}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 客户姓名 */}
                <div>
                  <Label className="text-xs">
                    客户姓名 {settings.templateValidation?.requireCustomerName && '*'}
                  </Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                      placeholder="输入客户姓名"
                      className="pl-9 h-9 text-sm"
                      value={customerName}
                      onChange={e => updateCustomerField('name', e.target.value)}
                    />
                  </div>
                </div>

                {/* 车牌号 */}
                <div>
                  <Label className="text-xs">
                    车牌号 {settings.templateValidation?.requireCustomerPlate && '*'}
                  </Label>
                  <div className="relative mt-1">
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                      placeholder="输入车牌号"
                      className="pl-9 h-9 text-sm"
                      value={customerPlate}
                      onChange={e => updateCustomerField('licensePlate', e.target.value)}
                    />
                  </div>
                </div>

                {/* 联系电话 */}
                <div>
                  <Label className="text-xs">
                    联系电话 {settings.templateValidation?.requireCustomerPhone && '*'}
                  </Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                      placeholder="输入联系电话"
                      className="pl-9 h-9 text-sm"
                      value={customerPhone}
                      onChange={e => updateCustomerField('phone', e.target.value)}
                    />
                  </div>
                </div>

                {/* 地址 */}
                <div>
                  <Label className="text-xs">地址</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                      placeholder="输入地址（可选）"
                      className="pl-9 h-9 text-sm"
                      value={customerAddress}
                      onChange={e => updateCustomerField('address', e.target.value)}
                    />
                  </div>
                </div>

                {/* 临时客户选项 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTemporaryCustomer}
                    onChange={e => updateTemporaryCustomerStatus(e.target.checked)}
                    className="rounded border-input text-primary accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">临时客户（不保存到数据库）</span>
                </label>
              </div>
            </div>

            {/* 订单日期 */}
            <div className="p-4 bg-card border-b border-border flex-shrink-0">
              <Label className="text-sm">订单日期</Label>
              <Input
                type="date"
                value={orderDate}
                onChange={e => {
                  const newDate = e.target.value
                  setOrderDate(newDate)
                  updateActiveTab({ date: newDate, ...(shouldResetOrderNumberOnContextChange ? { orderNumber: undefined } : {}) })
                }}
                className="h-9 mt-1.5"
              />
            </div>

            {/* 订单备注 */}
            <div className="flex-1 p-4 bg-card flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">订单备注</Label>
                <RemarkPresetSelector
                  type="order"
                  onSelect={(content) => {
                    setOrderRemark(prev => prev ? `${prev} ${content}` : content)
                  }}
                  multiSelect={true}
                  buttonLabel="预设"
                />
              </div>
              <textarea
                className="form-textarea flex-1 min-h-[100px] text-sm"
                placeholder="输入订单备注..."
                value={orderRemark}
                onChange={e => {
                  const nextRemark = e.target.value
                  setOrderRemark(nextRemark)
                  updateActiveTab({ remark: nextRemark })
                }}
              />
            </div>
          </div>
        </ResizablePanel>
      </div>

      {/* 快速创建商品模态框 */}
      <QuickProductModal
        isOpen={quickProductModalOpen}
        onClose={() => setQuickProductModalOpen(false)}
        onSave={handleQuickAddProduct}
        categories={categories}
      />
    </div>
  )
}
