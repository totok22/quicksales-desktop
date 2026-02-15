import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Card, Button, Input, Label } from '../components/ui'
import { UnitPresetSelector } from '../components/UnitPresetSelector'
import { Search, Plus, Edit, Trash2, Upload, Download, Package, Filter, AlertTriangle, Folder, X, RefreshCw, GripVertical, CheckSquare, Square, ChevronUp, ChevronDown } from 'lucide-react'
import { productService, categoryService } from '../services/api'
import { useStore } from '../stores/useStore'
import type { Product, Category } from '../types'
import { formatCurrency } from '../lib/utils'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'

export const ProductManagement: React.FC = () => {
  const { products, setProducts, categories, setCategories } = useStore()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showLowStock, setShowLowStock] = useState(false)
  const [showCategoryPanel, setShowCategoryPanel] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 批量选择
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // 排序选项
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'createdAt'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // 拖拽状态
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null)

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN')),
    [categories]
  )

  const rootCategories = useMemo(
    () => sortedCategories.filter(cat => !cat.parentId),
    [sortedCategories]
  )

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    sortedCategories.forEach(cat => map.set(cat.id, cat))
    return map
  }, [sortedCategories])

  const childrenMap = useMemo(() => {
    const map: Record<string, Category[]> = {}
    sortedCategories.forEach(cat => {
      if (!cat.parentId) return
      if (!map[cat.parentId]) map[cat.parentId] = []
      map[cat.parentId].push(cat)
    })
    Object.keys(map).forEach(parentId => {
      map[parentId].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))
    })
    return map
  }, [sortedCategories])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [search])

  const getDescendantIds = useCallback((categoryId: string): string[] => {
    const result: string[] = []
    const queue = [...(childrenMap[categoryId] || [])]
    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current.id)
      const children = childrenMap[current.id] || []
      queue.push(...children)
    }
    return result
  }, [childrenMap])

  const formatCategoryPath = useCallback((categoryId: string) => {
    const names: string[] = []
    let current = categoryById.get(categoryId)
    let safeCounter = 0
    while (current && safeCounter < 10) {
      names.unshift(current.name)
      if (!current.parentId) break
      current = categoryById.get(current.parentId)
      safeCounter += 1
    }
    return names.length > 0 ? names.join(' / ') : '未分类'
  }, [categoryById])

  const categoryOptions = useMemo(
    () => sortedCategories.map(cat => ({ id: cat.id, label: formatCategoryPath(cat.id) })),
    [sortedCategories, formatCategoryPath]
  )

  const directCategoryCountMap = useMemo(() => {
    const counts: Record<string, number> = {}
    products.forEach(p => {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1
    })
    return counts
  }, [products])

  const categoryTotalCountMap = useMemo(() => {
    const totalMap: Record<string, number> = {}

    const calcTotal = (categoryId: string): number => {
      if (totalMap[categoryId] !== undefined) return totalMap[categoryId]
      const children = childrenMap[categoryId] || []
      const childrenTotal = children.reduce((sum, child) => sum + calcTotal(child.id), 0)
      const total = (directCategoryCountMap[categoryId] || 0) + childrenTotal
      totalMap[categoryId] = total
      return total
    }

    sortedCategories.forEach(cat => {
      calcTotal(cat.id)
    })

    return totalMap
  }, [sortedCategories, childrenMap, directCategoryCountMap])

  // 过滤商品
  const filteredProducts = products.filter((p: any) => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase()
    const pinyinTokens = (p.pinyin || '').toLowerCase().split(/\s+/).filter(Boolean)
    const pinyinJoined = pinyinTokens.join('')
    const matchSearch =
      normalizedSearch.length === 0 ||
      p.name.toLowerCase().includes(normalizedSearch) ||
      pinyinTokens.some((token: string) => token.includes(normalizedSearch) || token.startsWith(normalizedSearch)) ||
      pinyinJoined.includes(normalizedSearch) ||
      pinyinJoined.startsWith(normalizedSearch)
    const matchCategory = selectedCategory
      ? [selectedCategory, ...getDescendantIds(selectedCategory)].includes(p.categoryId)
      : true
    const matchLowStock = showLowStock
      ? (p.trackStock && p.stock !== undefined && p.minStock !== undefined && p.stock <= p.minStock)
      : true
    return matchSearch && matchCategory && matchLowStock
  }).sort((a: any, b: any) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'zh-CN')
        break
      case 'price':
        comparison = a.price - b.price
        break
      case 'stock':
        comparison = (a.stock ?? 0) - (b.stock ?? 0)
        break
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map((p: any) => p.id)))
    }
    setSelectAll(!selectAll)
  }, [selectAll, filteredProducts])

  // 切换单个选择
  const toggleProductSelection = useCallback((productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }, [selectedProducts])

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedProducts.size === 0) {
      alert('请先选择要删除的商品')
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedProducts.size} 个商品吗？`)) return

    try {
      for (const id of selectedProducts) {
        await productService.delete(id)
      }
      const updated = products.filter((p: any) => !selectedProducts.has(p.id))
      setProducts(updated)
      setSelectedProducts(new Set())
      setSelectAll(false)
      alert(`成功删除 ${selectedProducts.size} 个商品！`)
    } catch (error) {
      console.error('批量删除失败:', error)
      alert('批量删除失败: ' + error)
    }
  }

  // 处理分类点击
  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId)
    setSelectAll(false)
    setSelectedProducts(new Set())
  }

  // 批量修改分类
  const handleBatchChangeCategory = async (newCategoryId: string) => {
    if (selectedProducts.size === 0) {
      alert('请先选择要修改的商品')
      return
    }

    try {
      for (const id of selectedProducts) {
        const product = products.find(p => p.id === id)
        if (product) {
          await productService.save({ ...product, categoryId: newCategoryId })
        }
      }
      const updated = await productService.getAll()
      setProducts(updated)
      setSelectedProducts(new Set())
      setSelectAll(false)
      alert(`成功修改 ${selectedProducts.size} 个商品的分类！`)
    } catch (error) {
      console.error('批量修改分类失败:', error)
      alert('批量修改分类失败: ' + error)
    }
  }

  // 分类拖拽处理
  const handleDragStart = (index: number) => {
    setDraggedCategoryIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (dropIndex: number) => {
    if (draggedCategoryIndex === null || draggedCategoryIndex === dropIndex) return

    const reorderedRoots = [...rootCategories]
    const [draggedCategory] = reorderedRoots.splice(draggedCategoryIndex, 1)
    reorderedRoots.splice(dropIndex, 0, draggedCategory)

    const now = new Date().toISOString()
    const updatedRootMap = new Map(
      reorderedRoots.map((cat, idx) => [cat.id, { ...cat, sortOrder: idx, updatedAt: now }])
    )
    const updatedCategories = categories.map(cat => updatedRootMap.get(cat.id) || cat)

    try {
      for (const category of reorderedRoots) {
        const updated = updatedRootMap.get(category.id)
        if (updated) {
          await categoryService.save(updated)
        }
      }
      setCategories(updatedCategories)
    } catch (error) {
      console.error('更新分类排序失败:', error)
      alert('更新分类排序失败: ' + error)
    }

    setDraggedCategoryIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedCategoryIndex(null)
  }

  // 手动排序分类
  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= rootCategories.length) return

    const swappedRoots = [...rootCategories]
    const temp = swappedRoots[index]
    swappedRoots[index] = swappedRoots[newIndex]
    swappedRoots[newIndex] = temp

    const now = new Date().toISOString()
    const updatedRootMap = new Map(
      swappedRoots.map((cat, idx) => [cat.id, { ...cat, sortOrder: idx, updatedAt: now }])
    )
    const updatedCategories = categories.map(cat => updatedRootMap.get(cat.id) || cat)

    try {
      await categoryService.save(updatedRootMap.get(swappedRoots[index].id)!)
      await categoryService.save(updatedRootMap.get(swappedRoots[newIndex].id)!)
      setCategories(updatedCategories)
    } catch (error) {
      console.error('更新分类排序失败:', error)
      alert('更新分类排序失败: ' + error)
    }
  }

  // 库存不足商品数量
  const lowStockCount = products.filter(p =>
    p.trackStock && p.stock !== undefined && p.minStock !== undefined && p.stock <= p.minStock
  ).length


  const handleSave = async (product: Product) => {
    try {
      // 如果拼音简码为空，自动生成
      if (!product.pinyin && product.name) {
        const pinyin = await invoke<string>('generate_product_pinyin', { name: product.name })
        product.pinyin = pinyin.toLowerCase()
      }

      await productService.save(product)
      const updated = await productService.getAll()
      setProducts(updated)
      setEditingProduct(null)
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败: ' + error)
    }
  }


  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个商品吗？')) return

    try {
      await productService.delete(id)
      const updated = products.filter(p => p.id !== id)
      setProducts(updated)
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败: ' + error)
    }
  }

  const handleNew = () => {
    if (categories.length === 0) {
      alert('请先在分类管理中创建分类！')
      return
    }

    const newProduct: Product = {
      id: Date.now().toString(),
      name: '',
      unit: '个',
      price: 0,
      categoryId: categories[0].id,
      pinyin: '',
      stock: undefined,
      minStock: undefined,
      trackStock: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setEditingProduct(newProduct)
  }

  // 构建导出数据
  const handleExportCSV = async () => {
    try {
      const header = '商品名称,单位,零售价,分类,拼音码,最小库存,启用库存,当前库存\n'
      const rows = filteredProducts.map((p: any) => {
        const cat = categories.find((c: any) => c.id === p.categoryId)
        return [
          p.name,
          p.unit,
          p.price,
          cat ? cat.name : '',
          p.pinyin || '',
          p.minStock || 0,
          p.trackStock ? 'true' : 'false',
          p.stock || 0
        ].join(',')
      }).join('\n')

      const csvContent = header + rows

      const filePath = await save({
        defaultPath: `商品列表_${new Date().toISOString().slice(0, 10)}.csv`,
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


  const getCategoryProductCount = useCallback((categoryId: string) => {
    return categoryTotalCountMap[categoryId] || 0
  }, [categoryTotalCountMap])

  // 导入CSV
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const text = e.target?.result as string
      const lines = text.split('\n')
      const newProducts: Product[] = []
      const errors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(',')
        if (values.length < 3) continue

        const [name, unit, priceStr, categoryName, pinyin, minStockStr, trackStockStr, stockStr] = values
        const price = parseFloat(priceStr) || 0
        const minStock = parseFloat(minStockStr) || 0
        const trackStock = trackStockStr === 'true'
        const stock = parseFloat(stockStr) || 0

        if (!name) {
          errors.push(`第 ${i + 1} 行: 商品名称为空`)
          continue
        }

        // 查找或创建分类
        let categoryId = ''
        if (categoryName) {
          const cat = categories.find((c: Category) => c.name === categoryName)
          if (cat) {
            categoryId = cat.id
          } else {
            // 这里可以处理新增分类逻辑
          }
        }

        newProducts.push({
          id: Date.now().toString() + '_' + i,
          name,
          price,
          unit,
          categoryId,
          pinyin,
          stock,
          minStock,
          trackStock,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      if (errors.length > 0) {
        const proceed = confirm(
          `导入过程中有 ${errors.length} 个错误:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}\n\n是否继续导入其他 ${newProducts.length} 个商品？`
        )
        if (!proceed) return
      }

      if (newProducts.length === 0) {
        alert('没有可导入的商品')
        return
      }

      let successCount = 0
      for (const product of newProducts) {
        try {
          await productService.save(product)
          successCount++
        } catch (err) {
          console.error('保存商品失败:', product.name, err)
        }
      }

      const updated = await productService.getAll()
      setProducts(updated)

      alert(`成功导入 ${successCount} 个商品！`)
    }
    reader.onerror = () => {
      alert('读取文件发生错误')
    }
    reader.readAsText(file, 'UTF-8')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 批量生成拼音简码
  const handleBatchGeneratePinyin = async () => {
    if (!confirm('确定要为所有商品生成拼音简码吗？')) return

    try {
      const count = await invoke<number>('batch_update_pinyin')
      const updated = await productService.getAll()
      setProducts(updated)
      alert(`成功更新 ${count} 个商品的拼音简码！`)
    } catch (error) {
      console.error('批量生成拼音失败:', error)
      alert('批量生成拼音失败: ' + error)
    }
  }

  // 刷新分类列表
  const handleRefreshCategories = async () => {
    try {
      const updated = await categoryService.getAll()
      setCategories(updated)
    } catch (error) {
      console.error('刷新分类失败:', error)
      alert('刷新分类失败: ' + error)
    }
  }

  // 保存分类
  const handleSaveCategory = async (category: Category) => {
    try {
      await categoryService.save(category)
      await handleRefreshCategories()
      setEditingCategory(null)
    } catch (error) {
      console.error('保存分类失败:', error)
      alert('保存分类失败: ' + error)
    }
  }

  // 删除分类
  const handleDeleteCategory = async (id: string) => {
    // 检查是否有商品使用此分类
    const hasProducts = products.some((p: Product) => p.categoryId === id)
    if (hasProducts) {
      alert('该分类下有商品，无法删除！请先删除或移动商品。')
      return
    }

    if (!confirm('确定要删除这个分类吗？')) return

    try {
      await categoryService.delete(id)
      await handleRefreshCategories()
    } catch (error) {
      console.error('删除分类失败:', error)
      alert('删除分类失败: ' + error)
    }
  }

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="page-title">商品管理</h1>
            <p className="page-description">管理商品信息和库存，支持CSV批量导入导出</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
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
            <Button variant="outline" onClick={handleBatchGeneratePinyin}>
              <RefreshCw size={16} />
              生成拼音
            </Button>
            {selectedProducts.size > 0 && (
              <>
                <Button variant="danger" onClick={handleBatchDelete}>
                  <Trash2 size={16} />
                  批量删除 ({selectedProducts.size})
                </Button>
                  <select
                    className="h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm"
                    value=""
                    onChange={(e) => e.target.value && handleBatchChangeCategory(e.target.value)}
                  >
                    <option value="">批量修改分类...</option>
                  {sortedCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{formatCategoryPath(cat.id)}</option>
                  ))}
                  </select>
              </>
            )}
            <Button onClick={handleNew}>
              <Plus size={16} />
              新建商品
            </Button>
            <Button variant="secondary" onClick={() => setShowCategoryPanel(!showCategoryPanel)}>
              <Folder size={16} />
              分类管理
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* 左侧：分类管理面板 */}
        {showCategoryPanel && (
          <Card className="w-64 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">分类管理</h3>
                <button
                  onClick={() => setShowCategoryPanel(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto scrollbar-thin p-2">
              {categories.length === 0 ? (
                <div className="empty-state py-8">
                  <Folder className="empty-state-icon w-12 h-12" />
                  <p className="empty-state-title text-sm">暂无分类</p>
                  <p className="empty-state-description text-xs">点击下方按钮创建</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {rootCategories.map((category: Category, index: number) => {
                    const count = getCategoryProductCount(category.id)
                    const isDragging = draggedCategoryIndex === index
                    const children = childrenMap[category.id] || []

                    return (
                      <div key={category.id}>
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation()
                            handleDragStart(index)
                          }}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            e.stopPropagation()
                            handleDrop(index)
                          }}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center justify-between p-2 rounded-lg group transition-all cursor-move ${isDragging
                            ? 'bg-primary/20 border-2 border-primary'
                            : 'hover:bg-muted/50'
                            }`}
                        >
                          <GripVertical size={14} className="text-muted-foreground mr-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground text-sm truncate">{category.name}</div>
                            <div className="text-xs text-muted-foreground">{count} 个商品</div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex flex-col mr-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMoveCategory(index, 'up'); }}
                                className="p-0.5 text-muted-foreground hover:text-primary rounded"
                                title="上移"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMoveCategory(index, 'down'); }}
                                className="p-0.5 text-muted-foreground hover:text-primary rounded"
                                title="下移"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                            <button
                              onClick={() => setEditingCategory({
                                id: Date.now().toString(),
                                name: '',
                                parentId: category.id,
                                level: category.level + 1,
                                path: `${category.path}/${category.id}`,
                                sortOrder: 0, // Simplified
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              })}
                              className="p-1 text-muted-foreground hover:text-green-600 rounded"
                                    title="添加子分类"
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              onClick={() => setEditingCategory({ ...category })}
                              className="p-1 text-muted-foreground hover:text-primary rounded"
                              title="编辑"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              className="p-1 text-muted-foreground hover:text-destructive rounded"
                              title="删除"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        {children.length > 0 && (
                          <div className="ml-8 mt-1 space-y-1">
                            {children.map(child => (
                              <button
                                key={child.id}
                                onClick={() => handleCategorySelect(child.id)}
                                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${selectedCategory === child.id
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                  }`}
                              >
                                └ {child.name} ({directCategoryCountMap[child.id] || 0})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border flex-shrink-0">
              <Button
                onClick={() => setEditingCategory({
                  id: Date.now().toString(),
                  name: '',
                  level: 0,
                  path: '',
                  sortOrder: categories.length,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })}
                className="w-full"
                size="sm"
              >
                <Plus size={14} />
                新建分类
              </Button>
            </div>
          </Card>
        )}

        {/* 右侧：商品列表 */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* 搜索和筛选 */}
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="搜索商品名称或拼音..."
                  className="pl-10"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* 分类筛选 */}
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-muted-foreground" />
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === null
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    全部 ({products.length})
                  </button>
                  <div className="flex gap-1">
                    {rootCategories.map((cat: any) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === cat.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {cat.name} ({getCategoryProductCount(cat.id)})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 排序选项 */}
              <div className="flex items-center gap-2 ml-4">
                <select
                  className="h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm"
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder]
                    setSortBy(field)
                    setSortOrder(order)
                  }}
                >
                  <option value="name-asc">名称 (A-Z)</option>
                  <option value="name-desc">名称 (Z-A)</option>
                  <option value="price-asc">价格 (低到高)</option>
                  <option value="price-desc">价格 (高到低)</option>
                  <option value="stock-asc">库存 (少到多)</option>
                  <option value="stock-desc">库存 (多到少)</option>
                  <option value="createdAt-asc">创建时间 (旧到新)</option>
                  <option value="createdAt-desc">创建时间 (新到旧)</option>
                </select>
              </div>

              {/* 库存不足筛选 */}
              {lowStockCount > 0 && (
                <button
                  onClick={() => setShowLowStock(!showLowStock)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${showLowStock
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    }`}
                >
                  <AlertTriangle size={14} />
                  库存不足 ({lowStockCount})
                </button>
              )}
            </div>
          </div>

          {/* 商品列表 */}
          <div className="flex-1 overflow-auto scrollbar-thin">
            {filteredProducts.length === 0 ? (
              <div className="empty-state py-20">
                <Package className="empty-state-icon" />
                <p className="empty-state-title">暂无商品</p>
                <p className="empty-state-description">点击"新建商品"添加第一个商品，或导入CSV文件</p>
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
                    <th className="table-cell font-semibold">商品名称</th>
                    <th className="table-cell font-semibold">分类</th>
                    <th className="table-cell font-semibold">单价</th>
                    <th className="table-cell font-semibold">单位</th>
                    <th className="table-cell font-semibold">库存</th>
                    <th className="table-cell font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((product: any) => {
                    const isSelected = selectedProducts.has(product.id)
                    const categoryName = formatCategoryPath(product.categoryId)
                    const isLowStock = product.trackStock && product.stock !== undefined && product.minStock !== undefined && product.stock <= product.minStock
                    return (
                      <tr key={product.id} className={`table-row ${isSelected ? 'bg-primary/5' : ''}`}>
                        <td className="table-cell">
                          <button
                            onClick={() => toggleProductSelection(product.id)}
                            className="flex items-center justify-center w-full"
                          >
                            {isSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                          </button>
                        </td>
                        <td className="table-cell">
                          <div className="font-medium text-foreground">{product.name}</div>
                          {product.pinyin && (
                            <div className="text-xs text-muted-foreground">{product.pinyin}</div>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className="badge badge-neutral">
                            {categoryName}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="font-semibold text-primary">{formatCurrency(product.price)}</span>
                        </td>
                        <td className="table-cell text-muted-foreground">{product.unit}</td>
                        <td className="table-cell">
                          {product.trackStock ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isLowStock ? 'text-destructive' : 'text-foreground'}`}>
                                {product.stock ?? 0}
                              </span>
                              {isLowStock && (
                                <AlertTriangle size={14} className="text-destructive" />
                              )}
                              {product.minStock !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  (最低: {product.minStock})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">不跟踪</span>
                          )}
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingProduct(product)}
                              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="编辑"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 底部统计 */}
          <div className="px-4 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground flex items-center justify-between">
            <div>
              共 {filteredProducts.length} 个商品
              {selectedCategory && ` (筛选自 ${products.length} 个)`}
              {lowStockCount > 0 && (
                <span className="ml-4 text-destructive">
                  ⚠️ {lowStockCount} 个商品库存不足
                </span>
              )}
            </div>
            {selectedProducts.size > 0 && (
              <span className="text-primary font-medium">
                已选择 {selectedProducts.size} 个商品
              </span>
            )}
          </div>
        </Card>
      </div>

      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          categoryOptions={categoryOptions}
          products={products}
          onSave={handleSave}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {editingCategory && (
        <CategoryEditModal
          category={editingCategory}
          onSave={handleSaveCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </div>
  )
}

const ProductEditModal: React.FC<{
  product: Product
  categoryOptions: Array<{ id: string; label: string }>
  products: Product[]
  onSave: (product: Product) => void
  onClose: () => void
}> = ({ product, categoryOptions, products, onSave, onClose }) => {
  const [formData, setFormData] = useState<Product>(product)

  const isNewProduct = !products.find((p: any) => p.id === product.id)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('请输入商品名称')
      return
    }
    if (formData.price < 0) {
      alert('价格不能为负数')
      return
    }
    onSave({
      ...formData,
      updatedAt: new Date().toISOString()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4 text-foreground">
          {isNewProduct ? '新建商品' : '编辑商品'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>商品名称 *</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入商品名称"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>单价 *</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>单位</Label>
              <div className="flex gap-1 items-center">
                <Input
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  className="flex-1"
                  placeholder="输入单位"
                />
                <UnitPresetSelector
                  onSelect={(u) => setFormData({ ...formData, unit: u })}
                  buttonLabel=""
                  buttonClassName="h-10 w-10 p-0 flex items-center justify-center border border-input bg-card"
                />
              </div>
            </div>
          </div>
          <div>
            <Label>分类</Label>
            <select
              className="form-select"
              value={formData.categoryId}
              onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
            >
              {categoryOptions.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>拼音简码</Label>
            <Input
              value={formData.pinyin || ''}
              onChange={e => setFormData({ ...formData, pinyin: e.target.value })}
              placeholder="用于快速搜索，如 pgz"
            />
          </div>

          {/* 库存管理 */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="mb-0">库存管理</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.trackStock || false}
                  onChange={e => setFormData({ ...formData, trackStock: e.target.checked })}
                  className="rounded border-input text-primary accent-primary"
                />
                <span className="text-sm text-muted-foreground">跟踪库存</span>
              </label>
            </div>

            {formData.trackStock && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>当前库存</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.stock ?? ''}
                    onChange={e => setFormData({ ...formData, stock: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>最低库存警告</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.minStock ?? ''}
                    onChange={e => setFormData({ ...formData, minStock: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="低于此值时警告"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              取消
            </Button>
            <Button type="submit" className="flex-1">
              保存
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// 分类编辑模态框
const CategoryEditModal: React.FC<{
  category: Category
  onSave: (category: Category) => void
  onClose: () => void
}> = ({ category, onSave, onClose }) => {
  const [formData, setFormData] = useState<Category>(category)
  const isNewCategory = !category.id || category.id.startsWith(Date.now().toString().slice(0, 10))
  const { categories } = useStore()

  // 获取父分类名称
  const parentCategory = categories.find(c => c.id === formData.parentId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('请输入分类名称')
      return
    }
    onSave({
      ...formData,
      updatedAt: new Date().toISOString()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-4 text-foreground">
          {isNewCategory
            ? (formData.parentId ? '新建子分类' : '新建分类')
            : '编辑分类'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {parentCategory && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">父分类</div>
              <div className="text-sm font-medium text-foreground">{parentCategory.name}</div>
            </div>
          )}
          <div>
            <Label>分类名称 *</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入分类名称"
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              取消
            </Button>
            <Button type="submit" className="flex-1">
              保存
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
