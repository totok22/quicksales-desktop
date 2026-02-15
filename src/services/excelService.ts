import ExcelJS from 'exceljs'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import type { Order, TemplateConfig } from '../types'

export interface ExcelExportOptions {
  template?: TemplateConfig | null
  outputDirectory?: string
}

// 默认模板配置
const DEFAULT_COLUMN_WIDTHS = {
  productName: 20,
  quantity: 10,
  unit: 10,
  price: 12,
  subtotal: 12,
  remark: 15,
}

/**
 * 导出单个订单到 Excel
 */
export async function exportOrderToExcel(
  order: Order,
  options: ExcelExportOptions = {}
): Promise<string | null> {
  const { template } = options

  // 创建工作簿
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'QuickSales'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('订单')

  // 设置列宽
  worksheet.columns = [
    { width: DEFAULT_COLUMN_WIDTHS.productName },
    { width: DEFAULT_COLUMN_WIDTHS.quantity },
    { width: DEFAULT_COLUMN_WIDTHS.unit },
    { width: DEFAULT_COLUMN_WIDTHS.price },
    { width: DEFAULT_COLUMN_WIDTHS.subtotal },
    { width: DEFAULT_COLUMN_WIDTHS.remark },
  ]

  // 标题行
  const titleRow = worksheet.addRow([`订单 - ${order.orderNumber}`])
  titleRow.height = 30
  titleRow.getCell(1).font = { size: 16, bold: true }
  worksheet.mergeCells(1, 1, 1, 6)
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

  // 客户信息行
  worksheet.addRow([])
  const customerInfoRow = worksheet.addRow([
    `客户: ${order.customer.name}`,
    '',
    `车牌: ${order.customer.licensePlate}`,
    '',
    `电话: ${order.customer.phone || '-'}`,
  ])
  customerInfoRow.getCell(1).font = { bold: true }
  customerInfoRow.getCell(3).font = { bold: true }
  customerInfoRow.getCell(5).font = { bold: true }

  const dateRow = worksheet.addRow([
    `日期: ${order.date}`,
    '',
    `订单号: ${order.orderNumber}`,
  ])
  dateRow.getCell(1).font = { bold: true }
  dateRow.getCell(3).font = { bold: true }

  // 空行
  worksheet.addRow([])

  // 表头
  const headerRow = worksheet.addRow(['商品名称', '数量', '单位', '单价', '小计', '备注'])
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
    cell.alignment = { horizontal: 'center' }
  })

  // 商品明细
  order.items.forEach((item) => {
    const price = item.discountPrice ?? item.price
    const subtotal = price * item.quantity

    const row = worksheet.addRow([
      item.name,
      item.quantity,
      item.unit,
      price.toFixed(2),
      subtotal.toFixed(2),
      item.remark || '',
    ])

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      }

      // 数字列右对齐
      if (colNumber >= 2 && colNumber <= 5) {
        cell.alignment = { horizontal: 'right' }
      }

      // 价格列格式化
      if (colNumber === 4 || colNumber === 5) {
        cell.numFmt = '¥#,##0.00'
      }
    })
  })

  // 空行
  worksheet.addRow([])

  // 合计行
  const totalRow = worksheet.addRow([
    '合计',
    '',
    '',
    '',
    order.totalAmount.toFixed(2),
    '',
  ])
  totalRow.font = { bold: true }
  totalRow.getCell(5).numFmt = '¥#,##0.00'
  totalRow.getCell(5).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF0CC' },
  }

  // 备注
  if (order.remark) {
    worksheet.addRow([])
    const remarkRow = worksheet.addRow([`备注: ${order.remark}`])
    remarkRow.getCell(1).font = { italic: true }
    worksheet.mergeCells(remarkRow.number, 1, remarkRow.number, 6)
  }

  // 生成文件名
  const defaultFileName = generateFileName(order, template)

  // 选择保存路径
  const defaultPath = options.outputDirectory
    ? `${options.outputDirectory}/${defaultFileName}`
    : defaultFileName

  const filePath = await save({
    defaultPath,
    filters: [{ name: 'Excel文件', extensions: ['xlsx'] }],
  })

  if (!filePath) {
    return null
  }

  // 写入文件
  const buffer = await workbook.xlsx.writeBuffer()
  await writeFile(filePath, new Uint8Array(buffer as ArrayBuffer))

  return filePath
}

/**
 * 批量导出订单到单个 Excel 文件
 */
