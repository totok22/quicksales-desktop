import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Card, Button, Input, Label, Modal } from '../components/ui'
import { Search, Plus, Edit, Trash2, User, Phone, Car, Users, Download, Upload, CheckSquare, Square } from 'lucide-react'
import { useStore } from '../stores/useStore'
import type { Customer } from '../types'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

export const CustomerManagement: React.FC = () => {
  const { customers, setCustomers } = useStore()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeSourceId, setMergeSourceId] = useState('')
  const [mergeTargetId, setMergeTargetId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 批量选择
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // 排序状态
  const [sortField, setSortField] = useState<keyof Customer>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [search])

  // 过滤和排序客户
  const filteredCustomers = useMemo(() => {
    const normalizedSearch = debouncedSearch.toLowerCase()
    let result = customers.filter((c: any) =>
      c.name.toLowerCase().includes(normalizedSearch) ||
      c.phone.toLowerCase().includes(normalizedSearch) ||
      c.licensePlate.toLowerCase().includes(normalizedSearch)
    )

    // 排序
    result.sort((a: any, b: any) => {
      const valA = (a[sortField] || '').toString()
      const valB = (b[sortField] || '').toString()

      if (sortOrder === 'asc') {
        return valA.localeCompare(valB, 'zh-CN')
      } else {
        return valB.localeCompare(valA, 'zh-CN')
      }
    })

    return result
  }, [customers, debouncedSearch, sortField, sortOrder])

  // 处理排序点击
  const handleSort = (field: keyof Customer) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // 获取排序图标
  const getSortIcon = (field: keyof Customer) => {
    if (sortField !== field) return <span className="opacity-0 group-hover:opacity-50 transition-opacity">↕</span>
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedCustomers(new Set())
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)))
    }
    setSelectAll(!selectAll)
  }, [selectAll, filteredCustomers])

  // 切换单个选择
  const toggleCustomerSelection = useCallback((customerId: string) => {
    const newSelected = new Set(selectedCustomers)
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId)
    } else {
      newSelected.add(customerId)
    }
    setSelectedCustomers(newSelected)
  }, [selectedCustomers])

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedCustomers.size === 0) {
      alert('请选择要删除的客户')
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedCustomers.size} 位客户吗？`)) return

    try {
      for (const id of selectedCustomers) {
        await invoke('delete_customer', { id })
      }
      const updated = customers.filter((c: Customer) => !selectedCustomers.has(c.id))
      setCustomers(updated)
      setSelectedCustomers(new Set())
      setSelectAll(false)
      alert('批量删除成功')
    } catch (error) {
      console.error('批量删除失败:', error)
      alert('批量删除失败: ' + error)
    }
  }

  // 加载客户列表
  const loadCustomers = async () => {
    try {
      const data = await invoke('get_all_customers') as Customer[]
      setCustomers(data)
    } catch (error) {
      console.error('加载客户列表失败:', error)
    }
  }

  // 初始化时加载数据
  React.useEffect(() => {
    loadCustomers()
  }, [])


  const handleSave = async () => {
    if (!editingCustomer) return

    // 验证 - 姓名和车牌号为必填
    if (!editingCustomer.name.trim()) {
      alert('请填写客户姓名！')
      return
    }

    if (!editingCustomer.licensePlate.trim()) {
      alert('请填写车牌号！')
      return
    }

    try {
      await invoke('save_customer', { customer: editingCustomer })
      await loadCustomers()
      setModalOpen(false)
      setEditingCustomer(null)
      alert('客户保存成功！')
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败: ' + error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这位客户吗？')) return

    try {
      await invoke('delete_customer', { id })
      setCustomers(customers.filter((c: Customer) => c.id !== id))
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败: ' + error)
    }
  }

  const handleMergeCustomers = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      alert('请选择要合并的源客户和目标客户')
      return
    }
    if (mergeSourceId === mergeTargetId) {
      alert('源客户和目标客户不能相同')
      return
    }

    try {
      await invoke('merge_customers', { sourceId: mergeSourceId, targetId: mergeTargetId })
      await loadCustomers()
      setMergeModalOpen(false)
      setMergeSourceId('')
      setMergeTargetId('')
      alert('客户合并成功！历史订单已转移到目标客户。')
    } catch (error) {
      console.error('合并客户失败:', error)
      alert('合并客户失败: ' + error)
    }
  }

  const handleNew = () => {
    const newCustomer: Customer = {
      id: Date.now().toString(),
      name: '',
      phone: '',
      licensePlate: '',
      address: '',
      remark: '', // Added remark field
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setEditingCustomer(newCustomer)
    setModalOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer({ ...customer })
    setModalOpen(true)
  }

  // 导出CSV
  const handleExportCSV = async () => {
    try {
      const header = '姓名,电话,车牌号,地址,备注\n'
      const rows = filteredCustomers.map((row: Customer) => {
        return [
          row.name,
          row.phone || '',
          row.licensePlate || '',
          (row.address || '').replace(/,/g, ' '),
          (row.remark || '').replace(/,/g, ' ')
        ].join(',')
      }).join('\n')

      const csvContent = header + rows

      // 使用 Tauri 保存对话框
      const filePath = await save({
        defaultPath: `客户列表_${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV文件', extensions: ['csv'] }]
      })

      if (filePath) {
        const bom = '\uFEFF'
        await writeTextFile(filePath, bom + csvContent)
        alert('导出成功！')
      }
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败: ' + error)
    }
  }

  // 导入CSV
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        const dataLines = lines.slice(1) // 跳过表头

        const newCustomers: Customer[] = []
        const errors: string[] = []

        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i]
          const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v =>
            v.replace(/^"|"$/g, '').trim()
          ) || []

          if (values.length < 1) {
            errors.push(`第 ${i + 2} 行: 格式错误`)
            continue
          }

          const [name, phone = '', licensePlate = '', address = '', remark = ''] = values

          if (!name) {
            errors.push(`第 ${i + 2} 行: 姓名为空`)
            continue
          }

          newCustomers.push({
            id: Date.now().toString() + '_' + i,
            name,
            phone,
            licensePlate,
            address,
            remark, // Added remark field
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }

        if (errors.length > 0) {
          const proceed = confirm(
            `导入过程中有 ${errors.length} 个错误:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}\n\n是否继续导入其他 ${newCustomers.length} 个客户？`
          )
          if (!proceed) return
        }

        if (newCustomers.length === 0) {
          alert('没有可导入的客户')
          return
        }

        let successCount = 0
        for (const customer of newCustomers) {
          try {
            await invoke('save_customer', { customer })
            successCount++
          } catch (err) {
            console.error('保存客户失败:', customer.name, err)
          }
        }

        await loadCustomers()
        alert(`成功导入 ${successCount} 个客户！`)
      } catch (error) {
        console.error('导入失败:', error)
        alert('导入失败: ' + error)
      }
    }

    reader.readAsText(file, 'UTF-8')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="page-title">客户管理</h1>
            <p className="page-description">管理客户信息，支持批量导入导出</p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              导入CSV
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download size={16} />
              导出CSV
            </Button>
            <Button variant="outline" onClick={() => setMergeModalOpen(true)}>
              合并客户
            </Button>
            {selectedCustomers.size > 0 && (
              <Button variant="danger" onClick={handleBatchDelete}>
                <Trash2 size={16} />
                批量删除 ({selectedCustomers.size})
              </Button>
            )}
            <Button onClick={handleNew}>
              <Plus size={16} />
              新建客户
            </Button>
          </div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* 搜索栏 */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="搜索客户姓名、电话、车牌号..."
              className="pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* 客户列表 */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {filteredCustomers.length === 0 ? (
            <div className="empty-state py-20">
              <Users className="empty-state-icon" />
              <p className="empty-state-title">暂无客户数据</p>
              <p className="empty-state-description">点击"新建客户"添加第一个客户</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="table-header sticky top-0 bg-muted">
                <tr>
                  <th className="table-cell font-semibold w-10">
                    <button onClick={handleSelectAll} className="flex items-center gap-2">
                      {selectAll ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="table-cell font-semibold">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 group"
                    >
                      姓名 {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="table-cell font-semibold">
                    <button
                      onClick={() => handleSort('phone')}
                      className="flex items-center gap-1 group"
                    >
                      电话 {getSortIcon('phone')}
                    </button>
                  </th>
                  <th className="table-cell font-semibold">
                    <button
                      onClick={() => handleSort('licensePlate')}
                      className="flex items-center gap-1 group"
                    >
                      车牌号 {getSortIcon('licensePlate')}
                    </button>
                  </th>
                  <th className="table-cell font-semibold">地址</th>
                  <th className="table-cell font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className={`table-row ${selectedCustomers.has(customer.id) ? 'bg-primary/5' : ''}`}>
                    <td className="table-cell">
                      <button
                        onClick={() => toggleCustomerSelection(customer.id)}
                        className="flex items-center justify-center w-full"
                      >
                        {selectedCustomers.has(customer.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User size={16} className="text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{customer.name}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone size={14} />
                        {customer.phone || '-'}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Car size={14} className="text-muted-foreground" />
                        <span className="font-mono text-foreground">{customer.licensePlate || '-'}</span>
                      </div>
                    </td>
                    <td className="table-cell text-muted-foreground text-sm">
                      {customer.address || '-'}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 底部统计 */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground flex items-center justify-between">
          <div>
            共 {filteredCustomers.length} 个客户
            {search && ` (筛选自 ${customers.length} 个)`}
          </div>
          {selectedCustomers.size > 0 && (
            <span className="text-primary font-medium">
              已选择 {selectedCustomers.size} 个客户
            </span>
          )}
        </div>
      </Card>

      {/* 编辑/新建客户模态框 */}
      {editingCustomer && (
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setEditingCustomer(null)
          }}
          title={customers.find(c => c.id === editingCustomer.id) ? '编辑客户' : '新建客户'}
        >
          <div className="space-y-4">
            <div>
              <Label>客户姓名 *</Label>
              <Input
                type="text"
                placeholder="输入客户姓名"
                value={editingCustomer.name}
                onChange={e => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                autoFocus
              />
            </div>

            <div>
              <Label>联系电话</Label>
              <Input
                type="text"
                placeholder="输入联系电话"
                value={editingCustomer.phone}
                onChange={e => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
              />
            </div>

            <div>
              <Label>车牌号 *</Label>
              <Input
                type="text"
                placeholder="输入车牌号"
                value={editingCustomer.licensePlate}
                onChange={e => setEditingCustomer({ ...editingCustomer, licensePlate: e.target.value })}
              />
            </div>

            <div>
              <Label>地址</Label>
              <Input
                type="text"
                placeholder="输入地址（可选）"
                value={editingCustomer.address}
                onChange={e => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
              />
            </div>

            <div>
              <Label>备注</Label>
              <textarea
                className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={editingCustomer.remark || ''}
                onChange={e => setEditingCustomer({ ...editingCustomer, remark: e.target.value })}
                placeholder="客户其他备注信息..."
              />
            </div>

            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
              <p className="text-xs text-primary">
                💡 提示：姓名和车牌号为必填项，便于在订单中快速识别客户
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalOpen(false)
                  setEditingCustomer(null)
                }}
                className="flex-1"
              >
                取消
              </Button>
              <Button onClick={handleSave} className="flex-1">
                保存
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={mergeModalOpen}
        onClose={() => {
          setMergeModalOpen(false)
          setMergeSourceId('')
          setMergeTargetId('')
        }}
        title="手动合并客户"
      >
        <div className="space-y-4">
          <div>
            <Label>源客户（将被合并并删除）</Label>
            <select
              className="form-select"
              value={mergeSourceId}
              onChange={(e) => setMergeSourceId(e.target.value)}
            >
              <option value="">请选择源客户</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} | {c.phone || '-'} | {c.licensePlate || '-'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>目标客户（保留）</Label>
            <select
              className="form-select"
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
            >
              <option value="">请选择目标客户</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} | {c.phone || '-'} | {c.licensePlate || '-'}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-xs text-primary">
            合并后：源客户的历史订单会转移到目标客户，源客户记录会被删除。
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setMergeModalOpen(false)
                setMergeSourceId('')
                setMergeTargetId('')
              }}
              className="flex-1"
            >
              取消
            </Button>
            <Button onClick={handleMergeCustomers} className="flex-1">
              确认合并
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
