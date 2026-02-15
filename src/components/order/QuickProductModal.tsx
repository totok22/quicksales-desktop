import React, { useState } from 'react'
import { Card, Button, Input, Label } from '../ui'
import { UnitPresetSelector } from '../UnitPresetSelector'
import { Plus } from 'lucide-react'
import type { Product } from '../../types'

interface QuickProductModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void
    categories: { id: string; name: string }[]
}

export const QuickProductModal: React.FC<QuickProductModalProps> = ({ isOpen, onClose, onSave, categories }) => {
    const [name, setName] = useState('')
    const [price, setPrice] = useState('')
    const [unit, setUnit] = useState('件')
    const [categoryId, setCategoryId] = useState('')

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || !price) {
            alert('请填写商品名称和价格')
            return
        }
        onSave({
            name: name.trim(),
            price: parseFloat(price),
            unit: unit.trim() || '件',
            categoryId: categoryId || categories[0]?.id || '',
            pinyin: '',
        })
        setName('')
        setPrice('')
        setUnit('件')
        setCategoryId('')
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">快速添加商品</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>商品名称 *</Label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
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
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <Label>单位</Label>
                            <div className="flex gap-1 items-center">
                                <Input
                                    value={unit}
                                    onChange={e => setUnit(e.target.value)}
                                    placeholder="输入单位"
                                    className="flex-1"
                                />
                                <UnitPresetSelector
                                    onSelect={(u) => setUnit(u)}
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
                            value={categoryId}
                            onChange={e => setCategoryId(e.target.value)}
                        >
                            <option value="">选择分类</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                            取消
                        </Button>
                        <Button type="submit" className="flex-1">
                            <Plus size={16} />
                            添加商品
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}
