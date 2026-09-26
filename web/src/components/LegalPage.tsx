import type { ReactNode } from 'react'

export interface LegalSection {
  title: string
  body: string
}

/**
 * Shared shell for the legal pages so Privacy Policy and Terms of Service stay
 * visually identical to the rest of the app instead of raw browser text.
 */
export default function LegalPage({
  title,
  subtitle,
  intro,
  sections,
  renderBack,
}: {
  title: string
  subtitle: string
  intro: string
  sections: LegalSection[]
  backTo?: string
  renderBack?: () => ReactNode
}) {
  return (
    <div className="min-h-full overflow-y-auto" style={{ background: 'linear-gradient(180deg,#0F0F2E,#0A0A1F)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {renderBack?.()}

        <h1 className="text-text-white font-bold text-2xl mt-4">{title}</h1>
        <p className="text-text-disabled text-xs mt-1">{subtitle}</p>

        <div className="rounded-2xl p-4 mt-4"
          style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-sm leading-relaxed" style={{ color: '#F0F0FF' }}>{intro}</p>
        </div>

        <div className="space-y-3 mt-3">
          {sections.map((s) => (
            <div key={s.title} className="rounded-2xl p-4"
              style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 className="text-sm font-bold mb-1.5" style={{ color: '#FFB800' }}>{s.title}</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#C8C8E0' }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="h-8" />
      </div>
    </div>
  )
}
