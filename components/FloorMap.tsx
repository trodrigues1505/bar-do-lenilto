'use client'

import { useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { useCountUp } from '@/hooks/useCountUp'
import { BellRing, CalendarClock } from 'lucide-react'
import { cn, fmtMoney } from '@/components/ui'

type TableStatus = 'livre' | 'ocupada' | 'reservada'
type TableRow = {
  id: string
  number: number
  status: TableStatus
  pos_x: number | null
  pos_y: number | null
}

export default function FloorMap({
  tables,
  totals,
  billRequested,
  canDrag,
  onOpenTable,
  onPositionChange,
}: {
  tables: TableRow[]
  totals: Record<string, number>
  billRequested: Record<string, boolean>
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
      className="relative w-full select-none rounded-2xl border border-line bg-surface"
      style={{ aspectRatio: '1919 / 820', touchAction: canDrag ? 'none' : 'auto', containerType: 'inline-size' }}
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
        const attention = table.status === 'ocupada' && billRequested[table.id]
        return (
          <TableMarker
            key={table.id}
            table={table}
            x={pos.x}
            y={pos.y}
            index={i}
            isDragging={isDragging}
            total={total}
            attention={attention}
            canDrag={canDrag}
            onActivate={() => onOpenTable(table)}
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
  table, x, y, index, isDragging, total, attention, canDrag, onActivate,
  onPointerDown, onPointerMove, onPointerUp,
}: {
  table: TableRow
  x: number
  y: number
  index: number
  isDragging: boolean
  total: number
  attention: boolean
  canDrag: boolean
  onActivate: () => void
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}) {
  const animatedTotal = useCountUp(total)

  const icon = attention
    ? '/tables/mesa-atencao.png'
    : table.status === 'reservada'
    ? '/tables/mesa-reservada.png'
    : table.status === 'ocupada'
    ? '/tables/mesa-ocupada.png'
    : '/tables/mesa-livre.png'

  const pulseClass = attention ? 'table-pulse-blue' : table.status === 'ocupada' ? 'table-pulse' : ''

  const statusLabel = attention
    ? 'conta solicitada'
    : table.status === 'ocupada'
    ? 'ocupada'
    : table.status === 'reservada'
    ? 'reservada'
    : 'livre'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Mesa ${table.number}, ${statusLabel}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="table-marker-enter absolute flex flex-col items-center rounded-2xl focus-visible:outline-offset-4"
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
        className={`relative transition-transform duration-150 ${isDragging ? 'scale-110' : ''} ${pulseClass}`}
        style={{
          filter: isDragging ? 'drop-shadow(0 12px 20px rgba(0,0,0,.6))' : 'drop-shadow(0 4px 10px rgba(0,0,0,.4))',
        }}
      >
        {/* Tamanho proporcional à largura do mapa: no celular os ícones encolhem em vez de se sobrepor */}
        <img
          src={withBasePath(icon)}
          alt=""
          className="pointer-events-none"
          style={{ width: 'clamp(34px, 8cqw, 76px)', height: 'clamp(34px, 8cqw, 76px)' }}
          draggable={false}
        />
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.7)]"
          style={{ fontSize: 'clamp(13px, 2.6cqw, 20px)' }}
        >
          {table.number}
        </div>
      </div>

      {table.status === 'ocupada' && (
        <div
          className={cn(
            'pointer-events-none mt-0.5 flex items-center gap-1 whitespace-nowrap rounded-full border bg-bg/90 px-1.5 py-px text-[10px] font-semibold tabular-nums shadow-lg backdrop-blur-sm sm:mt-1 sm:px-2 sm:py-0.5 sm:text-[11px]',
            attention ? 'border-info/60 text-info' : 'border-red/50 text-red-bright',
          )}
        >
          {attention && <BellRing className="h-3 w-3" aria-hidden />}
          {fmtMoney(animatedTotal)}
        </div>
      )}
      {table.status === 'reservada' && (
        <div className="pointer-events-none mt-0.5 flex items-center gap-1 whitespace-nowrap rounded-full border border-warn/50 bg-bg/90 px-1.5 py-px text-[10px] font-semibold text-warn shadow-lg backdrop-blur-sm sm:mt-1 sm:px-2 sm:py-0.5 sm:text-[11px]">
          <CalendarClock className="h-3 w-3" aria-hidden />
          Reservada
        </div>
      )}
    </div>
  )
}
