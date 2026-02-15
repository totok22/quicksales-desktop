import React, { useState } from 'react'
import { ShoppingCart, AlertTriangle, X, Check, Edit3, Trash2, Minus, Plus } from 'lucide-react'
import { Input, Label } from '../ui'
import { UnitPresetSelector } from '../UnitPresetSelector'
import { RemarkPresetSelector } from '../RemarkPresetSelector'
import { formatCurrency } from '../../lib/utils'
import { invoke } from '@tauri-apps/api/core'
import type { OrderItem, Product } from '../../types'

interface CartItemListProps {
    cart: OrderItem[]
    products: Product[]
    stockWarnings: { itemId: string; productName: string; requested: number; available: number }[]
    onUpdateCart: (cart: OrderItem[]) => void
}

export const CartItemList: React.FC<CartItemListProps> = ({
    cart,
    products,
    stockWarnings,
    onUpdateCart,
}) => {
    // 内联编辑状态
    const [editingItemId, setEditingItemId] = useState<string | null>(null)
    const [editDiscountPrice, setEditDiscountPrice] = useState<string>('')
    const [editRemark, setEditRemark] = useState<string>('')
    const [editQuantity, setEditQuantity] = useState<number>(1)
    const [editUnit, setEditUnit] = useState<string>('')
    const [isTemporaryPrice, setIsTemporaryPrice] = useState<boolean>(false)

    // 开启内联编辑
    const openInlineEdit = (item: OrderItem) => {
        setEditingItemId(item.id)
        setEditDiscountPrice(item.discountPrice?.toString() || '')
        setEditQuantity(item.quantity)
        setEditUnit(item.unit || '件')
        setEditRemark(item.remark || '')
        setIsTemporaryPrice(false)
    }

    // 取消内联编辑
    const cancelInlineEdit = () => {
        setEditingItemId(null)
        setEditDiscountPrice('')
        setEditQuantity(1)
        setEditUnit('')
        setEditRemark('')
    }

    // 保存内联编辑
    const saveInlineEdit = async (itemId: string) => {
        const discountPrice = editDiscountPrice ? parseFloat(editDiscountPrice) : undefined

        // 如果不是暂时价格（即默认永久修改价格），且有修改
        if (!isTemporaryPrice && discountPrice !== undefined) {
            try {
                await invoke('update_product_price', {
                    productId: itemId,
                    newPrice: discountPrice
                })
                console.log('永久价格更新成功')
            } catch (error) {
                console.error('永久价格更新失败:', error)
            }
        }

        const updatedCart = cart.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    quantity: editQuantity,
                    unit: editUnit || item.unit,
                    discountPrice,
                    remark: editRemark || undefined,
                }
            }
            return item
        })

        onUpdateCart(updatedCart)
        cancelInlineEdit()
    }

    // 更新数量
    const updateQuantity = (itemId: string, delta: number) => {
        const updatedCart = cart.map(item => {
            if (item.id === itemId) {
                const newQuantity = Math.max(1, item.quantity + delta)
                return { ...item, quantity: newQuantity }
            }
            return item
        })
        onUpdateCart(updatedCart)
    }

    // 删除商品
    const removeFromCart = (itemId: string) => {
        const updatedCart = cart.filter(item => item.id !== itemId)
        onUpdateCart(updatedCart)
    }

    // 判断商品库存状态 (Helper)
    const getStockStatus = (productId: string, cartQuantity: number = 0) => {
        const product = products.find(p => p.id === productId)
        if (!product?.trackStock || product.stock === undefined) {
            return { tracked: false, available: null, isLow: false, isInsufficient: false }
        }
        const isLow = product.minStock !== undefined && product.stock <= product.minStock
        const isInsufficient = cartQuantity > product.stock
        return { tracked: true, available: product.stock, isLow, isInsufficient }
    }

    if (cart.length === 0) {
        return (
            <div className="empty-state py-16">
                <ShoppingCart className="empty-state-icon" />
                <p className="empty-state-title">购物车是空的</p>
                <p className="empty-state-description">从左侧选择商品</p>
            </div>
        )
    }

    return (
        <div className="divide-y divide-border">
            {cart.map(item => {
                const price = item.discountPrice ?? item.price
                const subtotal = price * item.quantity
                const stockStatus = getStockStatus(item.id, item.quantity)
                const hasStockWarning = stockWarnings.some(w => w.itemId === item.id)
                const isEditing = editingItemId === item.id

                return (
                    <div
                        key={item.id}
                        className={`p-4 hover:bg-muted/30 transition-colors group ${hasStockWarning ? 'bg-destructive/5' : ''
                            } ${isEditing ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    >
                        {isEditing ? (
                            // 编辑模式
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-foreground text-sm line-clamp-1">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={cancelInlineEdit}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                                            title="取消"
                                        >
                                            <X size={14} />
                                        </button>
                                        <button
                                            onClick={() => saveInlineEdit(item.id)}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                            title="保存"
                                        >
                                            <Check size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-6 gap-2">
                                    <div className="col-span-2">
                                        <Label className="text-xs">数量</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={editQuantity}
                                            onChange={e => setEditQuantity(Math.max(1, Number(e.target.value)))}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-xs">单位</Label>
                                        <div className="flex gap-1 items-center">
                                            <Input
                                                value={editUnit}
                                                onChange={e => setEditUnit(e.target.value)}
                                                className="h-8 text-sm flex-1"
                                                placeholder="输入单位"
                                            />
                                            <UnitPresetSelector
                                                onSelect={(u) => setEditUnit(u)}
                                                buttonLabel=""
                                                buttonClassName="h-8 w-8 p-0 flex items-center justify-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-xs">单价</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="1"
                                            value={editDiscountPrice}
                                            onChange={e => setEditDiscountPrice(e.target.value)}
                                            placeholder={`原价:${item.price}`}
                                            className="h-8 text-sm"
                                        />
                                        <label className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={isTemporaryPrice}
                                                onChange={e => setIsTemporaryPrice(e.target.checked)}
                                                className="w-3 h-3 rounded border-input text-primary accent-primary"
                                            />
                                            <span className="group-hover:text-primary transition-colors">暂时调价</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs">备注</Label>
                                    <div className="flex gap-1 items-center">
                                        <Input
                                            value={editRemark}
                                            onChange={e => setEditRemark(e.target.value)}
                                            placeholder="输入备注..."
                                            className="h-8 text-sm flex-1"
                                        />
                                        <RemarkPresetSelector
                                            type="item"
                                            onSelect={(c) => setEditRemark(c)}
                                            buttonLabel=""
                                            buttonClassName="h-8 w-8 p-0 flex items-center justify-center"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm py-1">
                                    <span className="text-muted-foreground">小计:</span>
                                    <span className="font-bold text-primary">
                                        {formatCurrency((editDiscountPrice ? parseFloat(editDiscountPrice) : item.price) * editQuantity)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            // 查看模式
                            <>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-foreground text-sm line-clamp-1">{item.name}</span>
                                            {hasStockWarning && (
                                                <AlertTriangle size={14} className="text-destructive flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{item.unit}</span>
                                            {stockStatus.tracked && (
                                                <span className={hasStockWarning ? 'text-destructive' : ''}>
                                                    (库存: {stockStatus.available})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                        <button
                                            onClick={() => openInlineEdit(item)}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                            title="编辑"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                                            title="删除"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateQuantity(item.id, -1)}
                                            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition-colors"
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className={`w-8 text-center text-sm font-medium ${hasStockWarning ? 'text-destructive' : 'text-foreground'
                                            }`}>{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.id, 1)}
                                            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition-colors"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-primary">{formatCurrency(subtotal)}</div>
                                        {item.discountPrice && item.discountPrice !== item.price && (
                                            <div className="text-xs text-muted-foreground line-through">{formatCurrency(item.price * item.quantity)}</div>
                                        )}
                                    </div>
                                </div>

                                {item.remark && (
                                    <div className="mt-2 text-xs text-primary bg-primary/5 px-2 py-1 rounded">{item.remark}</div>
                                )}
                            </>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
