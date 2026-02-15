import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Search, MessageSquare, Filter } from 'lucide-react'
import { Card, Button, Input, Label, Modal } from '../components/ui'
import type { RemarkPreset } from '../types'
import { invoke } from '@tauri-apps/api/core'

export const RemarkPresets: React.FC = () => {
  const [presets, setPresets] = useState<RemarkPreset[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'item' | 'order'>('all')
  const [editingPreset, setEditingPreset] = useState<RemarkPreset | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    content: '',
    type: 'item' as 'item' | 'order',
    sortOrder: 0,
  })

  // 加载备注预设
  useEffect(() => {
    loadPresets()
  }, [])

  const loadPresets = async () => {
    try {
      const data = await invoke<RemarkPreset[]>('get_all_remark_presets')
      setPresets(data)
    } catch (error) {
      console.error('加载失败:', error)
    }
  }

  // 打开新建模态框
  const openNewModal = () => {
    setEditingPreset(null)
    setFormData({
      content: '',
      type: 'item',
      sortOrder: presets.length,
    })
    setModalOpen(true)
  }

  // 打开编辑模态框
  const openEditModal = (preset: RemarkPreset) => {
    setEditingPreset(preset)
    setFormData({
      content: preset.content,
      type: preset.type,
      sortOrder: preset.sortOrder,
    })
    setModalOpen(true)
  }

  // 保存备注预设
  const savePreset = async () => {
    if (!formData.content.trim()) {
      alert('请输入备注内容')
      return
    }

    try {
      const preset: RemarkPreset = {
        id: editingPreset?.id || Date.now().toString(),
        content: formData.content.trim(),
        type: formData.type,
        sortOrder: formData.sortOrder,
        useCount: editingPreset?.useCount || 0,
        createdAt: editingPreset?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await invoke('save_remark_preset', { preset })
      setModalOpen(false)
      loadPresets()
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败: ' + error)
    }
  }

  // 删除备注预设
  const deletePreset = async (id: string) => {
    if (!confirm('确定要删除这个备注预设吗?')) return

    try {
      await invoke('delete_remark_preset', { id })
      loadPresets()
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败: ' + error)
    }
  }

  // 过滤备注预设
  const filteredPresets = presets.filter(preset => {
    const matchSearch = preset.content.toLowerCase().includes(searchTerm.toLowerCase())
    const matchType = filterType === 'all' || preset.type === filterType
    return matchSearch && matchType
  })

  // 统计
  const itemCount = presets.filter(p => p.type === 'item').length
  const orderCount = presets.filter(p => p.type === 'order').length

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="page-title">备注预设管理</h1>
            <p className="page-description">管理常用的商品备注和订单备注模板</p>
          </div>
          <Button onClick={openNewModal}>
            <Plus size={16} />
            新建预设
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* 搜索和筛选 */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="搜索备注内容..."
                className="pl-10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 类型筛选 */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted-foreground" />
              <div className="flex gap-1">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterType === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  全部 ({presets.length})
                </button>
                <button
                  onClick={() => setFilterType('item')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterType === 'item'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  商品备注 ({itemCount})
                </button>
                <button
                  onClick={() => setFilterType('order')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterType === 'order'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  订单备注 ({orderCount})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 备注预设列表 */}
        <div className="flex-1 overflow-auto p-4 scrollbar-thin">
          {filteredPresets.length === 0 ? (
            <div className="empty-state py-20">
              <MessageSquare className="empty-state-icon" />
              <p className="empty-state-title">暂无备注预设</p>
              <p className="empty-state-description">点击"新建预设"添加常用备注模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPresets.map(preset => (
                <div
                  key={preset.id}
                  className="flex items-start justify-between p-4 bg-card border border-border rounded-xl hover:shadow-card-hover transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${preset.type === 'item' ? 'badge-primary' : 'badge-success'}`}>
                        {preset.type === 'item' ? '商品' : '订单'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        使用 {preset.useCount} 次
                      </span>
                    </div>
                    <p className="font-medium text-foreground line-clamp-2">{preset.content}</p>
                  </div>
                  <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(preset)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
          共 {filteredPresets.length} 个预设
          {filterType !== 'all' && ` (筛选自 ${presets.length} 个)`}
        </div>
      </Card>

      {/* 编辑模态框 */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPreset ? '编辑备注预设' : '新建备注预设'}
      >
        <div className="space-y-4">
          <div>
            <Label>备注内容 *</Label>
            <textarea
              className="form-textarea min-h-[100px]"
              placeholder="输入备注内容..."
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              autoFocus
            />
          </div>

          <div>
            <Label>备注类型</Label>
            <select
              className="form-select"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as 'item' | 'order' })}
            >
              <option value="item">商品备注</option>
              <option value="order">订单备注</option>
            </select>
          </div>

          <div>
            <Label>排序顺序</Label>
            <Input
              type="number"
              value={formData.sortOrder}
              onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground mt-1">数字越小越靠前显示</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setModalOpen(false)}
              variant="secondary"
              className="flex-1"
            >
              取消
            </Button>
            <Button onClick={savePreset} className="flex-1">
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
