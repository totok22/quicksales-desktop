import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

export function formatDate(date: string | Date, format: string = "YYYY-MM-DD"): string {
  const d = typeof date === 'string' ? new Date(date) : date

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const shortYear = String(year).slice(-2)

  return format
    .replace('YYYY', String(year))
    .replace('YY', shortYear)
    .replace('MM', month)
    .replace('DD', day)
}

export function generateOrderNumber(
  format: string,
  seq: number,
  date: Date = new Date(),
  customPrefix?: string
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const shortYear = String(year).slice(-2)

  let result = format

  // 处理序号 {SEQ:n}
  const seqMatch = result.match(/\{SEQ:(\d+)\}/)
  if (seqMatch) {
    const digits = parseInt(seqMatch[1])
    result = result.replace(seqMatch[0], String(seq).padStart(digits, '0'))
  } else {
    // 默认6位序号
    result = result.replace('{SEQ}', String(seq).padStart(6, '0'))
  }

  result = result.replace('{YYYY}', String(year))
  result = result.replace('{YY}', shortYear)
  result = result.replace('{MM}', month)
  result = result.replace('{DD}', day)
  result = result.replace('{CUSTOM}', customPrefix || '')

  return result
}
