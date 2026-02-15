import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button, Input, Label, Modal } from '../components/ui'
import { Search, Plus, Edit, Trash2, FolderTree, ChevronRight, ChevronDown, GripVertical } from 'lucide-react'
import { useStore } from '../stores/useStore'
import type { Category } from '../types'
import { invoke } from '@tauri-apps/api/core'

export const CategoryManagement: React.FC = () => {
  const { categories, setCategories, products } = useStore()
  const [search, setSearch] = useState('')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  // 加载分类列表
  const loadCategories = useCallback(async () => {
    try {
      const data = await invoke('get_all_categories') as Category[]
      setCategories(data)
    } catch (error) {
      console.error('加载分类列表失败:', error)
    }
  }, [setCategories])

  // 初始化时加载数据
  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // 过滤分类
  const filteredCategories = categories.filter((c: Category) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  // 构建分类树
  const buildCategoryTree = (cats: Category[]): Category[] => {
    const rootCats = cats.filter((c: Category) => !c.parentId)
    return rootCats.sort((a: Category, b: Category) => a.sortOrder - b.sortOrder)
  }

  const getChildCategories = (parentId: string): Category[] => {
    return categories
      .filter((c: Category) => c.parentId === parentId)
      .sort((a: Category, b: Category) => a.sortOrder - b.sortOrder)
  }

  // 获取分类下的商品数量
  const getProductCount = (categoryId: string): number => {
    return products.filter((p: any) => p.categoryId === categoryId).length
  }

  // 切换展开/折叠
  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedIds(newExpanded)
  }

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedId(categoryId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', categoryId)
  }

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedId(null)
    setDropTargetId(null)
  }

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedId !== categoryId) {
      setDropTargetId(categoryId)
    }
  }

  // 拖拽离开
  const handleDragLeave = () => {
    setDropTargetId(null)
  }

  // 放置
  const handleDrop = async (e: React.DragEvent, targetCategoryId: string) => {
    e.preventDefault()
    setDropTargetId(null)

    if (!draggedId || draggedId === targetCategoryId) return

    const draggedCategory = categories.find((c: Category) => c.id === draggedId)
    const targetCategory = categories.find((c: Category) => c.id === targetCategoryId)

    if (!draggedCategory || !targetCategory) return

    // 检查是否会导致循环引用
    if (isDescendant(draggedId, targetCategoryId)) {
      alert('不能将分类移动到其子分类中！')
      return
    }

    try {
      // 1. 确定新的父节点信息
      const newParentId = targetCategory.parentId
      const newParent = newParentId ? categories.find((c: Category) => c.id === newParentId) : null

      // 更新拖动节点的层级信息
      const updatedDraggedCategory: Category = {
        ...draggedCategory,
        parentId: newParentId,
        level: newParent ? newParent.level + 1 : 0,
        path: newParent ? `${newParent.path}/` : '',
        updatedAt: new Date().toISOString(),
      }

      // 2. 获取目标层级的所有兄弟节点（不包含拖动节点自身）
      const siblings = categories
        .filter((c: Category) => c.parentId === newParentId && c.id !== draggedId)
        .sort((a: Category, b: Category) => a.sortOrder - b.sortOrder)

      // 3. 找到目标节点的位置并插入
      const targetIndex = siblings.findIndex((c: Category) => c.id === targetCategoryId)
      if (targetIndex !== -1) {
        siblings.splice(targetIndex, 0, updatedDraggedCategory)
      } else {
        siblings.push(updatedDraggedCategory)
      }

      // 4.重新计算所有受影响节点的排序值
      const categoriesToUpdate: Category[] = siblings.map((cat: Category, index: number) => ({
        ...cat,
        sortOrder: index,
        updatedAt: new Date().toISOString()
      }))

      // 5. 批量保存
      await invoke('save_categories_batch', { categories: categoriesToUpdate })

      // 6. 重新加载
      await loadCategories()
    } catch (error) {
      console.error('移动分类失败:', error)
      alert('移动分类失败: ' + error)
    }
  }

  // 检查是否是后代
  const isDescendant = (ancestorId: string, categoryId: string): boolean => {
    const category = categories.find((c: Category) => c.id === categoryId)
    if (!category || !category.parentId) return false
    if (category.parentId === ancestorId) return true
    return isDescendant(ancestorId, category.parentId)
  }



  // 保存分类
  const handleSave = async () => {
    if (!editingCategory) return

    if (!editingCategory.name.trim()) {
      alert('请填写分类名称！')
      return
    }

    try {
      await invoke('save_category', { category: editingCategory })
      await loadCategories()
      setModalOpen(false)
      setEditingCategory(null)
      alert('分类保存成功！')
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败: ' + error)
    }
  }

  // 删除分类
  const handleDelete = async (id: string) => {
    const productCount = getProductCount(id)
    const childCount = getChildCategories(id).length

    if (productCount > 0) {
      alert(`该分类下有 ${productCount} 个商品，请先移动或删除这些商品！`)
      return
    }

    if (childCount > 0) {
      alert(`该分类下有 ${childCount} 个子分类，请先删除子分类！`)
      return
    }

    if (!confirm('确定要删除这个分类吗？')) return

    try {
      await invoke('delete_category', { id })
      await loadCategories()
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败: ' + error)
    }
  }

  // 新建分类
  const handleNew = (parentId?: string) => {
    const parent = parentId ? categories.find((c: Category) => c.id === parentId) : null
    const siblingCount = parentId
      ? getChildCategories(parentId).length
      : categories.filter((c: Category) => !c.parentId).length

    const newCategory: Category = {
      id: Date.now().toString(),
      name: '',
      parentId: parentId || undefined,
      level: parent ? parent.level + 1 : 0,
      path: parent ? `${parent.path}/` : '',
      sortOrder: siblingCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setEditingCategory(newCategory)
    setModalOpen(true)
  }

  // 编辑分类
  const handleEdit = (category: Category) => {
    setEditingCategory({ ...category })
    setModalOpen(true)
  }

  // 渲染分类项
  const renderCategoryItem = (category: Category, depth: number = 0) => {
    const children = getChildCategories(category.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(category.id)
    const productCount = getProductCount(category.id)
    const isDragging = draggedId === category.id
    const isDropTarget = dropTargetId === category.id

    return (
      <div key={category.id}>
        <div
          draggable={true}
          onDragStart={(e) => handleDragStart(e, category.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, category.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, category.id)}
          className={`flex items-center gap-2 py-2.5 px-3 rounded-lg group transition-colors ${isDragging ? 'opacity-50' : ''
            } ${isDropTarget ? 'bg-primary/20 border-2 border-primary' : 'hover:bg-muted/50'}`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {/* 展开/折叠按钮 */}
          <button
            onClick={() => hasChildren && toggleExpand(category.id)}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${hasChildren ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
              }`}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <span className="w-4" />
            )}
          </button>

          {/* 拖动手柄 */}
          <GripVertical size={14} className="text-muted-foreground/50 cursor-grab" />

          {/* 分类名称 */}
          <div className="flex-1 flex items-center gap-2">
            <FolderTree size={16} className="text-primary" />
            <span className="font-medium text-foreground">{category.name}</span>
            <span className="text-xs text-muted-foreground">({productCount})</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleNew(category.id)}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
              title="添加子分类"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => handleEdit(category)}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
              title="编辑"
            >
              <Edit size={14} />
            </button>
            <button
              onClick={() => handleDelete(category.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
              title="删除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* 子分类 */}
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderCategoryItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const rootCategories = buildCategoryTree(filteredCategories)

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="page-title">分类管理</h1>
            <p className="page-description">管理商品分类，支持多级分类结构，可拖拽排序</p>
          </div>
          <Button onClick={() => handleNew()}>
            <Plus size={16} />
            新建分类
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* 搜索栏 */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="搜索分类名称..."
              className="pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* 分类列表 */}
        <div className="flex-1 overflow-auto scrollbar-thin p-4">
          {rootCategories.length === 0 ? (
            <div className="empty-state py-20">
              <FolderTree className="empty-state-icon" />
              <p className="empty-state-title">暂无分类</p>
              <p className="empty-state-description">点击"新建分类"添加第一个分类</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rootCategories.map(cat => renderCategoryItem(cat))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
          共 {categories.length} 个分类
        </div>
      </Card>

      {/* 编辑/新建分类模态框 */}
      {editingCategory && (
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setEditingCategory(null)
          }}
          title={categories.find((c: Category) => c.id === editingCategory.id) ? '编辑分类' : '新建分类'}
        >
          <div className="space-y-4">
            <div>
              <Label>分类名称 *</Label>
              <Input
                type="text"
                placeholder="输入分类名称"
                value={editingCategory.name}
                onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                autoFocus
              />
            </div>

            {editingCategory.parentId && (
              <div>
                <Label>父分类</Label>
                <Input
                  type="text"
                  value={categories.find((c: Category) => c.id === editingCategory.parentId)?.name || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}

            <div>
              <Label>排序值</Label>
              <Input
                type="number"
                min="0"
                value={editingCategory.sortOrder}
                onChange={e => setEditingCategory({ ...editingCategory, sortOrder: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground mt-1">数值越小排序越靠前，也可以直接拖拽分类来调整顺序</p>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
              <p className="text-xs text-primary">
                💡 提示：分类用于组织商品，方便快速查找。建议按照商品类型创建分类，如"保养"、"配件"、"工具"等。
                <br /><br />
                🖱️ 拖拽功能：按住分类左侧的拖动手柄（六个点图标）可以拖拽分类来调整顺序。
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => {
                  setModalOpen(false)
                  setEditingCategory(null)
                }}
                variant="secondary"
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
    </div>
  )
}
