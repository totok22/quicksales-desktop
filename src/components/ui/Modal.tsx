import React from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={onClose}
      />

      {/* 模态框内容 */}
      <div className={`relative bg-card text-card-foreground rounded-lg shadow-xl ${sizeClasses[size]} w-full mx-4 max-h-[90vh] overflow-auto border border-border`}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
