import React, { useState, useRef, useEffect, useCallback } from 'react'

interface ResizablePanelProps {
  children: React.ReactNode[]
  direction?: 'horizontal' | 'vertical'
  initialSizes?: number[]  // 百分比，如 [40, 35, 25]
  minSizes?: number[]      // 最小百分比
  maxSizes?: number[]      // 最大百分比
  className?: string
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  direction = 'horizontal',
  initialSizes,
  minSizes,
  maxSizes,
  className = '',
}) => {
  const childCount = React.Children.count(children)
  
  // 默认等分
  const defaultSizes = Array(childCount).fill(100 / childCount)
  const [sizes, setSizes] = useState<number[]>(initialSizes || defaultSizes)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef<number | null>(null)
  const startPos = useRef(0)
  const startSizes = useRef<number[]>([])

  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()  // 防止事件冒泡
    isDragging.current = index
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY
    startSizes.current = [...sizes]
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [direction, sizes])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current === null || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const containerSize = direction === 'horizontal' ? containerRect.width : containerRect.height
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
    const delta = currentPos - startPos.current
    const deltaPercent = (delta / containerSize) * 100

    const index = isDragging.current
    const newSizes = [...startSizes.current]
    
    // 调整当前面板和下一个面板的大小
    let newSize1 = startSizes.current[index] + deltaPercent
    let newSize2 = startSizes.current[index + 1] - deltaPercent

    // 应用最小/最大限制
    const min1 = minSizes?.[index] || 10
    const max1 = maxSizes?.[index] || 90
    const min2 = minSizes?.[index + 1] || 10
    const max2 = maxSizes?.[index + 1] || 90

    if (newSize1 < min1) {
      newSize2 += newSize1 - min1
      newSize1 = min1
    } else if (newSize1 > max1) {
      newSize2 += newSize1 - max1
      newSize1 = max1
    }

    if (newSize2 < min2) {
      newSize1 += newSize2 - min2
      newSize2 = min2
    } else if (newSize2 > max2) {
      newSize1 += newSize2 - max2
      newSize2 = max2
    }

    newSizes[index] = newSize1
    newSizes[index + 1] = newSize2

    setSizes(newSizes)
  }, [direction, minSizes, maxSizes])

  const handleMouseUp = useCallback(() => {
    isDragging.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} ${className}`}
      style={{ height: '100%', width: '100%' }}
    >
      {React.Children.map(children, (child, index) => (
        <React.Fragment key={index}>
          <div
            style={{
              [isHorizontal ? 'width' : 'height']: `${sizes[index]}%`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {child}
          </div>
          {index < childCount - 1 && (
            <div
              className={`flex-shrink-0 ${
                isHorizontal
                  ? 'w-1 cursor-col-resize hover:bg-primary/30'
                  : 'h-1 cursor-row-resize hover:bg-primary/30'
              } bg-border transition-colors`}
              onMouseDown={(e) => handleMouseDown(index, e)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
