import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, Button, Input, Modal } from '../components/ui'
import {
  Search, FileDown, Eye, Calendar, User, Package, Upload,
  ChevronLeft, ChevronRight, Filter, FileText, CheckSquare, Square
} from 'lucide-react'
import type { Order } from '../types'
import { invoke } from '@tauri-apps/api/core'
import { formatCurrency } from '../lib/utils'
import { exportOrderToExcel, exportOrdersToExcel } from '../services/excelService'
import { useStore } from '../stores/useStore'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

// 订单详情模态框
interface OrderDetailModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
  outputDirectory?: string
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, isOpen, onClose, outputDirectory }) => {
  if (!order) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`订单详情 - ${order.orderNumber}`} size="lg">
      <div className="space-y-6">
        {/* 订单基本信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">日期：</span>
              <span className="font-medium text-foreground">{order.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">单号：</span>
              <span className="font-mono font-medium text-foreground">{order.orderNumber}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">客户：</span>
              <span className="font-medium text-foreground">{order.customer?.name || '未知'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground ml-5">车牌：</span>
              <span className="font-mono text-foreground">{order.customer?.licensePlate || '-'}</span>
            </div>
          </div>
        </div>

        {/* 商品列表 */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">商品明细</h4>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">商品</th>
                  <th className="text-center px-3 py-2 font-medium w-20">单位</th>
                  <th className="text-center px-3 py-2 font-medium w-20">数量</th>
                  <th className="text-right px-3 py-2 font-medium w-24">单价</th>
                  <th className="text-right px-3 py-2 font-medium w-24">小计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item, index) => (
                  <tr key={index} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{item.name}</div>
                      {item.remark && (
                        <div className="text-xs text-muted-foreground">{item.remark}</div>
                      )}
                    </td>
                    <td className="text-center px-3 py-2 text-muted-foreground">{item.unit}</td>
                    <td className="text-center px-3 py-2">{item.quantity}</td>
                    <td className="text-right px-3 py-2">{formatCurrency(item.discountPrice || item.price)}</td>
                    <td className="text-right px-3 py-2 font-medium text-primary">
                      {formatCurrency((item.discountPrice || item.price) * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-semibold">合计：</td>
                  <td className="px-3 py-2 text-right font-bold text-primary text-lg">
                    {formatCurrency(order.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 订单备注 */}
        {order.remark && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">订单备注</h4>
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
              {order.remark}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
          <Button onClick={async () => {
            try {
              const filePath = await exportOrderToExcel(order, { outputDirectory })
              if (filePath) {
                alert(`导出成功！\n\n文件已保存到：${filePath}`)
              }
            } catch (error) {
              console.error('导出失败:', error)
              alert('导出失败: ' + error)
            }
          }}>
            <FileDown size={16} />
            导出Excel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const { settings } = useStore()

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // 加载订单列表
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      // TODO: 调用后端获取订单列表
      const data = await invoke('get_all_orders').catch(() => []) as Order[]
      setOrders(data)
    } catch (error) {
      console.error('加载订单列表失败:', error)
      // 使用模拟数据展示
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [search])

  // 日期过滤
  const getDateRange = (): { start: Date; end: Date } | null => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (dateFilter) {
      case 'today':
        return { start: today, end: now }
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(weekStart.getDate() - 7)
        return { start: weekStart, end: now }
      case 'month':
        const monthStart = new Date(today)
        monthStart.setMonth(monthStart.getMonth() - 1)
        return { start: monthStart, end: now }
      default:
        return null
    }
  }

  // 过滤订单
  const filteredOrders = useMemo(() => orders.filter(order => {
    // 搜索过滤
    const searchLower = debouncedSearch.toLowerCase()
    const matchSearch = !debouncedSearch ||
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.customer?.name.toLowerCase().includes(searchLower) ||
      order.customer?.licensePlate.toLowerCase().includes(searchLower)

    // 日期过滤
    const dateRange = getDateRange()
    let matchDate = true
    if (dateRange) {
      const orderDate = new Date(order.date)
      matchDate = orderDate >= dateRange.start && orderDate <= dateRange.end
    }

    return matchSearch && matchDate
  }), [orders, debouncedSearch, dateFilter])

  // 分页数据
  const totalPages = Math.ceil(filteredOrders.length / pageSize)
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // 查看订单详情
  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setDetailModalOpen(true)
  }

  // 选择/取消选择订单
  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrderIds)
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId)
    } else {
      newSelection.add(orderId)
    }
    setSelectedOrderIds(newSelection)
  }

  // 全选/取消全选当前页
  const toggleSelectAll = () => {
    const currentPageIds = paginatedOrders.map(o => o.id)
    const allSelected = currentPageIds.every(id => selectedOrderIds.has(id))

    if (allSelected) {
      // 取消选择当前页所有订单
      const newSelection = new Set(selectedOrderIds)
      currentPageIds.forEach(id => newSelection.delete(id))
      setSelectedOrderIds(newSelection)
    } else {
      // 选择当前页所有订单
      const newSelection = new Set(selectedOrderIds)
      currentPageIds.forEach(id => newSelection.add(id))
      setSelectedOrderIds(newSelection)
    }
  }

  // 批量导出选中订单
  const handleBatchExport = async () => {
    if (selectedOrderIds.size === 0) {
      alert('请先选择要导出的订单')
      return
    }

    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id))

    try {
      setExporting(true)
      const filePath = await exportOrdersToExcel(selectedOrders, { outputDirectory: settings.outputDirectory })
      if (filePath) {
        alert(`成功导出 ${selectedOrders.length} 个订单！\n\n文件已保存到：${filePath}`)
        setSelectedOrderIds(new Set()) // 清空选择
      }
    } catch (error) {
      console.error('批量导出失败:', error)
      alert('批量导出失败: ' + error)
    } finally {
      setExporting(false)
    }
  }

  const handleExportJson = async () => {
    try {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        orders,
      }

      const filePath = await save({
        defaultPath: `订单历史_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON文件', extensions: ['json'] }],
      })

      if (!filePath) return
      await writeTextFile(filePath, JSON.stringify(exportData, null, 2))
      alert(`导出成功，共 ${orders.length} 条订单`)
    } catch (error) {
      console.error('导出订单JSON失败:', error)
      alert('导出失败: ' + error)
    }
  }

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!Array.isArray(data?.orders)) {
        alert('导入失败：JSON格式错误，必须包含 orders 数组')
        return
      }

      let successCount = 0
      for (const order of data.orders) {
        try {
          await invoke('save_order', { order })
          successCount++
        } catch (e) {
          console.error('导入订单失败:', order?.id, e)
        }
      }

      await loadOrders()
      alert(`导入完成：成功 ${successCount} / ${data.orders.length} 条订单`)
    } catch (error) {
      console.error('导入订单JSON失败:', error)
      alert('导入失败: ' + error)
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  // 统计数据
  const totalAmount = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0)
  const orderCount = filteredOrders.length
  const isAllSelected = paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrderIds.has(o.id))

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="page-title">订单历史</h1>
            <p className="page-description">查看和管理历史订单记录</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="order-history-import-json"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportJson}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('order-history-import-json')?.click()}
              disabled={importing}
            >
              <Upload size={16} />
              {importing ? '导入中...' : '导入JSON'}
            </Button>
            <Button variant="outline" onClick={handleExportJson}>
              <FileDown size={16} />
              导出JSON
            </Button>
            {selectedOrderIds.size > 0 && (
              <Button
                onClick={handleBatchExport}
                disabled={exporting}
              >
                <FileDown size={16} />
                {exporting ? '导出中...' : `导出选中 (${selectedOrderIds.size})`}
              </Button>
            )}
            <Button variant="outline" onClick={loadOrders}>
              刷新
            </Button>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-border bg-primary/5 text-xs text-primary">
          导入格式说明：JSON 顶层需包含 <code>orders</code> 数组，元素结构为完整订单对象（含 id、orderNumber、date、customer、items、totalAmount、status 等字段）。
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">订单数量</p>
              <p className="text-2xl font-bold text-foreground">{orderCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Package size={20} className="text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">商品总数</p>
              <p className="text-2xl font-bold text-foreground">
                {filteredOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <span className="text-warning text-lg font-bold">¥</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总金额</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* 搜索和筛选 */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="搜索订单号、客户名称、车牌号..."
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* 日期筛选 */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted-foreground" />
              <div className="flex gap-1">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'today', label: '今天' },
                  { key: 'week', label: '本周' },
                  { key: 'month', label: '本月' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setDateFilter(item.key as typeof dateFilter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${dateFilter === item.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 订单列表 */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            </div>
          ) : paginatedOrders.length === 0 ? (
            <div className="empty-state py-20">
              <FileText className="empty-state-icon" />
              <p className="empty-state-title">暂无订单记录</p>
              <p className="empty-state-description">订单保存后会显示在这里</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="table-header sticky top-0 bg-muted">
                <tr>
                  <th className="table-cell font-semibold w-12">
                    <button
                      onClick={toggleSelectAll}
                      className="p-1 rounded hover:bg-muted-foreground/10 transition-colors"
                      title={isAllSelected ? '取消全选' : '全选当前页'}
                    >
                      {isAllSelected ? (
                        <CheckSquare size={18} className="text-primary" />
                      ) : (
                        <Square size={18} className="text-muted-foreground" />
                      )}
                    </button>
                  </th>
                  <th className="table-cell font-semibold">订单号</th>
                  <th className="table-cell font-semibold">日期</th>
                  <th className="table-cell font-semibold">客户</th>
                  <th className="table-cell font-semibold">商品数</th>
                  <th className="table-cell font-semibold text-right">金额</th>
                  <th className="table-cell font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedOrders.map(order => {
                  const isSelected = selectedOrderIds.has(order.id)
                  return (
                    <tr
                      key={order.id}
                      className={`table-row ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      <td className="table-cell">
                        <button
                          onClick={() => toggleOrderSelection(order.id)}
                          className="p-1 rounded hover:bg-muted-foreground/10 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-primary" />
                          ) : (
                            <Square size={18} className="text-muted-foreground" />
                          )}
                        </button>
                      </td>
                      <td className="table-cell">
                        <span className="font-mono font-medium text-foreground">{order.orderNumber}</span>
                      </td>
                      <td className="table-cell text-muted-foreground">{order.date}</td>
                      <td className="table-cell">
                        <div>
                          <div className="font-medium text-foreground">{order.customer?.name || '未知'}</div>
                          <div className="text-xs text-muted-foreground">{order.customer?.licensePlate || '-'}</div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="badge badge-neutral">
                          {order.items.length} 种 / {order.items.reduce((s, i) => s + i.quantity, 0)} 件
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <span className="font-semibold text-primary">{formatCurrency(order.totalAmount)}</span>
                      </td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredOrders.length)} / 共 {filteredOrders.length} 条
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 订单详情模态框 */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedOrder(null)
        }}
        outputDirectory={settings.outputDirectory}
      />
    </div>
  )
}
