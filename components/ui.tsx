'use client'

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Minus,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

export const cn = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ')

export const fmtMoney = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')

export const initialsOf = (name: string | null | undefined) => {
  const base = (name || '').trim()
  if (!base) return '?'
  const parts = base.split(/[\s@._-]+/).filter(Boolean)
  const first = parts[0]?.[0] || ''
  const second = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + second).toUpperCase() || '?'
}

/* ------------------------------------------------------------------ */
/* Botões                                                              */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium select-none whitespace-nowrap ' +
  'transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ' +
  'disabled:opacity-40 disabled:pointer-events-none'

const buttonVariants: Record<Variant, string> = {
  primary: 'bg-red text-white hover:bg-red-bright',
  secondary: 'bg-raised text-ink border border-line hover:bg-hover hover:border-lineStrong',
  ghost: 'text-ink2 hover:bg-raised hover:text-ink',
  danger: 'bg-red/10 text-red-bright border border-red/30 hover:bg-red/20',
  success: 'bg-ok text-bg font-semibold hover:bg-ok/90',
}

const buttonSizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  loading?: boolean
  full?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading,
  full,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], full && 'w-full', className)}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      ) : null}
      {children}
    </button>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
  variant?: Variant
  size?: 'sm' | 'md'
}

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        buttonBase,
        buttonVariants[variant],
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        'shrink-0 px-0',
        className,
      )}
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Cartões, seções e cabeçalhos                                        */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({
  children,
  right,
  className,
}: {
  children: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h3 className="min-w-0 truncate text-sm font-semibold text-ink2">{children}</h3>
      {right}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-56">
        <h1 className="break-words text-2xl font-semibold leading-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Campos de formulário                                                */
/* ------------------------------------------------------------------ */

export const inputCls =
  'w-full h-11 rounded-[10px] border border-line bg-bg px-3.5 text-sm text-ink placeholder:text-mute ' +
  'transition-colors hover:border-lineStrong focus:border-red focus:outline-none focus:ring-2 focus:ring-red/25 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label?: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-ink2">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-xs text-mute">{hint}</span>}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }>(
  function Input({ className, icon: Icon, ...rest }, ref) {
    if (!Icon) return <input ref={ref} className={cn(inputCls, className)} {...rest} />
    return (
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" aria-hidden />
        <input ref={ref} className={cn(inputCls, 'pl-10', className)} {...rest} />
      </div>
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputCls, 'appearance-none truncate pr-10', className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute"
        aria-hidden
      />
    </div>
  )
})

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-3 text-left text-sm text-ink"
    >
      <span
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150',
          checked ? 'bg-red' : 'bg-hover',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Stepper (− 1 +) e Segmented                                         */
/* ------------------------------------------------------------------ */

export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  size = 'md',
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  label: string
}) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const btn = cn(
    dim,
    'flex shrink-0 items-center justify-center rounded-[10px] border border-line bg-raised text-ink2',
    'transition-colors hover:border-lineStrong hover:bg-hover hover:text-ink active:scale-95',
    'disabled:pointer-events-none disabled:opacity-40',
  )
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className={cn('min-w-[28px] text-center text-sm font-semibold tnum', size === 'sm' ? 'text-[13px]' : '')}>
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`Aumentar ${label}`}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: LucideIcon }[]
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-xl border border-line bg-surface p-1', className)} role="group">
      {options.map(o => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors duration-150',
              active ? 'bg-hover text-ink' : 'text-mute hover:text-ink',
            )}
          >
            {Icon && <Icon className={cn('h-3.5 w-3.5', active && 'text-red-bright')} aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Badge, Avatar, EmptyState, Loading                                  */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'red' | 'green' | 'amber' | 'blue'
const toneCls: Record<Tone, string> = {
  neutral: 'bg-raised text-ink2 border-line',
  red: 'bg-red/15 text-red-bright border-red/30',
  green: 'bg-ok/10 text-ok border-ok/25',
  amber: 'bg-warn/10 text-warn border-warn/25',
  blue: 'bg-info/10 text-info border-info/25',
}

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
        toneCls[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  )
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dim = size === 'sm' ? 'h-7 w-7 text-[11px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-raised font-semibold text-ink2',
        dim,
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-raised text-mute">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingBlock({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn('flex items-center justify-center gap-2.5 py-12 text-sm text-mute', className)}
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  )
}

