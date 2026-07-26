'use client'

import { useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { useCountUp } from '@/hooks/useCountUp'

type TableRow = {
  id: string
  number: number
  status: 'livre' | 'ocupada'
  pos_x: number | null
  pos_y: number | null
}

const fmt = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')
const DRAG_THRESHOLD = 6 // px de movimento pra considerar "arrastou" em vez de "clicou"

export default function FloorMap({
  tables,
  totals,
  canDrag,
  onOpenTable,
  onPositionChange,
}: {
  tables: TableRow[]
  totals: Record<string, number>
  canDrag: boolean
  onOpenTable: (table: TableRow) => void
  onPositionChange: (tableId: string, x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [livePos, setLivePos] = useState<Record<string, { x: number; y: number }>>({})
  const dragInfo = useRef<{ id: string; moved: boolean; pointerId: number } | null>(null)

  const clamp = (v: number) => Math.min(96, Math.max(4, v))

  const handlePointerDown = (e: React.PointerEvent, table: TableRow) => {
    if (!canDrag) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragInfo.current = { id: table.id, moved: false, pointerId: e.pointerId }
    setDraggingId(table.id)
  }

  const handlePointerMove = (e: React.PointerEvent, table: TableRow) => {
    if (!dragInfo.current || dragInfo.current.id !== table.id) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100)
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100)
    dragInfo.current.moved = true
    setLivePos(prev => ({ ...prev, [table.id]: { x, y } }))
  }

  const handlePointerUp = (e: React.PointerEvent, table: TableRow) => {
    if (!dragInfo.current || dragInfo.current.id !== table.id) return
    const moved = dragInfo.current.moved
    const pos = livePos[table.id]
    dragInfo.current = null
    setDraggingId(null)

    if (moved && pos) {
      onPositionChange(table.id, pos.x, pos.y)
    } else {
      onOpenTable(table)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full border border-line rounded-2xl select-none"
      style={{ aspectRatio: '1919 / 820', touchAction: canDrag ? 'none' : 'auto' }}
    >
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <img
          src={withBasePath('/tables/croqui.png')}
          alt="Croqui do salão"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {tables.map((table, i) => {
        const pos = livePos[table.id] || { x: table.pos_x ?? 15, y: table.pos_y ?? 50 }
        const isDragging = draggingId === table.id
        const total = totals[table.id] || 0
        return (
          <TableMarker
            key={table.id}
            table={table}
            x={pos.x}
            y={pos.y}
            index={i}
            isDragging={isDragging}
            total={total}
            canDrag={canDrag}
            onPointerDown={(e) => handlePointerDown(e, table)}
            onPointerMove={(e) => handlePointerMove(e, table)}
            onPointerUp={(e) => handlePointerUp(e, table)}
          />
        )
      })}
    </div>
  )
}

function TableMarker({
  table, x, y, index, isDragging, total, canDrag,
  onPointerDown, onPointerMove, onPointerUp,
}: {
  table: TableRow
  x: number
  y: number
  index: number
  isDragging: boolean
  total: number
  canDrag: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}) {
  const animatedTotal = useCountUp(total)
  const icon = table.status === 'ocupada' ? '/tables/mesa-ocupada.png' : '/tables/mesa-livre.png'

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="table-marker-enter absolute flex flex-col items-center"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        zIndex: isDragging ? 30 : 10,
        animationDelay: `${index * 60}ms`,
        touchAction: canDrag ? 'none' : 'auto',
      }}
    >
      <div
        className={`relative transition-transform duration-150 ${isDragging ? 'scale-110' : ''} ${table.status === 'ocupada' ? 'table-pulse' : ''}`}
        style={{
          filter: isDragging ? 'drop-shadow(0 12px 20px rgba(0,0,0,.6))' : 'drop-shadow(0 4px 10px rgba(0,0,0,.4))',
        }}
      >
        <img src={withBasePath(icon)} alt="" className="w-[64px] h-[64px] md:w-[76px] md:h-[76px] pointer-events-none" draggable={false} />
        <div className="absolute inset-0 flex items-center justify-center font-display text-lg md:text-xl text-paper pointer-events-none">
          {table.number}
        </div>
      </div>
      {table.status === 'ocupada' && (
        <div className="mt-1 bg-bgElevated border border-red-dark rounded-full px-2.5 py-0.5 text-[11px] font-display text-red-bright shadow-lg whitespace-nowrap pointer-events-none">
          {fmt(animatedTotal)}
        </div>
      )}
    </div>
  )
}
