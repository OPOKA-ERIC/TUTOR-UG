export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 80 : size === 'lg' ? 44 : 36
  return (
    <img
      src="/assets/logo.jpg"
      alt="TutorUG"
      width={dims}
      height={dims}
      className="object-contain rounded-lg"
    />
  )
}
