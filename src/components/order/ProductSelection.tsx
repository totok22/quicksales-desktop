import React, { useMemo } from 'react'
import { Search, Package } from 'lucide-react'
import { Button, Input } from '../ui'
import { formatCurrency } from '../../lib/utils'
import type { Product, Category, OrderItem } from '../../types'

interface ProductSelectionProps {
    products: Product[]
    categories: Category[]
    cart: OrderItem[]
    searchTerm: string
    onSearchChange: (term: string) => void
    selectedCategory: string | null
    onCategorySelect: (id: string | null) => void
    onAddToCart: (product: Product) => void
    onOpenQuickAdd: () => void
}

export const ProductSelection: React.FC<ProductSelectionProps> = ({
    products,
    categories,
    cart,
    searchTerm,
    onSearchChange,
    selectedCategory,
    onCategorySelect,
    onAddToCart,
    onOpenQuickAdd,
}) => {
    // 过滤商品
    const filteredProducts = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()
        return products.filter(product => {
            const pinyinTokens = (product.pinyin || '').toLowerCase().split(/\s+/).filter(Boolean)
            const pinyinJoined = pinyinTokens.join('')

            const matchesSearch =
                normalizedSearch.length === 0 ||
                product.name.toLowerCase().includes(normalizedSearch) ||
                pinyinTokens.some(token => token.includes(normalizedSearch) || token.startsWith(normalizedSearch)) ||
                pinyinJoined.includes(normalizedSearch) ||
                pinyinJoined.startsWith(normalizedSearch)

            const matchesCategory = selectedCategory ? product.categoryId === selectedCategory : true
            return matchesSearch && matchesCategory
        })
    }, [products, searchTerm, selectedCategory])

    // 判断商品库存状态
    const getStockStatus = (productId: string, cartQuantity: number = 0) => {
        const product = products.find(p => p.id === productId)
        if (!product?.trackStock || product.stock === undefined) {
            return { tracked: false, available: null, isLow: false, isInsufficient: false }
        }
        const isLow = product.minStock !== undefined && product.stock <= product.minStock
        const isInsufficient = cartQuantity > product.stock
        return { tracked: true, available: product.stock, isLow, isInsufficient }
    }

    return (
        <div className="flex flex-col h-full bg-muted/30">
            {/* 搜索和分类 */}
            <div className="p-4 bg-card border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                            placeholder="搜索商品..."
                            className="pl-10 h-9"
                            value={searchTerm}
                            onChange={e => onSearchChange(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenQuickAdd}
                        title="快速添加商品"
                    >
                        <Package size={16} />
                        新商品
                    </Button>
                </div>

                {/* 分类标签 */}
                <div className="flex gap-1.5 flex-wrap">
                    <button
                        onClick={() => onCategorySelect(null)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === null
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        全部 ({products.length})
                    </button>
                    {categories.map(cat => {
                        const count = products.filter(p => p.categoryId === cat.id).length
                        return (
                            <button
                                key={cat.id}
                                onClick={() => onCategorySelect(cat.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === cat.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {cat.name} ({count})
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 商品列表 */}
            <div className="flex-1 overflow-auto p-4 scrollbar-thin">
                {filteredProducts.length === 0 ? (
                    <div className="empty-state">
                        <Package className="empty-state-icon" />
                        <p className="empty-state-title">未找到商品</p>
                        <p className="empty-state-description">试试其他搜索词或分类</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {filteredProducts.map(product => {
                            const inCart = cart.find(item => item.id === product.id)
                            const stockStatus = getStockStatus(product.id, inCart?.quantity || 0)
                            const isOutOfStock = stockStatus.tracked && stockStatus.available === 0

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => !isOutOfStock && onAddToCart(product)}
                                    disabled={isOutOfStock}
                                    className={`relative p-4 rounded-xl text-left transition-all ${isOutOfStock
                                        ? 'bg-muted border border-border opacity-60 cursor-not-allowed'
                                        : inCart
                                            ? 'bg-primary/10 border-2 border-primary'
                                            : 'bg-card border border-border hover:border-primary/50 hover:shadow-card-hover'
                                        }`}
                                >
                                    <div className="font-medium text-foreground text-sm mb-1 line-clamp-1">
                                        {product.name}
                                    </div>
                                    <div className="text-lg font-bold text-primary">
                                        {formatCurrency(product.price)}
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">{product.unit}</span>
                                        {stockStatus.tracked && (
                                            <span className={`font-medium ${isOutOfStock
                                                ? 'text-destructive'
                                                : stockStatus.isLow
                                                    ? 'text-amber-500'
                                                    : 'text-muted-foreground'
                                                }`}>
                                                库存: {stockStatus.available}
                                                {stockStatus.isLow && !isOutOfStock && ' ⚠'}
                                            </span>
                                        )}
                                    </div>
                                    {inCart && (
                                        <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${stockStatus.isInsufficient
                                            ? 'bg-destructive text-destructive-foreground'
                                            : 'bg-primary text-primary-foreground'
                                            }`}>
                                            {inCart.quantity}
                                        </div>
                                    )}
                                    {isOutOfStock && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                                            <span className="text-destructive font-medium text-sm">缺货</span>
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