export function ProgressBar({
  value,
  tone = 'red',
  className,
}: {
  value: number
  tone?: 'red' | 'soft' | 'green' | 'amber'
  className?: string
}) {
  const color = tone === 'green' ? 'bg-ok' : tone === 'amber' ? 'bg-warn' : tone === 'soft' ? 'bg-red/45' : 'bg-red'
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-hover', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal (vira "bottom sheet" no celular)                              */
/* ------------------------------------------------------------------ */

export function Modal({
  onClose,
  title,
  titleAdornment,
  children,
  footer,
  size = 'md',
  layer = 50,
}: {
  onClose: () => void
  title: ReactNode
  titleAdornment?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md'
  layer?: 50 | 60
}) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Com um diálogo de confirmação aberto por cima, só ele reage ao Esc
      if (layer === 50 && document.querySelector('[data-modal-layer="60"]')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, layer])

  return (
    <div
      data-modal-layer={layer}
      className={cn(
        'fixed inset-0 flex items-end justify-center bg-black/65 backdrop-blur-[3px] animate-fade-in sm:items-center sm:p-5',
        layer === 60 ? 'z-[60]' : 'z-50',
      )}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-2xl',
          'animate-sheet-in rounded-t-3xl sm:max-h-[88vh] sm:animate-pop-in sm:rounded-3xl',
          size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-xl',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 id={titleId} className="truncate text-xl font-semibold text-ink">
              {title}
            </h2>
            {titleAdornment}
          </div>
          <IconButton icon={X} label="Fechar" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Toasts e diálogo de confirmação (no lugar de alert/confirm)         */
/* ------------------------------------------------------------------ */

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; kind: ToastKind; message: string }
type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
}

type UIContextType = {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
  }
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const UIContext = createContext<UIContextType | null>(null)

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI precisa estar dentro de <UIProvider>')
  return ctx
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const nextId = useRef(1)

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++
    setToasts(prev => [...prev.slice(-2), { id, kind, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>(resolve => setDialog({ ...opts, resolve })),
    [],
  )

  const value = useMemo<UIContextType>(
    () => ({
      toast: {
        success: m => push('success', m),
        error: m => push('error', m),
        info: m => push('info', m),
      },
      confirm,
    }),
    [push, confirm],
  )

  const answer = (v: boolean) => {
    dialog?.resolve(v)
    setDialog(null)
  }

  return (
    <UIContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
      >
        {toasts.map(t => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? TriangleAlert : Info
          const color = t.kind === 'success' ? 'text-ok' : t.kind === 'error' ? 'text-red-bright' : 'text-info'
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-xl border border-lineStrong bg-raised px-4 py-3 text-sm text-ink shadow-2xl"
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', color)} aria-hidden />
              <span className="min-w-0 flex-1 break-words">{t.message}</span>
            </div>
          )
        })}
      </div>

      {dialog && (
        <Modal
          size="sm"
          layer={60}
          onClose={() => answer(false)}
          title={dialog.title}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" full onClick={() => answer(false)}>
                {dialog.cancelLabel || 'Cancelar'}
              </Button>
              <Button variant="primary" full onClick={() => answer(true)}>
                {dialog.confirmLabel || 'Confirmar'}
              </Button>
            </div>
          }
        >
          {dialog.message && <p className="text-sm leading-relaxed text-ink2">{dialog.message}</p>}
        </Modal>
      )}
    </UIContext.Provider>
  )
}
