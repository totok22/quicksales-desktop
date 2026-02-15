import React from 'react'
import {
  Package,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  ClipboardList,
  History,
  Database
} from 'lucide-react'
import { ViewState } from '../../types'
import { cn } from '../../lib/utils'

interface SidebarProps {
  currentView: ViewState
  onChangeView: (view: ViewState) => void
}

// 菜单分组
const menuGroups = [
  {
    title: '订单',
    items: [
      { id: 'order' as ViewState, label: '新建订单', icon: ClipboardList },
      { id: 'history' as ViewState, label: '订单历史', icon: History },
    ]
  },
  {
    title: '数据管理',
    items: [
      { id: 'products' as ViewState, label: '商品管理', icon: Package },
      { id: 'customers' as ViewState, label: '客户管理', icon: Users },
    ]
  },
  {
    title: '配置',
    items: [
      { id: 'remark-presets' as ViewState, label: '预设管理', icon: MessageSquare },
      { id: 'analytics' as ViewState, label: '销售统计', icon: BarChart3 },
      { id: 'settings' as ViewState, label: '系统设置', icon: Settings },
    ]
  },
]

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  return (
    <div className="w-56 bg-slate-900 text-white flex flex-col h-full shadow-xl">
      {/* Logo 区域 */}
      <div className="px-5 py-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <Database size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">QuickSales</h1>
            <p className="text-[11px] text-slate-400 font-medium">订单管理系统</p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
        {menuGroups.map((group, groupIndex) => (
          <div key={group.title} className={cn(groupIndex > 0 && "mt-4")}>
            {/* 分组标题 */}
            <div className="px-5 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </span>
            </div>

            {/* 分组项目 */}
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = currentView === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => onChangeView(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                      isActive
                        ? "bg-gradient-to-r from-sky-500/20 to-blue-500/10 text-sky-400 shadow-sm"
                        : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                    )}
                  >
                    <Icon size={18} className={cn(isActive && "text-sky-400")} />
                    <span className="text-sm font-medium">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 底部信息 */}
      <div className="px-5 py-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">v1.0.0</span>
          <span className="text-xs text-slate-600">© 2026</span>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
