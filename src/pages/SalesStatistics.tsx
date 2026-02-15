import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Card, Input, Label, Button } from '../components/ui'
import {
  BarChart3,
  ShoppingBag,
  Users,
  RotateCcw,
  Search,
  RefreshCw,
  AlertCircle,
  Download,
  ListOrdered,
  Layers,
  CheckSquare,
  Square,
  ChevronDown,
} from 'lucide-react'
import { useStore } from '../stores/useStore'
import { formatCurrency } from '../lib/utils'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

type TrendGranularity = 'day' | 'week' | 'month'
type QuickRange = '7d' | '30d' | '90d' | '365d' | 'custom'
type CustomerTypeFilter = 'all' | 'new' | 'repeat'

interface OptionItem {
  id: string
  label: string
  subLabel?: string
}

interface TrendPoint {
  key: string
  label: string
  amount: number
  count: number
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getToday = () => formatLocalDate(new Date())

const getDaysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatLocalDate(d)
}

const normalizeOrderDate = (value: string): string | null => {
  if (!value) return null

  const pureDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (pureDateMatch) return value

  const withTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/)
  if (withTimeMatch) return `${withTimeMatch[1]}-${withTimeMatch[2]}-${withTimeMatch[3]}`

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return formatLocalDate(d)
}

const startOfWeek = (d: Date): Date => {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const startOfMonth = (d: Date): Date => {
  const copy = new Date(d)
  copy.setDate(1)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const calcGrowthRate = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

const getCustomerKey = (order: any) => {
  return order.customerId || `${order.customer?.name || '未知客户'}|${order.customer?.licensePlate || ''}|${order.customer?.phone || ''}`
}

const parseNumberOrUndefined = (v: string): number | undefined => {
  if (v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const buildTrendData = (
  ordersInRange: any[],
  startDate: string,
  endDate: string
): { trendData: TrendPoint[], maxTrendAmount: number, granularity: TrendGranularity } => {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { trendData: [], maxTrendAmount: 0, granularity: 'day' }
  }

  const days = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const granularity: TrendGranularity = days <= 31 ? 'day' : days <= 180 ? 'week' : 'month'
  const trendMap = new Map<string, TrendPoint>()

  const makeKeyAndLabel = (date: Date): { key: string, label: string } => {
    if (granularity === 'day') {
      const key = formatLocalDate(date)
      return { key, label: key.slice(5) }
    }

    if (granularity === 'week') {
      const s = startOfWeek(date)
      const key = formatLocalDate(s)
      return { key, label: `${s.getMonth() + 1}/${s.getDate()}周` }
    }

    const s = startOfMonth(date)
    const key = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`
    return { key, label: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}` }
  }

  const cursor = new Date(start)
  while (cursor <= end) {
    const { key, label } = makeKeyAndLabel(cursor)
    if (!trendMap.has(key)) {
      trendMap.set(key, { key, label, amount: 0, count: 0 })
    }
    if (granularity === 'day') {
      cursor.setDate(cursor.getDate() + 1)
    } else if (granularity === 'week') {
      cursor.setDate(cursor.getDate() + 7)
    } else {
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  ordersInRange.forEach((o) => {
    const dateOnly = normalizeOrderDate(o.date)
    if (!dateOnly) return
    const d = new Date(`${dateOnly}T00:00:00`)
    if (Number.isNaN(d.getTime())) return

    const { key } = makeKeyAndLabel(d)
    const current = trendMap.get(key)
    if (!current) return

    current.amount += Number(o.totalAmount || 0)
    current.count += 1
  })

  const trendData = Array.from(trendMap.values())
  const maxTrendAmount = trendData.reduce((max, item) => Math.max(max, item.amount), 0)
  return { trendData, maxTrendAmount, granularity }
}

export const SalesStatistics: React.FC = () => {
  const { orders, setOrders, products, categories } = useStore()

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [quickRange, setQuickRange] = useState<QuickRange>('30d')
  const [startDate, setStartDate] = useState(getDaysAgo(30))
  const [endDate, setEndDate] = useState(getToday())
  const [customerFilter, setCustomerFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [selectedProductNames, setSelectedProductNames] = useState<string[]>([])
  const [showCustomerSelect, setShowCustomerSelect] = useState(false)
  const [showProductSelect, setShowProductSelect] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilter>('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [hoverTrendKey, setHoverTrendKey] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError('')
      const data = await invoke('get_all_orders') as any[]
      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载统计订单数据失败:', error)
      setLoadError('订单数据加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [setOrders])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const productCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach((p) => {
      map.set(p.id, p.categoryId)
    })
    return map
  }, [products])

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c) => {
      map.set(c.id, c.name)
    })
    return map
  }, [categories])

  const customerOrderCountMap = useMemo(() => {
    const map = new Map<string, number>()
    orders.forEach((o) => {
      const k = getCustomerKey(o)
      map.set(k, (map.get(k) || 0) + 1)
    })
    return map
  }, [orders])

  const customerOptions = useMemo<OptionItem[]>(() => {
    const map = new Map<string, OptionItem>()
    orders.forEach((o) => {
      const key = getCustomerKey(o)
      if (!map.has(key)) {
        const label = o.customer?.name || '未知客户'
        const plate = o.customer?.licensePlate || '-'
        const phone = o.customer?.phone || '-'
        map.set(key, { id: key, label, subLabel: `${plate} / ${phone}` })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  }, [orders])

  const productOptions = useMemo<OptionItem[]>(() => {
    const set = new Set<string>()
    orders.forEach((o) => {
      o.items.forEach((i: any) => {
        if (i.name) set.add(i.name)
      })
    })
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((name) => ({ id: name, label: name }))
  }, [orders])

  const visibleCustomerOptions = useMemo(() => {
    const keyword = customerFilter.trim().toLowerCase()
    if (!keyword) return customerOptions
    return customerOptions.filter((o) =>
      o.label.toLowerCase().includes(keyword) ||
      o.subLabel?.toLowerCase().includes(keyword)
    )
  }, [customerOptions, customerFilter])

  const visibleProductOptions = useMemo(() => {
    const keyword = productFilter.trim().toLowerCase()
    if (!keyword) return productOptions
    return productOptions.filter((o) => o.label.toLowerCase().includes(keyword))
  }, [productOptions, productFilter])

  const safeStartDate = startDate <= endDate ? startDate : endDate
  const safeEndDate = endDate >= startDate ? endDate : startDate
  const hasRangeIssue = startDate > endDate

  const minAmountNumber = parseNumberOrUndefined(minAmount)
  const maxAmountNumber = parseNumberOrUndefined(maxAmount)
  const hasAmountIssue =
    minAmountNumber !== undefined &&
    maxAmountNumber !== undefined &&
    minAmountNumber > maxAmountNumber

  const customerFilterNormalized = customerFilter.trim().toLowerCase()
  const productFilterNormalized = productFilter.trim().toLowerCase()

  const getOrderCategoryIds = useCallback((order: any) => {
    const ids = new Set<string>()
    order.items.forEach((item: any) => {
      const cid = item.category || productCategoryMap.get(item.id) || ''
      if (cid) ids.add(cid)
    })
    return ids
  }, [productCategoryMap])

  const applyNonDateFilters = useCallback((order: any) => {
    const customerMatch = !customerFilterNormalized ||
      order.customer?.name?.toLowerCase().includes(customerFilterNormalized) ||
      order.customer?.licensePlate?.toLowerCase().includes(customerFilterNormalized) ||
      order.customer?.phone?.toLowerCase().includes(customerFilterNormalized)

    const customerMultiMatch =
      selectedCustomerIds.length === 0 ||
      selectedCustomerIds.includes(getCustomerKey(order))

    const productMatch = !productFilterNormalized ||
      order.items.some((item: any) => item.name.toLowerCase().includes(productFilterNormalized))

    const productMultiMatch =
      selectedProductNames.length === 0 ||
      order.items.some((item: any) => selectedProductNames.includes(item.name))

    const amount = Number(order.totalAmount || 0)
    const amountLowerMatch = minAmountNumber === undefined || amount >= minAmountNumber
    const amountUpperMatch = maxAmountNumber === undefined || amount <= maxAmountNumber

    const categoryMatch = !selectedCategoryId || getOrderCategoryIds(order).has(selectedCategoryId)

    const customerOrderCount = customerOrderCountMap.get(getCustomerKey(order)) || 0
    const customerTypeMatch =
      customerTypeFilter === 'all'
        ? true
        : customerTypeFilter === 'new'
          ? customerOrderCount <= 1
          : customerOrderCount >= 2

    return customerMatch && customerMultiMatch && productMatch && productMultiMatch && amountLowerMatch && amountUpperMatch && categoryMatch && customerTypeMatch
  }, [
    customerFilterNormalized,
    selectedCustomerIds,
    productFilterNormalized,
    selectedProductNames,
    minAmountNumber,
    maxAmountNumber,
    selectedCategoryId,
    customerOrderCountMap,
    customerTypeFilter,
    getOrderCategoryIds,
  ])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDate = normalizeOrderDate(order.date)
      if (!orderDate) return false
      const dateMatch = orderDate >= safeStartDate && orderDate <= safeEndDate
      return dateMatch && applyNonDateFilters(order)
    })
  }, [orders, safeStartDate, safeEndDate, applyNonDateFilters])

  const prevPeriod = useMemo(() => {
    const start = new Date(`${safeStartDate}T00:00:00`)
    const end = new Date(`${safeEndDate}T00:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

    const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1)
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - (days - 1))

    return {
      start: formatLocalDate(prevStart),
      end: formatLocalDate(prevEnd),
    }
  }, [safeStartDate, safeEndDate])

  const prevOrders = useMemo(() => {
    if (!prevPeriod) return [] as any[]
    return orders.filter((order) => {
      const orderDate = normalizeOrderDate(order.date)
      if (!orderDate) return false
      const dateMatch = orderDate >= prevPeriod.start && orderDate <= prevPeriod.end
      return dateMatch && applyNonDateFilters(order)
    })
  }, [orders, prevPeriod, applyNonDateFilters])

  const stats = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
    const orderCount = filteredOrders.length
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0

    const productSales: Record<string, { name: string, amount: number, quantity: number }> = {}
    const customerSales: Record<string, { name: string, amount: number, count: number }> = {}
    const categorySales: Record<string, { name: string, amount: number, quantity: number }> = {}
    const activeCustomerIds = new Set<string>()

    let totalQuantity = 0

    filteredOrders.forEach((order) => {
      const customerKey = getCustomerKey(order)
      if (!customerSales[customerKey]) {
        customerSales[customerKey] = {
          name: order.customer?.name || '未知客户',
          amount: 0,
          count: 0,
        }
      }
      activeCustomerIds.add(customerKey)
      customerSales[customerKey].amount += Number(order.totalAmount || 0)
      customerSales[customerKey].count += 1

      order.items.forEach((item: any) => {
        const pId = item.id || item.name
        if (!productSales[pId]) {
          productSales[pId] = { name: item.name, amount: 0, quantity: 0 }
        }
        const price = Number(item.discountPrice ?? item.price ?? 0)
        const quantity = Number(item.quantity ?? 0)
        const amount = price * quantity

        productSales[pId].amount += amount
        productSales[pId].quantity += quantity
        totalQuantity += quantity

        const categoryId = item.category || productCategoryMap.get(item.id) || ''
        const categoryName = categoryNameMap.get(categoryId) || '未分类'
        const categoryKey = categoryId || '__uncategorized__'
        if (!categorySales[categoryKey]) {
          categorySales[categoryKey] = { name: categoryName, amount: 0, quantity: 0 }
        }
        categorySales[categoryKey].amount += amount
        categorySales[categoryKey].quantity += quantity
      })
    })

    const topProducts = Object.values(productSales).sort((a, b) => b.amount - a.amount).slice(0, 8)
    const topCustomers = Object.values(customerSales).sort((a, b) => b.amount - a.amount).slice(0, 8)
    const topCategories = Object.values(categorySales).sort((a, b) => b.amount - a.amount).slice(0, 8)

    const { trendData, maxTrendAmount, granularity } = buildTrendData(filteredOrders, safeStartDate, safeEndDate)

    const prevTotalSales = prevOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0)
    const prevOrderCount = prevOrders.length

    return {
      totalSales,
      orderCount,
      avgOrderValue,
      activeCustomerCount: activeCustomerIds.size,
      totalQuantity,
      uniqueProductCount: Object.keys(productSales).length,
      topProducts,
      topCustomers,
      topCategories,
      trendData,
      maxTrendAmount,
      granularity,
      prevTotalSales,
      prevOrderCount,
      salesGrowthRate: calcGrowthRate(totalSales, prevTotalSales),
      orderGrowthRate: calcGrowthRate(orderCount, prevOrderCount),
    }
  }, [filteredOrders, prevOrders, safeStartDate, safeEndDate, productCategoryMap, categoryNameMap])

  const topProductMax = stats.topProducts[0]?.amount || 0
  const topCustomerMax = stats.topCustomers[0]?.amount || 0
  const topCategoryMax = stats.topCategories[0]?.amount || 0
  const hoverTrend = stats.trendData.find((d) => d.key === hoverTrendKey) || null

  const setRange = (days: number, range: QuickRange) => {
    setQuickRange(range)
    setStartDate(getDaysAgo(days))
    setEndDate(getToday())
  }

  const resetFilters = () => {
    setQuickRange('30d')
    setStartDate(getDaysAgo(30))
    setEndDate(getToday())
    setCustomerFilter('')
    setProductFilter('')
    setSelectedCustomerIds([])
    setSelectedProductNames([])
    setShowCustomerSelect(false)
    setShowProductSelect(false)
    setSelectedCategoryId('')
    setCustomerTypeFilter('all')
    setMinAmount('')
    setMaxAmount('')
  }

  const exportFilteredOrdersCsv = async () => {
    try {
      setExporting(true)
      const header = ['订单号', '日期', '客户', '车牌', '电话', '商品种类', '商品总数', '订单金额', '备注']

      const escapeCsv = (v: unknown) => {
        const raw = String(v ?? '')
        const escaped = raw.replace(/"/g, '""')
        return `"${escaped}"`
      }

      const rows = filteredOrders.map((order) => {
        const totalQty = order.items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0)
        return [
          order.orderNumber,
          order.date,
          order.customer?.name || '',
          order.customer?.licensePlate || '',
          order.customer?.phone || '',
          order.items.length,
          totalQty,
          Number(order.totalAmount || 0).toFixed(2),
          order.remark || '',
        ]
      })

      const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n')
      const path = await save({
        defaultPath: `销售统计明细_${safeStartDate}_${safeEndDate}.csv`,
        filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
      })
      if (!path) return

      await writeTextFile(path, `\uFEFF${csv}`)
      alert(`导出成功，共 ${filteredOrders.length} 条订单`) 
    } catch (error) {
      console.error('导出筛选明细失败:', error)
      alert(`导出失败: ${error}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-6 h-full overflow-auto bg-background">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">销售统计</h1>
          <p className="text-muted-foreground">多维度分析销售表现、客户结构和商品贡献</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadOrders} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
          <Button variant="secondary" onClick={resetFilters}>
            <RotateCcw size={16} className="mr-2" />
            重置筛选
          </Button>
          <Button onClick={exportFilteredOrdersCsv} disabled={exporting || filteredOrders.length === 0}>
            <Download size={16} className="mr-2" />
            {exporting ? '导出中...' : '导出明细'}
          </Button>
        </div>
      </div>

      {(hasRangeIssue || hasAmountIssue || loadError) && (
        <Card className="p-3 mb-4 border border-amber-400/30 bg-amber-400/10">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle size={16} />
            {loadError || (hasRangeIssue ? '开始日期晚于结束日期，已自动使用修正区间。' : '最小金额大于最大金额，金额筛选暂不生效。')}
          </div>
        </Card>
      )}

      <Card className="p-4 mb-6 bg-muted/30 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={quickRange === '7d' ? 'default' : 'secondary'} onClick={() => setRange(7, '7d')}>近7天</Button>
          <Button size="sm" variant={quickRange === '30d' ? 'default' : 'secondary'} onClick={() => setRange(30, '30d')}>近30天</Button>
          <Button size="sm" variant={quickRange === '90d' ? 'default' : 'secondary'} onClick={() => setRange(90, '90d')}>近90天</Button>
          <Button size="sm" variant={quickRange === '365d' ? 'default' : 'secondary'} onClick={() => setRange(365, '365d')}>近1年</Button>
          <Button size="sm" variant={quickRange === 'custom' ? 'default' : 'secondary'} onClick={() => setQuickRange('custom')}>自定义</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          <div>
            <Label className="text-xs mb-1 block">开始日期</Label>
            <Input type="date" className="h-9 text-sm" value={startDate} onChange={(e) => { setQuickRange('custom'); setStartDate(e.target.value) }} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">结束日期</Label>
            <Input type="date" className="h-9 text-sm" value={endDate} onChange={(e) => { setQuickRange('custom'); setEndDate(e.target.value) }} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">客户搜索</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input placeholder="姓名/车牌/电话" className="pl-9 h-9 text-sm" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} />
            </div>
            <div className="mt-2 relative">
              <Button size="sm" variant="outline" className="w-full justify-between" onClick={() => setShowCustomerSelect((s) => !s)}>
                <span className="truncate">
                  {selectedCustomerIds.length > 0 ? `已选客户 ${selectedCustomerIds.length} 个` : '选择客户（可多选）'}
                </span>
                <ChevronDown size={14} />
              </Button>
              {showCustomerSelect && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-56 overflow-auto">
                  <div className="sticky top-0 bg-card border-b border-border p-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setSelectedCustomerIds([])}
                      disabled={selectedCustomerIds.length === 0}
                    >
                      清空已选客户
                    </Button>
                  </div>
                  {visibleCustomerOptions.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">无匹配客户</div>
                  ) : (
                    visibleCustomerOptions.map((opt) => {
                      const checked = selectedCustomerIds.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedCustomerIds((prev) =>
                              prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                            )
                          }}
                          className="w-full text-left px-2 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            {checked ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} className="text-muted-foreground" />}
                            <div className="min-w-0">
                              <div className="text-sm truncate">{opt.label}</div>
                              {opt.subLabel && <div className="text-[11px] text-muted-foreground truncate">{opt.subLabel}</div>}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">商品搜索</Label>
            <div className="relative">
              <ShoppingBag className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input placeholder="商品名称" className="pl-9 h-9 text-sm" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
            </div>
            <div className="mt-2 relative">
              <Button size="sm" variant="outline" className="w-full justify-between" onClick={() => setShowProductSelect((s) => !s)}>
                <span className="truncate">
                  {selectedProductNames.length > 0 ? `已选商品 ${selectedProductNames.length} 个` : '选择商品（可多选）'}
                </span>
                <ChevronDown size={14} />
              </Button>
              {showProductSelect && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-56 overflow-auto">
                  <div className="sticky top-0 bg-card border-b border-border p-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setSelectedProductNames([])}
                      disabled={selectedProductNames.length === 0}
                    >
                      清空已选商品
                    </Button>
                  </div>
                  {visibleProductOptions.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">无匹配商品</div>
                  ) : (
                    visibleProductOptions.map((opt) => {
                      const checked = selectedProductNames.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedProductNames((prev) =>
                              prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                            )
                          }}
                          className="w-full text-left px-2 py-2 hover:bg-muted/60 border-b border-border/40 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            {checked ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} className="text-muted-foreground" />}
                            <div className="text-sm truncate">{opt.label}</div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">分类</Label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
            >
              <option value="">全部分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">客户类型</Label>
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value as CustomerTypeFilter)}
              className="w-full h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
            >
              <option value="all">全部客户</option>
              <option value="new">新客户（仅1单）</option>
              <option value="repeat">复购客户（2单及以上）</option>
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">最小金额</Label>
            <Input type="number" min={0} step="0.01" className="h-9 text-sm" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">最大金额</Label>
            <Input type="number" min={0} step="0.01" className="h-9 text-sm" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
        <Card className="p-4 border-l-4 border-l-primary">
          <p className="text-xs text-muted-foreground">筛选期销售额</p>
          <p className="text-xl font-bold">{formatCurrency(stats.totalSales)}</p>
          <p className={`text-xs ${stats.salesGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            环比 {stats.salesGrowthRate >= 0 ? '+' : ''}{stats.salesGrowthRate.toFixed(1)}%
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-xs text-muted-foreground">筛选期订单数</p>
          <p className="text-xl font-bold">{stats.orderCount}</p>
          <p className={`text-xs ${stats.orderGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            环比 {stats.orderGrowthRate >= 0 ? '+' : ''}{stats.orderGrowthRate.toFixed(1)}%
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-500">
          <p className="text-xs text-muted-foreground">平均客单价</p>
          <p className="text-xl font-bold">{formatCurrency(stats.avgOrderValue)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-500">
          <p className="text-xs text-muted-foreground">活跃客户数</p>
          <p className="text-xl font-bold">{stats.activeCustomerCount}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-violet-500">
          <p className="text-xs text-muted-foreground">商品总件数</p>
          <p className="text-xl font-bold">{stats.totalQuantity.toFixed(0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500">
          <p className="text-xs text-muted-foreground">商品种类数</p>
          <p className="text-xl font-bold">{stats.uniqueProductCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card className="xl:col-span-2 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 size={20} className="text-primary" />
              销售趋势
            </h2>
            <span className="text-xs text-muted-foreground">
              {safeStartDate} 至 {safeEndDate} · {stats.granularity === 'day' ? '按日' : stats.granularity === 'week' ? '按周' : '按月'}
            </span>
          </div>

          <div className="mb-3 rounded-lg border border-border p-2 text-xs bg-muted/40">
            {hoverTrend
              ? `当前: ${hoverTrend.label} · 销售额 ${formatCurrency(hoverTrend.amount)} · ${hoverTrend.count} 单`
              : '将鼠标移动到柱子上查看详细金额与订单数（同时支持浏览器 title 提示）'}
          </div>

          <div className="px-1 overflow-x-auto pb-2">
            {stats.trendData.length > 0 ? (
              <div className="min-w-max">
                <div className="h-64 flex items-end gap-1 md:gap-2 border-b border-border">
                  {stats.trendData.map((d) => {
                    const ratio = stats.maxTrendAmount > 0 ? d.amount / stats.maxTrendAmount : 0
                    const barHeightPx = d.amount > 0 ? Math.max(Math.round(ratio * 200), 8) : 3
                    return (
                      <div key={d.key} className="flex-shrink-0 flex flex-col items-center justify-end w-8 md:w-12 h-full">
                        <div className="relative w-full h-full flex items-end">
                          <div
                            title={`${d.label} | ${formatCurrency(d.amount)} | ${d.count} 单`}
                            onMouseEnter={() => setHoverTrendKey(d.key)}
                            onMouseLeave={() => setHoverTrendKey((prev) => (prev === d.key ? null : prev))}
                            className={`w-full rounded-t-sm transition-all duration-200 ${d.amount > 0 ? 'bg-primary/60 hover:bg-primary' : 'bg-muted-foreground/25'}`}
                            style={{ height: `${barHeightPx}px` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex gap-1 md:gap-2">
                  {stats.trendData.map((d) => (
                    <div key={`label-${d.key}`} className="flex-shrink-0 w-8 md:w-12 text-center text-[10px] text-muted-foreground font-mono">
                      {d.label}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full h-56 flex items-center justify-center text-muted-foreground italic">
                当前筛选条件下暂无数据
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              分类贡献 Top 8
            </h2>
            <div className="space-y-3">
              {stats.topCategories.map((c) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate max-w-[180px]">{c.name}</span>
                    <span className="text-primary font-bold">{formatCurrency(c.amount)}</span>
                  </div>
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: `${topCategoryMax > 0 ? (c.amount / topCategoryMax) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
              {stats.topCategories.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-2">暂无数据</p>}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users size={20} className="text-primary" />
              核心客户 Top 8
            </h2>
            <div className="space-y-3">
              {stats.topCustomers.map((c) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate max-w-[180px]">{c.name}</span>
                    <span className="text-success font-bold">{formatCurrency(c.amount)}</span>
                  </div>
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div className="bg-success h-full" style={{ width: `${topCustomerMax > 0 ? (c.amount / topCustomerMax) * 100 : 0}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{c.count} 单</div>
                </div>
              ))}
              {stats.topCustomers.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-2">暂无数据</p>}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShoppingBag size={20} className="text-primary" />
            畅销商品 Top 8
          </h2>
          <div className="space-y-3">
            {stats.topProducts.map((p) => (
              <div key={`${p.name}-${p.quantity}`} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate max-w-[220px]">{p.name}</span>
                  <span className="text-primary font-bold">{formatCurrency(p.amount)}</span>
                </div>
                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${topProductMax > 0 ? (p.amount / topProductMax) * 100 : 0}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground">销量 {p.quantity.toFixed(0)}</div>
              </div>
            ))}
            {stats.topProducts.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-2">暂无数据</p>}
          </div>
        </Card>

        <Card className="xl:col-span-2 p-6 overflow-auto">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ListOrdered size={20} className="text-primary" />
            订单明细（当前筛选）
          </h2>
          {filteredOrders.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground italic">暂无明细数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2">日期</th>
                  <th className="text-left p-2">订单号</th>
                  <th className="text-left p-2">客户</th>
                  <th className="text-right p-2">商品种类</th>
                  <th className="text-right p-2">商品件数</th>
                  <th className="text-right p-2">金额</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 200).map((o) => (
                  <tr key={o.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="p-2">{normalizeOrderDate(o.date) || o.date}</td>
                    <td className="p-2 font-mono">{o.orderNumber}</td>
                    <td className="p-2">{o.customer?.name || '未知客户'}</td>
                    <td className="p-2 text-right">{o.items.length}</td>
                    <td className="p-2 text-right">{o.items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0).toFixed(0)}</td>
                    <td className="p-2 text-right font-semibold text-primary">{formatCurrency(Number(o.totalAmount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}

