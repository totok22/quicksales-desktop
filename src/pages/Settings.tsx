import React, { useState, useEffect, useMemo } from 'react'
import { Save, FolderOpen, Plus, Upload, Download, CheckSquare, Square } from 'lucide-react'
import { Card, Button, Input, Label } from '../components/ui'
import { useStore } from '../stores/useStore'
import type { TemplateConfig } from '../types'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

// 默认模板验证配置
const defaultTemplateValidation = {
  requireCustomerName: false,
  requireCustomerPhone: false,
  requireCustomerPlate: false,
  requireDate: true,
  requireOrderNumber: true,
  requireOrderRemark: false,
  requireTotalAmount: false,
  requireItemName: true,
  requireItemUnit: false,
  requireItemQuantity: true,
  requireItemPrice: true,
  requireItemTotal: false,
  requireItemRemark: false,
}

export const Settings: React.FC = () => {
  const { settings, setSettings, templates, loadTemplates, updateSettings } = useStore()

  // 确保 templateValidation 存在，合并默认值
  const templateValidation = useMemo(() => ({
    ...defaultTemplateValidation,
    ...(settings.templateValidation || {}),
  }), [settings.templateValidation])
  const [editingTemplate, setEditingTemplate] = useState<TemplateConfig | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await invoke('get_settings') as any
      if (data) {
        setSettings(data)
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }

  const handleSaveSettings = async () => {
    try {
      // updateSettings 已经会自动保存到数据库
      await updateSettings(settings)
      alert('设置保存成功！')
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败: ' + error)
    }
  }

  const selectDirectory = async (type: 'data' | 'output') => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: type === 'data' ? '选择数据存储目录' : '选择Excel输出目录'
      })

      // 用户取消了选择
      if (!selected) {
        return
      }

      // 处理选择的路径
      const path = typeof selected === 'string' ? selected : selected[0]
      if (path) {
        if (type === 'data') {
          setSettings({ ...settings, dataDirectory: path })
        } else {
          setSettings({ ...settings, outputDirectory: path })
        }
      }
    } catch (error) {
      console.error('选择目录失败:', error)
      // 只显示非用户取消的错误
      if (error && typeof error === 'object' && 'message' in error) {
        const err = error as { message: string }
        if (!err.message.includes('User cancelled') && !err.message.includes('用户取消')) {
          alert('选择目录失败: ' + err.message)
        }
      }
    }
  }

  const handleNewTemplate = () => {
    const template: TemplateConfig = {
      id: Date.now().toString(),
      name: '新模板',
      templateBase64: '',
      fileName: '',
      filenamePattern: '订单_{orderNo}_{customer}',
      isDefault: false,
      mappings: {
        customerName: '',
        customerPhone: '',
        customerPlate: '',
        date: '',
        orderNumber: '',
        orderRemark: '',
        totalAmount: '',
        itemStartRow: 8,
        itemEndRow: 0, // 0 表示不限制
        columns: {
          name: 'A',
          unit: 'B',
          quantity: 'C',
          price: 'D',
          total: 'E',
          remark: 'F',
        },
      },
      requiredFields: [] as any, // 保持向后兼容
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setEditingTemplate(template)
  }

  const handleEditTemplate = (template: TemplateConfig) => {
    setEditingTemplate({ ...template })
  }

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return

    // 验证模板名称
    if (!editingTemplate.name.trim()) {
      alert('❌ 请输入模板名称！')
      return
    }

    // 验证Excel文件
    if (!editingTemplate.templateBase64) {
      alert('❌ 请上传Excel模板文件！')
      return
    }

    // 改进的验证逻辑：只验证关键字段
    const mappings = editingTemplate.mappings
    const errors: string[] = []

    // 验证核心字段（这些是必需的）
    const requiredFields_map: Record<string, { key: keyof typeof mappings, name: string, required: boolean }> = {
      customerName: { key: 'customerName', name: '客户姓名', required: false },
      date: { key: 'date', name: '日期', required: true },
      orderNumber: { key: 'orderNumber', name: '订单号', required: true },
    }

    for (const field of Object.values(requiredFields_map)) {
      if (field.required && !mappings[field.key]) {
        errors.push(`• ${field.name} 字段映射不能为空（如 C3）`)
      }
    }

    // 验证商品列表配置
    if (mappings.itemStartRow < 2) {
      errors.push('• 商品列表起始行必须大于1')
    }

    const requiredColumns: Record<string, { key: string, name: string, required: boolean }> = {
      name: { key: 'name', name: '商品名称', required: true },
      quantity: { key: 'quantity', name: '数量', required: true },
      price: { key: 'price', name: '单价', required: true },
      unit: { key: 'unit', name: '单位', required: false },
      total: { key: 'total', name: '总价', required: false },
      remark: { key: 'remark', name: '备注', required: false },
    }

    for (const col of Object.values(requiredColumns)) {
      const colKey = col.key as keyof typeof mappings.columns
      if (col.required && !mappings.columns[colKey]) {
        errors.push(`• ${col.name} 列不能为空（如 A, B, C）`)
      }
    }

    // 如果有错误，显示所有错误
    if (errors.length > 0) {
      alert('❌ 模板配置有误：\n\n' + errors.join('\n') + '\n\n请检查并修正后重试。')
      return
    }

    // 如果设置为默认模板，取消其他模板的默认状态
    if (editingTemplate.isDefault) {
      for (const template of templates) {
        if (template.id !== editingTemplate.id) {
          template.isDefault = false
          await invoke('save_template', { template }).catch(e => console.error('取消默认模板失败:', e))
        }
      }
      // 同步更新默认模板ID到设置中（自动保存到数据库）
      await updateSettings({ defaultTemplateId: editingTemplate.id })
    } else {
      // 如果取消默认模板，检查是否有其他默认模板
      const otherDefaultTemplate = templates.find(t => t.id !== editingTemplate.id && t.isDefault)
      if (otherDefaultTemplate) {
        await updateSettings({ defaultTemplateId: otherDefaultTemplate.id })
      } else {
        await updateSettings({ defaultTemplateId: '' })
      }
    }

    // 自动重命名
    if (!editingTemplate.fileName || editingTemplate.fileName === '新模板.xlsx') {
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const safeName = editingTemplate.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')
      editingTemplate.fileName = `${safeName}_${timestamp}.xlsx`
    }

    try {
      await invoke('save_template', { template: editingTemplate })
      await loadTemplates()
      setEditingTemplate(null)
      alert('✅ 模板保存成功！')
    } catch (error) {
      console.error('保存失败:', error)
      alert('❌ 保存失败: ' + error)
    }
  }

  const handleDeleteTemplate = async (id: string, templateName: string) => {
    const confirmed = window.confirm(`确定要删除模板"${templateName}"吗？此操作不可撤销。`)
    if (!confirmed) return

    try {
      await invoke('delete_template', { id })
      await loadTemplates()
      alert('模板删除成功！')
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败: ' + error)
    }
  }

  const handleUploadTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      if (editingTemplate) {
        setEditingTemplate({
          ...editingTemplate,
          templateBase64: base64,
          fileName: file.name,
        })
      }
    }
    reader.readAsDataURL(file)
  }

  const handleExportSettings = async () => {
    try {
      const settingsToExport = {
        settings,
        templates,
        exportDate: new Date().toISOString(),
        version: '1.0'
      }
      const jsonContent = JSON.stringify(settingsToExport, null, 2)

      const filePath = await save({
        defaultPath: `QuickSales设置备份_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON文件', extensions: ['json'] }]
      })

      if (filePath) {
        await writeTextFile(filePath, jsonContent)
        alert('设置导出成功！')
      }
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败: ' + error)
    }
  }

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => reject(new Error('文件读取失败'))
        reader.readAsText(file, 'UTF-8')
      })

      const data = JSON.parse(text)
      if (!data.settings || !Array.isArray(data.templates)) {
        alert('无效的设置文件格式！')
        return
      }

      const confirmed = window.confirm(`导入将覆盖当前设置和模板。确定要继续吗？\n\n包含内容：\n- 系统设置\n- ${data.templates.length} 个模板`)
      if (!confirmed) return

      if (data.settings) {
        await invoke('save_settings', { settings: data.settings })
        setSettings(data.settings)
      }

      for (const template of data.templates) {
        await invoke('save_template', { template }).catch(e => console.error('导入模板失败:', template.name, e))
      }

      await loadTemplates()
      alert('设置导入成功！')
    } catch (error) {
      console.error('导入失败:', error)
      alert('导入失败: ' + error)
    }
    event.target.value = ''
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">系统设置</h1>

      <div className="space-y-6">
        {/* 设置备份与恢复 */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-foreground">设置备份与恢复</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            导出所有设置和模板为JSON文件，或从备份文件恢复设置。
          </p>
          <div className="flex gap-3">
            <input
              type="file"
              id="import-settings-input"
              accept=".json"
              onChange={handleImportSettings}
              className="hidden"
            />
            <Button variant="secondary" onClick={() => document.getElementById('import-settings-input')?.click()}>
              <Upload size={18} className="mr-2" />
              导入设置
            </Button>
            <Button variant="secondary" onClick={handleExportSettings}>
              <Download size={18} className="mr-2" />
              导出设置
            </Button>
          </div>
        </Card>

        {/* 存储目录设置 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">存储目录</h2>
          <div className="space-y-4">
            <div>
              <Label>数据存储目录</Label>
              <div className="flex gap-2">
                <Input
                  value={settings.dataDirectory}
                  onChange={e => setSettings({ ...settings, dataDirectory: e.target.value })}
                  placeholder="默认: %APPDATA%"
                  className="flex-1"
                />
                <Button variant="secondary" onClick={() => selectDirectory('data')}>
                  <FolderOpen size={18} className="mr-2" />
                  浏览
                </Button>
              </div>
            </div>
            <div>
              <Label>Excel输出目录</Label>
              <div className="flex gap-2">
                <Input
                  value={settings.outputDirectory}
                  onChange={e => setSettings({ ...settings, outputDirectory: e.target.value })}
                  placeholder="默认: 文档夹"
                  className="flex-1"
                />
                <Button variant="secondary" onClick={() => selectDirectory('output')}>
                  <FolderOpen size={18} className="mr-2" />
                  浏览
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 界面设置 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">界面设置</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>字体大小</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                value={settings.fontSize}
                onChange={e => setSettings({ ...settings, fontSize: Number(e.target.value) })}
              >
                <option value={14}>小号 (14px)</option>
                <option value={16}>中等 (16px)</option>
                <option value={18}>大号 (18px)</option>
                <option value={20}>特大号 (20px)</option>
              </select>
            </div>
            <div>
              <Label>主题</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                value={settings.theme}
                onChange={e => setSettings({ ...settings, theme: e.target.value as any })}
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="auto">自动</option>
              </select>
            </div>
          </div>
        </Card>

        {/* 日期和订单号格式 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">日期和订单号格式</h2>
          <div className="space-y-4">
            <div>
              <Label>系统显示日期格式</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                value={settings.dateFormat}
                onChange={e => setSettings({ ...settings, dateFormat: e.target.value })}
              >
                <option value="YYYY-MM-DD">2026-01-09</option>
                <option value="YYYY.MM.DD">2026.01.09</option>
                <option value="YYYY/MM/DD">2026/01/09</option>
                <option value="DD-MM-YYYY">09-01-2026</option>
                <option value="MM/DD/YYYY">01/09/2026</option>
              </select>
            </div>
            <div>
              <Label>订单号格式</Label>
              <Input
                value={settings.orderNumberFormat}
                onChange={e => setSettings({ ...settings, orderNumberFormat: e.target.value })}
                placeholder="NO.{SEQ:6}"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                变量: {`{SEQ}`} - 序号, {`{SEQ:n}`} - n位序号, {`{YYYY}`} - 年, {`{MM}`} - 月, {`{DD}`} - 日
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>每天重新从1开始</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                  value={settings.orderNumberResetDaily ? 'true' : 'false'}
                  onChange={e => setSettings({ ...settings, orderNumberResetDaily: e.target.value === 'true' })}
                >
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </div>
              <div>
                <Label>序号位数</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.orderNumberDigits}
                  onChange={e => setSettings({ ...settings, orderNumberDigits: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Excel文件命名格式 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Excel导出设置</h2>
          <div className="space-y-4">
            <div>
              <Label>文件命名模式</Label>
              <Input
                value={settings.excelFilenameFormat || '{date}_{customerName}_{orderNumber}'}
                onChange={e => setSettings({ ...settings, excelFilenameFormat: e.target.value })}
                placeholder="{date}_{customerName}_{orderNumber}"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                变量: {`{date}`} - 日期, {`{customerName}`} - 客户姓名, {`{customer}`} - 客户姓名(简写), {`{orderNumber}`} - 订单号, {`{orderNo}`} - 订单号(简写), {`{licensePlate}`} - 车牌号
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                示例: {`{date}_{customerName}_{orderNumber}`} → 2026-01-09_张三_NO000001.xlsx
              </p>
            </div>

            {/* 新增：导出行为设置 */}
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="font-medium text-foreground">导出行为</h3>

              <label className="flex items-center space-x-2 text-sm cursor-pointer p-3 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.skipSaveDialog || false}
                  onChange={e => setSettings({ ...settings, skipSaveDialog: e.target.checked })}
                  className="rounded border-input text-primary accent-primary focus:ring-ring"
                />
                <div className="flex-1">
                  <span className="text-foreground font-medium">跳过保存对话框</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    启用后，点击"保存并导出"将直接保存到上方设置的Excel输出目录，不再弹出保存对话框
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-2 text-sm cursor-pointer p-3 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.autoOpenExcel || false}
                  onChange={e => setSettings({ ...settings, autoOpenExcel: e.target.checked })}
                  className="rounded border-input text-primary accent-primary focus:ring-ring"
                />
                <div className="flex-1">
                  <span className="text-foreground font-medium">导出后自动打开Excel</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    启用后，Excel文件导出成功后将自动打开，无需手动确认
                  </p>
                </div>
              </label>
            </div>
          </div>
        </Card>

        {/* Excel模板配置 */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-foreground">Excel模板配置</h2>
            <Button onClick={handleNewTemplate}>
              <Plus size={18} className="mr-2" />
              新建模板
            </Button>
          </div>

          <div className="space-y-3">
            {templates.map((template: any) => (
              <div key={template.id} className="border border-border rounded-lg p-4 bg-muted/30">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{template.name}</h3>
                      {template.isDefault && (
                        <span className="inline-block px-2 py-1 bg-primary/20 text-primary text-xs rounded">
                          默认模板
                        </span>
                      )}
                      {template.templateBase64 && (
                        <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded">
                          已上传
                        </span>
                      )}
                    </div>
                    {template.fileName && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        📄 {template.fileName}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      命名模式: {template.filenamePattern}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleEditTemplate(template)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteTemplate(template.id, template.name)}>
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>暂无模板配置</p>
                <p className="text-sm">点击"新建模板"开始配置</p>
              </div>
            )}
          </div>
        </Card>


        {/* 客户信息必填字段设置 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">客户信息必填字段设置</h2>
          <p className="text-sm text-muted-foreground mb-4">
            设置订单录入时客户信息的必填字段。系统会检查至少填写一个客户字段（姓名、电话或车牌号），然后再检查这里设置的必填项。
          </p>

          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-sm cursor-pointer p-3 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
              <input
                type="checkbox"
                checked={templateValidation.requireCustomerName}
                onChange={e => setSettings({
                  ...settings,
                  templateValidation: { ...templateValidation, requireCustomerName: e.target.checked }
                })}
                className="rounded border-input text-primary accent-primary focus:ring-ring"
              />
              <span className="text-foreground font-medium">客户姓名</span>
            </label>
            <label className="flex items-center space-x-2 text-sm cursor-pointer p-3 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
              <input
                type="checkbox"
                checked={templateValidation.requireCustomerPhone}
                onChange={e => setSettings({
                  ...settings,
                  templateValidation: { ...templateValidation, requireCustomerPhone: e.target.checked }
                })}
                className="rounded border-input text-primary accent-primary focus:ring-ring"
              />
              <span className="text-foreground font-medium">客户电话</span>
            </label>
            <label className="flex items-center space-x-2 text-sm cursor-pointer p-3 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
              <input
                type="checkbox"
                checked={templateValidation.requireCustomerPlate}
                onChange={e => setSettings({
                  ...settings,
                  templateValidation: { ...templateValidation, requireCustomerPlate: e.target.checked }
                })}
                className="rounded border-input text-primary accent-primary focus:ring-ring"
              />
              <span className="text-foreground font-medium">车牌号</span>
            </label>
          </div>

          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-xs text-primary">
              💡 提示：勾选的字段将成为订单录入时的必填项。如果不勾选任何字段，只要填写客户姓名、电话或车牌号中的任意一个即可保存订单。
              <br /><br />
              ⚠️ 注意：此设置与"Excel模板配置"中的必填字段设置是分开的。模板必填字段用于Excel导出验证，客户信息必填字段用于订单录入验证。
            </p>
          </div>
        </Card>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} className="px-8">
            <Save size={18} className="mr-2" />
            保存设置
          </Button>
        </div>
      </div>

      {/* 模板编辑对话框 */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto p-6">
            <h3 className="text-xl font-bold mb-4 text-foreground">
              {templates.find((t: any) => t.id === editingTemplate.id) ? '编辑模板' : '新建模板'}
            </h3>

            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>模板名称</Label>
                  <Input
                    value={editingTemplate.name}
                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>文件命名模式</Label>
                  <Input
                    value={editingTemplate.filenamePattern}
                    onChange={e => setEditingTemplate({ ...editingTemplate, filenamePattern: e.target.value })}
                    placeholder="订单_{orderNo}_{customer}"
                  />
                </div>
              </div>

              {/* 上传Excel模板 */}
              <div>
                <Label>Excel模板文件</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="template-file-upload"
                      accept=".xlsx,.xls"
                      onChange={handleUploadTemplate}
                      className="hidden"
                    />
                    <Button
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => document.getElementById('template-file-upload')?.click()}
                    >
                      <Upload size={18} className="mr-2" />
                      {editingTemplate.fileName ? '更换文件' : '选择文件'}
                    </Button>
                  </div>
                  {editingTemplate.fileName && (
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                      <span className="text-sm text-foreground font-medium">
                        📄 {editingTemplate.fileName}
                      </span>
                      {editingTemplate.templateBase64 && (
                        <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                          已上传
                        </span>
                      )}
                    </div>
                  )}
                  {!editingTemplate.fileName && (
                    <p className="text-xs text-muted-foreground">
                      请选择Excel模板文件（.xlsx 或 .xls）
                    </p>
                  )}
                </div>
              </div>

              {/* 默认模板选择 */}
              <div>
                <Label>设为默认模板</Label>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setEditingTemplate({ ...editingTemplate, isDefault: !editingTemplate.isDefault })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-all ${editingTemplate.isDefault
                      ? 'bg-primary/10 border-primary text-primary font-bold'
                      : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {editingTemplate.isDefault ? <CheckSquare size={18} /> : <Square size={18} />}
                    <span>设置为新订单默认选中的模板</span>
                  </button>
                </div>
              </div>

              {/* 表头信息映射 */}
              <div>
                <h4 className="font-semibold text-foreground mb-3">表头信息映射</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>客户姓名</Label>
                    <Input
                      value={editingTemplate.mappings.customerName}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, customerName: e.target.value }
                      })}
                      placeholder="C3"
                    />
                  </div>
                  <div>
                    <Label>客户电话</Label>
                    <Input
                      value={editingTemplate.mappings.customerPhone}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, customerPhone: e.target.value }
                      })}
                      placeholder="C4"
                    />
                  </div>
                  <div>
                    <Label>客户车牌</Label>
                    <Input
                      value={editingTemplate.mappings.customerPlate}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, customerPlate: e.target.value }
                      })}
                      placeholder="C5"
                    />
                  </div>
                  <div>
                    <Label>日期</Label>
                    <Input
                      value={editingTemplate.mappings.date}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, date: e.target.value }
                      })}
                      placeholder="F3"
                    />
                  </div>
                  <div>
                    <Label>订单号</Label>
                    <Input
                      value={editingTemplate.mappings.orderNumber}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, orderNumber: e.target.value }
                      })}
                      placeholder="F4"
                    />
                  </div>
                  <div>
                    <Label>订单备注</Label>
                    <Input
                      value={editingTemplate.mappings.orderRemark}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, orderRemark: e.target.value }
                      })}
                      placeholder="F5"
                    />
                  </div>
                  <div>
                    <Label>总金额</Label>
                    <Input
                      value={editingTemplate.mappings.totalAmount}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, totalAmount: e.target.value }
                      })}
                      placeholder="F6"
                    />
                  </div>
                </div>
              </div>

              {/* 商品列表映射 */}
              <div>
                <h4 className="font-semibold text-foreground mb-3">商品列表映射</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>起始行号</Label>
                    <Input
                      type="number"
                      min={2}
                      value={editingTemplate.mappings.itemStartRow}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, itemStartRow: Number(e.target.value) }
                      })}
                    />
                  </div>
                  <div>
                    <Label>结束行号</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingTemplate.mappings.itemEndRow || 0}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: { ...editingTemplate.mappings, itemEndRow: Number(e.target.value) }
                      })}
                      placeholder="0 表示不限制"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-3 mt-3">
                  <div>
                    <Label>名称列</Label>
                    <Input
                      value={editingTemplate.mappings.columns.name}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: {
                          ...editingTemplate.mappings,
                          columns: { ...editingTemplate.mappings.columns, name: e.target.value }
                        }
                      })}
                      placeholder="A"
                    />
                  </div>
                  <div>
                    <Label>单位列</Label>
                    <Input
                      value={editingTemplate.mappings.columns.unit}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: {
                          ...editingTemplate.mappings,
                          columns: { ...editingTemplate.mappings.columns, unit: e.target.value }
                        }
                      })}
                      placeholder="B"
                    />
                  </div>
                  <div>
                    <Label>数量列</Label>
                    <Input
                      value={editingTemplate.mappings.columns.quantity}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: {
                          ...editingTemplate.mappings,
                          columns: { ...editingTemplate.mappings.columns, quantity: e.target.value }
                        }
                      })}
                      placeholder="C"
                    />
                  </div>
                  <div>
                    <Label>单价列</Label>
                    <Input
                      value={editingTemplate.mappings.columns.price}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: {
                          ...editingTemplate.mappings,
                          columns: { ...editingTemplate.mappings.columns, price: e.target.value }
                        }
                      })}
                      placeholder="D"
                    />
                  </div>
                  <div>
                    <Label>总价列</Label>
                    <Input
                      value={editingTemplate.mappings.columns.total}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: {
                          ...editingTemplate.mappings,
                          columns: { ...editingTemplate.mappings.columns, total: e.target.value }
                        }
                      })}
                      placeholder="E"
                    />
                  </div>
                  <div>
                    <Label>备注列</Label>
                    <Input
                      value={editingTemplate.mappings.columns.remark}
                      onChange={e => setEditingTemplate({
                        ...editingTemplate,
                        mappings: {
                          ...editingTemplate.mappings,
                          columns: { ...editingTemplate.mappings.columns, remark: e.target.value }
                        }
                      })}
                      placeholder="F"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => setEditingTemplate(null)} className="flex-1">
                  取消
                </Button>
                <Button onClick={handleSaveTemplate} className="flex-1">
                  确定
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
