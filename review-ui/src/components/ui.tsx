import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40'
  const sizes: Record<Size, string> = { sm: 'px-2 py-1 text-xs', md: 'px-3 py-1.5 text-sm' }
  const variants: Record<Variant, string> = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700',
    secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  }
  return <button type={type} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
}

type Tone = 'neutral' | 'amber' | 'strong' | 'green' | 'blue'

export function Chip({ tone = 'neutral', children, title, className = '' }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  const tones: Record<Tone, string> = {
    neutral: 'border-stone-200 bg-stone-100 text-stone-700',
    amber: 'border-amber-300 bg-amber-50 text-amber-900',
    strong: 'border-amber-500 bg-amber-100 text-amber-950',
    green: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
  }
  return <span title={title} className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs leading-4 ${tones[tone]} ${className}`}>{children}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-stone-300 bg-stone-50 px-1 font-mono text-[11px] text-stone-600">{children}</kbd>
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: { options: readonly T[]; value: T; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap overflow-hidden rounded-md border border-stone-300 bg-white">
      {options.map(o => (
        <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onChange(o)}
          className={`border-r border-stone-200 px-2 py-1 text-xs last:border-r-0 ${o === value ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-xs text-stone-500">
      {label}
      <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-sm text-stone-900" />
    </label>
  )
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl p-8 text-sm text-stone-700">{children}</div>
}
