import React, { useState, useEffect } from 'react'
import { Hash, X } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import type { UnitPreset } from '../types'

interface UnitPresetSelectorProps {
    onSelect: (content: string) => void
    buttonLabel?: string
    buttonClassName?: string
}

export const UnitPresetSelector: React.FC<UnitPresetSelectorProps> = ({
    onSelect,
    buttonLabel = '单位',
    buttonClassName = '',
}) => {
    const [open, setOpen] = useState(false)
    const [presets, setPresets] = useState<UnitPreset[]>([])

    // 加载单位预设
    useEffect(() => {
        if (open) {
            invoke<UnitPreset[]>('get_all_unit_presets')
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
                    console.error('加载单位预设失败:', error)
                })
        }
    }, [open])

    const handleSelect = (preset: UnitPreset) => {
        onSelect(preset.name)
        setOpen(false)

        // 增加使用次数
        invoke('increment_unit_preset_use_count', { id: preset.id }).catch(console.error)
    }

    return (
        <div className="relative inline-block">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs bg-secondary/80 text-secondary-foreground hover:bg-secondary rounded transition-colors ${buttonClassName}`}
            >
                <Hash size={14} />
                {buttonLabel}
            </button>

            {open && (
                <>
                    {/* 遮罩层 */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                            setOpen(false)
                        }}
                    />

                    {/* 下拉面板 */}
                    <div className="absolute z-50 top-full mt-2 left-0 w-48 bg-card rounded-lg shadow-xl border border-border max-h-60 overflow-hidden flex flex-col">
                        <div className="p-3 border-b border-border bg-muted">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium text-foreground text-sm">单位预设</h4>
                                <button
                                    onClick={() => {
                                        setOpen(false)
                                    }}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-2">
                            {presets.length === 0 ? (
                                <div className="text-center text-muted-foreground text-sm py-4">
                                    暂无预设
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-1">
                                    {presets.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleSelect(preset)}
                                            className="text-left px-3 py-2 rounded text-sm hover:bg-muted text-foreground border border-transparent transition-colors truncate"
                                            title={preset.name}
                                        >
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
