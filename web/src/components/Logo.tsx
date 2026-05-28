export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <span className={`font-black ${s} tracking-tight`}>
      <span className="text-primary">Tutor</span>
      <span className="text-text-white">UG</span>
      <span className="text-primary ml-1">🇺🇬</span>
    </span>
  )
}
