import React, { useState } from 'react'
import { Modal, Input, Label, Button } from './ui'
import { RemarkPresetSelector } from './RemarkPresetSelector'
import type { OrderItem } from '../types'
import { formatCurrency } from '../lib/utils'

interface EditItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (updates: { discountPrice?: number; quantity: number; remark?: string; updateDefaultPrice?: boolean; newDefaultPrice?: number }) => void
  item: OrderItem
}

export const EditItemModal: React.FC<EditItemModalProps> = ({ isOpen, onClose, onSave, item }) => {
  const [priceMode, setPriceMode] = useState<'original' | 'temporary' | 'permanent'>('original')
  const [temporaryPrice, setTemporaryPrice] = useState<number>(item.discountPrice ?? item.price)
  const [permanentPrice, setPermanentPrice] = useState<number>(item.price)
  const [quantity, setQuantity] = useState<number>(item.quantity)
  const [remark, setRemark] = useState<string>(item.remark || '')

  const handleSave = () => {
    const updates: { discountPrice?: number; quantity: number; remark?: string; updateDefaultPrice?: boolean; newDefaultPrice?: number } = {
      quantity,
      remark: remark.trim() || undefined,
    }

    if (priceMode === 'temporary') {
      updates.discountPrice = temporaryPrice
    } else if (priceMode === 'permanent' && permanentPrice !== item.price) {
      updates.updateDefaultPrice = true
      updates.newDefaultPrice = permanentPrice
    }

    onSave(updates)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`编辑商品 - ${item.name}`}>
      <div className="space-y-4">
        {/* 商品信息 */}
        <div className="bg-muted p-3 rounded-md">
          <div className="font-medium text-foreground">{item.name}</div>
          <div className="text-sm text-muted-foreground">原价: {formatCurrency(item.price)} / {item.unit}</div>
        </div>

        {/* 价格模式选择 */}
        <div>
          <Label className="mb-2">价格模式</Label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="priceMode"
                checked={priceMode === 'original'}
                onChange={() => setPriceMode('original')}
                className="w-4 h-4 text-primary accent-primary"
              />
              <span className="text-sm text-foreground">原价 ({formatCurrency(item.price)})</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="priceMode"
                checked={priceMode === 'temporary'}
                onChange={() => setPriceMode('temporary')}
                className="w-4 h-4 text-primary accent-primary"
              />
              <span className="text-sm text-foreground">临时价格 (仅此订单)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="priceMode"
                checked={priceMode === 'permanent'}
                onChange={() => setPriceMode('permanent')}
                className="w-4 h-4 text-primary accent-primary"
              />
              <span className="text-sm text-foreground">永久价格 (修改商品默认价格)</span>
            </label>
          </div>
        </div>

        {/* 临时价格输入 */}
        {priceMode === 'temporary' && (
          <div>
            <Label>临时价格</Label>
            <Input
              type="number"
              step="0.01"
              value={temporaryPrice}
              onChange={e => setTemporaryPrice(Number(e.target.value))}
              className="mt-1"
            />
          </div>
        )}

        {/* 永久价格输入 */}
        {priceMode === 'permanent' && (
          <div>
            <Label>新默认价格</Label>
            <Input
              type="number"
              step="0.01"
              value={permanentPrice}
              onChange={e => setPermanentPrice(Number(e.target.value))}
              className="mt-1"
            />
            <p className="text-xs text-warning mt-1">⚠️ 这将修改商品的默认价格,影响所有后续订单</p>
          </div>
        )}

        {/* 数量输入 */}
        <div>
          <Label>数量</Label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
            className="mt-1"
          />
        </div>

        {/* 备注 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>备注</Label>
            <RemarkPresetSelector
              type="item"
              onSelect={(content) => {
                // 追加到现有备注
                setRemark(prev => prev ? `${prev} ${content}` : content)
              }}
              buttonLabel="选择预设"
            />
          </div>
          <textarea
            className="w-full mt-1 p-2 border border-input bg-background text-foreground rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
            placeholder="输入商品备注..."
            value={remark}
            onChange={e => setRemark(e.target.value)}
          />
        </div>

        {/* 按钮组 */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
          >
            保存
          </Button>
        </div>
      </div>
    </Modal>
  )
}
