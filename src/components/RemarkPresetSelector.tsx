import React, { useState, useEffect } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import type { RemarkPreset } from '../types'

interface RemarkPresetSelectorProps {
  type: 'item' | 'order'
  onSelect: (content: string) => void
  multiSelect?: boolean
  buttonLabel?: string
  buttonClassName?: string
}

export const RemarkPresetSelector: React.FC<RemarkPresetSelectorProps> = ({
  type,
  onSelect,
  multiSelect = false,
  buttonLabel = '预设',
  buttonClassName = '',
}) => {
  const [open, setOpen] = useState(false)
  const [presets, setPresets] = useState<RemarkPreset[]>([])
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set())

  // 加载预设
  useEffect(() => {
    if (open) {
      invoke<RemarkPreset[]>('get_remark_presets_by_type', { presetType: type })
        .then(data => {
          // 按使用次数和排序排序
          const sorted = data.sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) {
              return a.sortOrder - b.sortOrder
            }
            return b.useCount - a.useCount
          })
          setPresets(sorted)
        })
        .catch(error => {
          console.error('加载备注预设失败:', error)
        })
    }
  }, [open, type])

  const handleSelect = (preset: RemarkPreset) => {
    if (multiSelect) {
      const newSelected = new Set(selectedPresets)
      if (newSelected.has(preset.id)) {
        newSelected.delete(preset.id)
      } else {
        newSelected.add(preset.id)
      }
      setSelectedPresets(newSelected)
    } else {
      // 单选模式,直接选中并关闭
      onSelect(preset.content)
      setOpen(false)

      // 增加使用次数
      invoke('increment_remark_use_count', { id: preset.id }).catch(console.error)
    }
  }

  const handleConfirmMulti = () => {
    if (selectedPresets.size === 0) {
      setOpen(false)
      setSelectedPresets(new Set())
      return
    }

    // 获取选中的预设内容并合并
    const selectedContents = presets
      .filter(p => selectedPresets.has(p.id))
      .map(p => p.content)

    const combined = selectedContents.join(' ')
    onSelect(combined)

    // 增加所有选中预设的使用次数
    selectedPresets.forEach(id => {
      invoke('increment_remark_use_count', { id: id }).catch(console.error)
    })

    setOpen(false)
    setSelectedPresets(new Set())
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors ${buttonClassName}`}
      >
        <MessageSquare size={14} />
        {buttonLabel}
      </button>

      {open && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false)
              setSelectedPresets(new Set())
            }}
          />

          {/* 下拉面板 */}
          <div className="absolute z-50 top-full mt-2 right-0 w-72 bg-card rounded-lg shadow-xl border border-border max-h-80 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border bg-muted">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground text-sm">
                  {type === 'item' ? '商品备注预设' : '订单备注预设'}
                </h4>
                <button
                  onClick={() => {
                    setOpen(false)
                    setSelectedPresets(new Set())
                  }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              {multiSelect && (
                <p className="text-xs text-muted-foreground mt-1">可选择多个预设</p>
              )}
            </div>

            <div className="flex-1 overflow-auto p-2">
              {presets.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-4">
                  暂无预设
                </div>
              ) : (
                <div className="space-y-1">
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelect(preset)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedPresets.has(preset.id)
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'hover:bg-muted text-foreground border border-transparent'
                      }`}
                    >
                      <div>{preset.content}</div>
                      {preset.useCount > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          使用 {preset.useCount} 次
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {multiSelect && presets.length > 0 && (
              <div className="p-3 border-t border-border bg-muted">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPresets(new Set())}
                    className="flex-1 px-3 py-2 text-sm bg-card border border-border rounded hover:bg-muted text-foreground transition-colors"
                  >
                    清空选择
                  </button>
                  <button
                    onClick={handleConfirmMulti}
                    disabled={selectedPresets.size === 0}
                    className="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    确定 ({selectedPresets.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