export async function exportOrdersToExcel(
  orders: Order[],
  _options: ExcelExportOptions = {}
): Promise<string | null> {
  if (orders.length === 0) {
    throw new Error('没有可导出的订单')
  }

  // 创建工作簿
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'QuickSales'
  workbook.created = new Date()

  // 为每个订单创建一个工作表
  for (const order of orders) {
    const sheetName = `${order.orderNumber}`.slice(0, 31) // Excel 表名限制31字符
    const worksheet = workbook.addWorksheet(sheetName)

    // 设置列宽
    worksheet.columns = [
      { width: DEFAULT_COLUMN_WIDTHS.productName },
      { width: DEFAULT_COLUMN_WIDTHS.quantity },
      { width: DEFAULT_COLUMN_WIDTHS.unit },
      { width: DEFAULT_COLUMN_WIDTHS.price },
      { width: DEFAULT_COLUMN_WIDTHS.subtotal },
      { width: DEFAULT_COLUMN_WIDTHS.remark },
    ]

    // 标题行
    const titleRow = worksheet.addRow([`订单 - ${order.orderNumber}`])
    titleRow.height = 30
    titleRow.getCell(1).font = { size: 16, bold: true }
    worksheet.mergeCells(1, 1, 1, 6)
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

    // 客户信息行
    worksheet.addRow([])
    const customerInfoRow = worksheet.addRow([
      `客户: ${order.customer.name}`,
      '',
      `车牌: ${order.customer.licensePlate}`,
      '',
      `电话: ${order.customer.phone || '-'}`,
    ])
    customerInfoRow.getCell(1).font = { bold: true }
    customerInfoRow.getCell(3).font = { bold: true }
    customerInfoRow.getCell(5).font = { bold: true }

    const dateRow = worksheet.addRow([
      `日期: ${order.date}`,
      '',
      `订单号: ${order.orderNumber}`,
    ])
    dateRow.getCell(1).font = { bold: true }
    dateRow.getCell(3).font = { bold: true }

    // 空行
    worksheet.addRow([])

    // 表头
    const headerRow = worksheet.addRow(['商品名称', '数量', '单位', '单价', '小计', '备注'])
    headerRow.font = { bold: true }
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.alignment = { horizontal: 'center' }
    })

    // 商品明细
    order.items.forEach((item) => {
      const price = item.discountPrice ?? item.price
      const subtotal = price * item.quantity

      const row = worksheet.addRow([
        item.name,
        item.quantity,
        item.unit,
        price.toFixed(2),
        subtotal.toFixed(2),
        item.remark || '',
      ])

      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        }

        // 数字列右对齐
        if (colNumber >= 2 && colNumber <= 5) {
          cell.alignment = { horizontal: 'right' }
        }

        // 价格列格式化
        if (colNumber === 4 || colNumber === 5) {
          cell.numFmt = '¥#,##0.00'
        }
      })
    })

    // 空行
    worksheet.addRow([])

    // 合计行
    const totalRow = worksheet.addRow([
      '合计',
      '',
      '',
      '',
      order.totalAmount.toFixed(2),
      '',
    ])
    totalRow.font = { bold: true }
    totalRow.getCell(5).numFmt = '¥#,##0.00'
    totalRow.getCell(5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF0CC' },
    }

    // 备注
    if (order.remark) {
      worksheet.addRow([])
      const remarkRow = worksheet.addRow([`备注: ${order.remark}`])
      remarkRow.getCell(1).font = { italic: true }
      worksheet.mergeCells(remarkRow.number, 1, remarkRow.number, 6)
    }
  }

  // 添加汇总表
  const summarySheet = workbook.addWorksheet('汇总')
  summarySheet.columns = [
    { width: 15 },
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
  ]

  const summaryTitle = summarySheet.addRow(['订单汇总'])
  summaryTitle.height = 30
  summaryTitle.getCell(1).font = { size: 16, bold: true }
  summarySheet.mergeCells(1, 1, 1, 5)
  summaryTitle.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

  summarySheet.addRow([])

  const summaryHeader = summarySheet.addRow(['订单号', '客户', '日期', '金额', '状态'])
  summaryHeader.font = { bold: true }
  summaryHeader.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  let totalAmount = 0
  for (const order of orders) {
    totalAmount += order.totalAmount
    const row = summarySheet.addRow([
      order.orderNumber,
      order.customer.name,
      order.date,
      order.totalAmount.toFixed(2),
      order.status === 'completed' ? '已完成' : order.status,
    ])
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      }
      if (colNumber === 4) {
        cell.numFmt = '¥#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }
    })
  }

  summarySheet.addRow([])
  const totalRow = summarySheet.addRow(['', '', '总计:', totalAmount.toFixed(2), ''])
  totalRow.font = { bold: true }
  totalRow.getCell(4).numFmt = '¥#,##0.00'
  totalRow.getCell(4).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF0CC' },
  }

  // 生成文件名
  const today = new Date().toISOString().slice(0, 10)
  const defaultFileName = `订单导出_${today}_${orders.length}条.xlsx`

  // 选择保存路径
  const defaultPath = _options.outputDirectory
    ? `${_options.outputDirectory}/${defaultFileName}`
    : defaultFileName

  const filePath = await save({
    defaultPath,
    filters: [{ name: 'Excel文件', extensions: ['xlsx'] }],
  })

  if (!filePath) {
    return null
  }

  // 写入文件
  const buffer = await workbook.xlsx.writeBuffer()
  await writeFile(filePath, new Uint8Array(buffer as ArrayBuffer))

  return filePath
}

