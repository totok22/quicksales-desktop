import React, { useState } from 'react'
import {
  Package,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  ClipboardList,
  History,
  Database,
  Menu,
  X,
} from 'lucide-react'
import { ViewState } from '../../types'
import { cn } from '../../lib/utils'

interface TopNavProps {
  currentView: ViewState
  onChangeView: (view: ViewState) => void
}

// 菜单分组 - 紧凑设计
const menuGroups = [
  {
    title: '订单',
    items: [
      { id: 'order' as ViewState, label: '新建订单', icon: ClipboardList },
      { id: 'history' as ViewState, label: '订单历史', icon: History },
    ]
  },
  {
    title: '数据',
    items: [
      { id: 'products' as ViewState, label: '商品', icon: Package },
      { id: 'customers' as ViewState, label: '客户', icon: Users },
    ]
  },
  {
    title: '配置',
    items: [
      { id: 'remark-presets' as ViewState, label: '预设', icon: MessageSquare },
      { id: 'analytics' as ViewState, label: '统计', icon: BarChart3 },
      { id: 'settings' as ViewState, label: '设置', icon: Settings },
    ]
  },
]

const TopNav: React.FC<TopNavProps> = ({ currentView, onChangeView }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* 顶部导航栏 - 紧凑设计 */}
      <div className="bg-slate-900 text-white">
        <div className="flex items-center justify-between px-3 h-10 border-b border-slate-700/50">
          {/* Logo - 小尺寸 */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-sky-400 to-blue-600 rounded flex items-center justify-center">
              <Database size={14} className="text-white" />
            </div>
            <span className="hidden sm:inline text-sm font-bold">QuickSales</span>
          </div>

          {/* 桌面端导航菜单 - 紧凑 */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {menuGroups.map((group) => (
              <div key={group.title} className="flex items-center gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = currentView === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => onChangeView(item.id)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1.5 rounded transition-all duration-150 text-xs",
                        isActive
                          ? "bg-sky-500 text-white font-medium"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      )}
                      title={item.label}
                    >
                      <Icon size={14} />
                      <span className="hidden sm:inline">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* 移动端菜单按钮 - 小尺寸 */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1 rounded hover:bg-slate-800/50 transition-colors"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* 移动端下拉菜单 - 紧凑 */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 border-b border-slate-700/50">
            <nav className="px-2 py-2">
              {menuGroups.map((group) => (
                <div key={group.title} className="mb-2 last:mb-0">
                  <div className="px-2 mb-1">
                    <span className="text-[9px] font-semibold uppercase text-slate-500">
                      {group.title}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = currentView === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onChangeView(item.id)
                            setMobileMenuOpen(false)
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded transition-all duration-150 text-xs",
                            isActive
                              ? "bg-sky-500 text-white font-medium"
                              : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <Icon size={14} />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        )}
      </div>
    </>
  )
}

export default TopNav
