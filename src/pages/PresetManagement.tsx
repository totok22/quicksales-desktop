import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Search, MessageSquare, Package, ChevronUp, ChevronDown } from 'lucide-react'
import { Card, Button, Input, Label, Modal } from '../components/ui'
import type { RemarkPreset, UnitPreset } from '../types'
import { invoke } from '@tauri-apps/api/core'

type ManagementType = 'remark' | 'unit'

export const PresetManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ManagementType>('remark')
    const [remarkPresets, setRemarkPresets] = useState<RemarkPreset[]>([])
    const [unitPresets, setUnitPresets] = useState<UnitPreset[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [filterRemarkType, setFilterRemarkType] = useState<'all' | 'item' | 'order'>('all')

    const [modalOpen, setModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<RemarkPreset | UnitPreset | null>(null)

    const [remarkForm, setRemarkForm] = useState({
        content: '',
        type: 'item' as 'item' | 'order',
        sortOrder: 0,
    })

    const [unitForm, setUnitForm] = useState({
        name: '',
        sortOrder: 0,
    })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const remarks = await invoke<RemarkPreset[]>('get_all_remark_presets')
            setRemarkPresets(remarks)
            const units = await invoke<UnitPreset[]>('get_all_unit_presets')
            setUnitPresets(units)
        } catch (error) {
            console.error('加载预设失败:', error)
        }
    }

    // 打开模态框
    const openModal = (item?: RemarkPreset | UnitPreset) => {
        if (activeTab === 'remark') {
            const remark = item as RemarkPreset | undefined
            setEditingItem(remark || null)
            setRemarkForm({
                content: remark?.content || '',
                type: remark?.type || 'item',
                sortOrder: remark?.sortOrder ?? remarkPresets.length,
            })
        } else {
            const unit = item as UnitPreset | undefined
            setEditingItem(unit || null)
            setUnitForm({
                name: unit?.name || '',
                sortOrder: unit?.sortOrder ?? unitPresets.length,
            })
        }
        setModalOpen(true)
    }

    // 保存
    const handleSave = async () => {
        try {
            if (activeTab === 'remark') {
                if (!remarkForm.content.trim()) return alert('请输入内容')
                const preset: RemarkPreset = {
                    id: editingItem?.id || Date.now().toString(),
                    content: remarkForm.content.trim(),
                    type: remarkForm.type,
                    sortOrder: remarkForm.sortOrder,
                    useCount: (editingItem as RemarkPreset)?.useCount || 0,
                    createdAt: (editingItem as RemarkPreset)?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }
                await invoke('save_remark_preset', { preset })
            } else {
                if (!unitForm.name.trim()) return alert('请输入单位名称')
                const preset: UnitPreset = {
                    id: editingItem?.id || Date.now().toString(),
                    name: unitForm.name.trim(),
                    sortOrder: unitForm.sortOrder,
                    useCount: (editingItem as UnitPreset)?.useCount || 0,
                    createdAt: (editingItem as UnitPreset)?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }
                await invoke('save_unit_preset', { preset })
            }
            setModalOpen(false)
            loadData()
        } catch (error) {
            alert('保存失败: ' + error)
        }
    }

    // 删除
    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除吗?')) return
        try {
            const cmd = activeTab === 'remark' ? 'delete_remark_preset' : 'delete_unit_preset'
            await invoke(cmd, { id })
            loadData()
        } catch (error) {
            alert('删除失败: ' + error)
        }
    }

    // 排序
    const handleMove = async (index: number, direction: 'up' | 'down') => {
        const list = activeTab === 'remark' ? [...remarkPresets] : [...unitPresets]
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= list.length) return

        // 交换
        const temp = list[index]
        list[index] = list[newIndex]
        list[newIndex] = temp

        // 更新所有 item 的 sortOrder 保持一致
        const updatedList = list.map((item, idx) => ({ ...item, sortOrder: idx }))

        try {
            const cmd = activeTab === 'remark' ? 'save_remark_preset' : 'save_unit_preset'
            const argName = activeTab === 'remark' ? 'preset' : 'preset'

            // 这里可以批量更新，或者一个一个更新。目前Rust脚本可能不支持批量，我们循环一下。
            // 为简化，先更新交换的两个。
            await invoke(cmd, { [argName]: updatedList[index] })
            await invoke(cmd, { [argName]: updatedList[newIndex] })

            loadData()
        } catch (error) {
            console.error('排序失败:', error)
        }
    }

    const filteredRemarks = remarkPresets.filter(p => {
        const matchSearch = p.content.toLowerCase().includes(searchTerm.toLowerCase())
        const matchType = filterRemarkType === 'all' || p.type === filterRemarkType
        return matchSearch && matchType
    })

    const filteredUnits = unitPresets.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-6 h-full flex flex-col bg-background">
            <div className="page-header">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="page-title">预设管理</h1>
                        <p className="page-description">管理单位和常用备注信息</p>
                    </div>
                    <Button onClick={() => openModal()}>
                        <Plus size={16} />
                        新建{activeTab === 'remark' ? '备注' : '单位'}
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 mb-4 bg-muted/50 p-1 rounded-xl w-fit">
                <button
                    onClick={() => { setActiveTab('remark'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'remark' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <MessageSquare size={16} />
                    备注预设
                </button>
                <button
                    onClick={() => { setActiveTab('unit'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'unit' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Package size={16} />
                    单位预设
                </button>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                            placeholder={`搜索${activeTab === 'remark' ? '备注' : '单位'}...`}
                            className="pl-10"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {activeTab === 'remark' && (
                        <div className="flex gap-1 bg-muted p-1 rounded-lg">
                            {(['all', 'item', 'order'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilterRemarkType(t)}
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterRemarkType === t ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'
                                        }`}
                                >
                                    {t === 'all' ? '全部' : t === 'item' ? '商品' : '订单'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto p-4 scrollbar-thin">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(activeTab === 'remark' ? filteredRemarks : filteredUnits).sort((a, b) => a.sortOrder - b.sortOrder).map((item, idx) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:shadow-card-hover group">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {activeTab === 'remark' && (
                                            <span className={`badge ${(item as RemarkPreset).type === 'item' ? 'badge-primary' : 'badge-success'}`}>
                                                {(item as RemarkPreset).type === 'item' ? '商品' : '订单'}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground">使用 {item.useCount} 次</span>
                                    </div>
                                    <p className="font-medium truncate">{activeTab === 'remark' ? (item as RemarkPreset).content : (item as UnitPreset).name}</p>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex flex-col">
                                        <button onClick={() => handleMove(idx, 'up')} className="p-0.5 hover:text-primary"><ChevronUp size={14} /></button>
                                        <button onClick={() => handleMove(idx, 'down')} className="p-0.5 hover:text-primary"><ChevronDown size={14} /></button>
                                    </div>
                                    <button onClick={() => openModal(item)} className="p-2 text-muted-foreground hover:text-primary"><Edit3 size={16} /></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editingItem ? '编辑' : '新建'}${activeTab === 'remark' ? '备注' : '单位'}`}>
                <div className="space-y-4">
                    {activeTab === 'remark' ? (
                        <>
                            <div>
                                <Label>备注内容 *</Label>
                                <textarea className="form-textarea min-h-[100px]" value={remarkForm.content} onChange={e => setRemarkForm({ ...remarkForm, content: e.target.value })} />
                            </div>
                            <div>
                                <Label>类型</Label>
                                <select className="form-select" value={remarkForm.type} onChange={e => setRemarkForm({ ...remarkForm, type: e.target.value as any })}>
                                    <option value="item">商品级别</option>
                                    <option value="order">订单级别</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <div>
                            <Label>单位名称 *</Label>
                            <Input value={unitForm.name} onChange={e => setUnitForm({ ...unitForm, name: e.target.value })} />
                        </div>
                    )}
                    <div>
                        <Label>排序权重</Label>
                        <Input type="number" value={activeTab === 'remark' ? remarkForm.sortOrder : unitForm.sortOrder} onChange={e => activeTab === 'remark' ? setRemarkForm({ ...remarkForm, sortOrder: Number(e.target.value) }) : setUnitForm({ ...unitForm, sortOrder: Number(e.target.value) })} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>取消</Button>
                        <Button className="flex-1" onClick={handleSave}>保存</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