/**
 * 生成文件名
 */
function generateFileName(order: Order, template?: TemplateConfig | null, filenameFormat?: string): string {
  // 优先使用全局设置的文件命名格式，其次使用模板的命名格式
  const pattern = filenameFormat || template?.filenamePattern || '{date}_{customerName}_{orderNumber}'
  
  console.log('generateFileName - pattern:', pattern)
  console.log('generateFileName - order.date:', order.date)
  console.log('generateFileName - order.customer.name:', order.customer.name)
  console.log('generateFileName - order.orderNumber:', order.orderNumber)

  // 替换所有可能的占位符
  let fileName = pattern
    .replace(/{date}/g, order.date.replace(/-/g, ''))
    .replace(/{customerName}/g, order.customer.name)
    .replace(/{customer}/g, order.customer.name)
    .replace(/{orderNumber}/g, order.orderNumber)
    .replace(/{orderNo}/g, order.orderNumber)
    .replace(/{licensePlate}/g, order.customer.licensePlate || '')

  console.log('generateFileName - 替换后:', fileName)

  // 清理非法字符（包括空格）
  fileName = fileName.replace(/[\\/:*?"<>|\s]/g, '_')

  console.log('generateFileName - 清理后:', fileName)

  // 移除连续的下划线
  fileName = fileName.replace(/_{2,}/g, '_')

  // 确保文件名以.xlsx结尾，避免重复后缀
  if (!fileName.endsWith('.xlsx')) {
    fileName = fileName + '.xlsx'
  }

  console.log('generateFileName - 最终文件名:', fileName)
  return fileName
}

/**
 * 根据模板导出订单（简化版本，后续可以扩展）
 */
export async function exportOrderWithTemplate(
  order: Order,
  template: TemplateConfig,
  options: ExcelExportOptions & { filenameFormat?: string; skipDialog?: boolean } = {}
): Promise<string | null> {
  console.log('exportOrderWithTemplate 开始，模板名称:', template.name)
  console.log('模板是否有 base64 数据:', !!template.templateBase64)
  console.log('模板 base64 数据长度:', template.templateBase64?.length || 0)

  // 必须有 base64 数据
  if (!template.templateBase64) {
    throw new Error('模板没有上传Excel文件，请先在设置中上传模板文件')
  }

  try {
    console.log('开始加载模板...')
    const workbook = new ExcelJS.Workbook()
    const templateBuffer = base64ToArrayBuffer(template.templateBase64)
    console.log('模板 buffer 大小:', templateBuffer.byteLength)

    await workbook.xlsx.load(templateBuffer)
    console.log('模板加载成功，工作表数量:', workbook.worksheets.length)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new Error('模板无效，没有工作表')
    }

    console.log('使用工作表:', worksheet.name)

    // 根据映射填充数据
    const mappings = template.mappings
    console.log('模板映射配置:', mappings)

    // 填充客户信息
    if (mappings.customerName) {
      setCellValue(worksheet, mappings.customerName, order.customer.name)
      console.log('设置客户姓名:', mappings.customerName, '=', order.customer.name)
    }
    if (mappings.customerPhone) {
      setCellValue(worksheet, mappings.customerPhone, order.customer.phone)
      console.log('设置客户电话:', mappings.customerPhone, '=', order.customer.phone)
    }
    if (mappings.customerPlate) {
      setCellValue(worksheet, mappings.customerPlate, order.customer.licensePlate)
      console.log('设置客户车牌:', mappings.customerPlate, '=', order.customer.licensePlate)
    }

    // 填充订单信息
    if (mappings.date) {
      setCellValue(worksheet, mappings.date, order.date)
      console.log('设置日期:', mappings.date, '=', order.date)
    }
    if (mappings.orderNumber) {
      setCellValue(worksheet, mappings.orderNumber, order.orderNumber)
      console.log('设置订单号:', mappings.orderNumber, '=', order.orderNumber)
    }
    if (mappings.orderRemark) {
      setCellValue(worksheet, mappings.orderRemark, order.remark || '')
      console.log('设置订单备注:', mappings.orderRemark, '=', order.remark)
    }
    if (mappings.totalAmount) {
      setCellValue(worksheet, mappings.totalAmount, order.totalAmount)
      console.log('设置总金额:', mappings.totalAmount, '=', order.totalAmount)
    }

    // 填充商品列表
    if (mappings.itemStartRow && mappings.columns.name) {
      const startRow = mappings.itemStartRow
      const endRow = mappings.itemEndRow || 0
      const cols = mappings.columns

      console.log('开始填充商品列表，起始行:', startRow, '结束行:', endRow, '商品数量:', order.items.length)

      // 检查商品数量是否超过模板行数
      if (endRow > 0 && order.items.length > (endRow - startRow + 1)) {
        const maxItems = endRow - startRow + 1
        throw new Error(`当前订单有 ${order.items.length} 个商品，但模板只支持 ${maxItems} 个商品（起始行${startRow}到结束行${endRow}）。请修改模板配置或减少商品数量后重试。`)
      }

      order.items.forEach((item, index) => {
        const rowNumber = startRow + index

        if (cols.name) {
          setCellValueByCol(worksheet, rowNumber, cols.name, item.name)
        }
        if (cols.quantity) {
          setCellValueByCol(worksheet, rowNumber, cols.quantity, item.quantity)
        }
        if (cols.unit) {
          setCellValueByCol(worksheet, rowNumber, cols.unit, item.unit)
        }
        if (cols.price) {
          setCellValueByCol(worksheet, rowNumber, cols.price, item.discountPrice ?? item.price)
        }
        if (cols.total) {
          const price = item.discountPrice ?? item.price
          setCellValueByCol(worksheet, rowNumber, cols.total, price * item.quantity)
        }
        if (cols.remark) {
          setCellValueByCol(worksheet, rowNumber, cols.remark, item.remark || '')
        }
      })

      console.log('商品列表填充完成')
    }

    // 生成文件名并保存
    const defaultFileName = generateFileName(order, template, options.filenameFormat)
    console.log('defaultFileName:', defaultFileName)
    console.log('options.outputDirectory:', options.outputDirectory)
    console.log('options.skipDialog:', options.skipDialog)

    let filePath: string | null = null

    // 如果跳过对话框，直接保存到默认位置
    if (options.skipDialog && options.outputDirectory) {
      filePath = `${options.outputDirectory}/${defaultFileName}`
      console.log('跳过对话框，直接保存到:', filePath)
    } else {
      // 显示保存对话框
      const defaultPath = options.outputDirectory
        ? `${options.outputDirectory}/${defaultFileName}`
        : defaultFileName

      console.log('defaultPath:', defaultPath)

      filePath = await save({
        defaultPath,
        filters: [{ name: 'Excel文件', extensions: ['xlsx'] }],
      })

      if (!filePath) {
        console.log('用户取消了保存')
        return null
      }
    }

    console.log('最终保存路径:', filePath)
    const buffer = await workbook.xlsx.writeBuffer()
    console.log('写入 buffer 大小:', buffer.byteLength)
    await writeFile(filePath, new Uint8Array(buffer as ArrayBuffer))
    console.log('文件保存成功')

    return filePath
  } catch (error) {
    console.error('使用模板导出失败:', error)
    throw error
  }
}

// 辅助函数：Base64 转 ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

// 辅助函数：设置单元格值（通过单元格地址，如 "A1"）
function setCellValue(worksheet: ExcelJS.Worksheet, cellAddress: string, value: string | number) {
  const cell = worksheet.getCell(cellAddress)
  cell.value = value
}

// 辅助函数：设置单元格值（通过行号和列字母）
function setCellValueByCol(worksheet: ExcelJS.Worksheet, row: number, col: string, value: string | number) {
  const cell = worksheet.getCell(`${col}${row}`)
  cell.value = value
}
