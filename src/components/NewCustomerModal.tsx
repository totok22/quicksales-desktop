import React, { useState } from 'react'
import { User, Phone, CreditCard, Clock, Database } from 'lucide-react'
import { Modal, Input, Button, Label } from './ui'
import { invoke } from '@tauri-apps/api/core'
import type { Customer } from '../types'

interface NewCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (customer: Customer, saveToDatabase: boolean) => void
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    licensePlate: '',
  })
  const [saveToDatabase, setSaveToDatabase] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (forceSaveMode?: boolean) => {
    // 验证:至少需要一个字段
    if (!formData.name.trim() && !formData.phone.trim() && !formData.licensePlate.trim()) {
      alert('请至少填写姓名、电话或车牌号中的一个！')
      return
    }

    const shouldSaveToDb = forceSaveMode !== undefined ? forceSaveMode : saveToDatabase

    setSaving(true)

    try {
      const customer: Customer = {
        id: Date.now().toString(),
        name: formData.name.trim() || '未知客户',
        phone: formData.phone.trim(),
        licensePlate: formData.licensePlate.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // 只有选择保存到数据库时才调用后端
      if (shouldSaveToDb) {
        await invoke('save_customer', { customer })
      }

      // 通知父组件
      onSave(customer, shouldSaveToDb)

      // 重置表单
      setFormData({ name: '', phone: '', licensePlate: '' })
      setSaveToDatabase(true)
      onClose()
    } catch (error) {
      console.error('保存客户失败:', error)
      alert('保存失败: ' + error)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  const resetAndClose = () => {
    setFormData({ name: '', phone: '', licensePlate: '' })
    setSaveToDatabase(true)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="新建客户">
      <div className="space-y-4">
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <User size={16} className="text-muted-foreground" />
            客户姓名
          </Label>
          <Input
            type="text"
            placeholder="输入客户姓名..."
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-2">
            <CreditCard size={16} className="text-muted-foreground" />
            车牌号
          </Label>
          <Input
            type="text"
            placeholder="输入车牌号..."
            value={formData.licensePlate}
            onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-2">
            <Phone size={16} className="text-muted-foreground" />
            联系电话
          </Label>
          <Input
            type="text"
            placeholder="输入联系电话..."
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* 保存模式选择 */}
        <div className="space-y-2">
          <Label>保存模式</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSaveToDatabase(false)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                !saveToDatabase
                  ? 'bg-warning/20 border-warning text-warning'
                  : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Clock size={16} />
              <span className="text-sm">仅本次订单</span>
            </button>
            <button
              type="button"
              onClick={() => setSaveToDatabase(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                saveToDatabase
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Database size={16} />
              <span className="text-sm">保存到数据库</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {saveToDatabase
              ? '💾 客户信息将保存到数据库，下次可以直接选择'
              : '⏱️ 客户信息仅用于本次订单，不会保存到数据库'}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={resetAndClose}
            disabled={saving}
            variant="secondary"
            className="flex-1"
          >
            取消
          </Button>
          <Button
            onClick={() => handleSubmit()}
            disabled={saving}
            className="flex-1"
          >
            {saving ? '保存中...' : saveToDatabase ? '保存并选择' : '使用临时客户'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
