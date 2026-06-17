import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ChevronDown } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { EDUCATION_LEVELS, REGIONS } from '@/lib/constants'
import Logo from '@/components/Logo'

const DISTRICTS = [
  'Adjumani','Agago','Alebtong','Amolatar','Amuru','Apac','Arua','Bududa','Bugiri',
  'Buikwe','Bukedea','Bukomansimbi','Bulambuli','Bundibugyo','Bushenyi','Busia',
  'Butaleja','Butebo','Buvuma','Buyende','Dokolo','Fort Portal','Gomba','Hoima',
  'Ibanda','Iganga','Isingiro','Jinja','Kabale','Kaberamaido','Kalangala','Kaliro',
  'Kalungu','Kampala','Kamuli','Kamwenge','Kanungu','Kasese','Kayunga','Kiboga',
  'Kibuku','Kiruhura','Kisoro','Kitgum','Koboko','Kole','Kumi','Kyankwanzi',
  'Kyenjojo','Lamwo','Lira','Luuka','Luwero','Lwengo','Lyantonde','Manafwa',
  'Maracha','Masaka','Masindi','Mayuge','Mbale','Mbarara','Mityana','Moyo',
  'Mubende','Mukono','Nakaseke','Nakasongola','Namayingo','Namisindwa','Namutumba',
  'Nebbi','Ngora','Ntungamo','Nwoya','Oyam','Pader','Pakwach','Pallisa','Rakai',
  'Rukungiri','Sembabule','Serere','Sironko','Soroti','Tororo','Wakiso','Yumbe','Zombo',
].sort()

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    district: '', region: '', education_level: '',
    school: '', combination: '', course: '', profession: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const isALevel = ['S5', 'S6'].includes(form.education_level)
  const isUniversity = form.education_level === 'University'
  const isProfessional = form.education_level === 'Professional'
  const showSchool = !isUniversity && !isProfessional && form.education_level !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!form.district) { setError('Please select your district'); return }
    if (!form.education_level) { setError('Please select your education level'); return }
    setError(''); setLoading(true)
    const err = await register(form.email.trim(), form.password, {
      name: form.name, district: form.district, region: form.region,
      education_level: form.education_level, school: form.school,
      combination: form.combination, course: form.course, profession: form.profession,
    })
    setLoading(false)
    if (err) setError(err)
    else navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-bg relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.1), transparent)' }} />

      {/* Top bar */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-5 py-4 flex items-center gap-3">
        <Logo size="sm" />
        <span className="text-text-white text-xl font-bold">Create Account</span>
      </div>

      <div className="px-6 py-5 pb-10 max-w-lg mx-auto">
        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-5 text-error text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Full Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Your full name" required className="input-field" />
          </div>

          <div>
            <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="your@email.com" required className="input-field" />
          </div>

          <div>
            <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Min 6 characters" required className="input-field pr-11" />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-light">
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Confirm Password</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                onChange={e => set('confirmPassword', e.target.value)}
                placeholder="Repeat password" required className="input-field pr-11" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-light">
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">District</label>
            <select value={form.district} onChange={e => set('district', e.target.value)} className="input-field">
              <option value="">Select your district</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Region</label>
            <select value={form.region} onChange={e => set('region', e.target.value)} className="input-field">
              <option value="">Select region</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Education Level</label>
            <select value={form.education_level} onChange={e => set('education_level', e.target.value)} className="input-field">
              <option value="">Select level</option>
              {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {isALevel && (
            <>
              <div className="rounded-xl px-3 py-3" style={{ backgroundColor: 'rgba(255,184,0,0.08)' }}>
                <p className="text-text-disabled text-xs">Enter your subject combination (e.g. PCB, HEG). General Paper is always included.</p>
              </div>
              <div>
                <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Subject Combination (e.g. PCB, HEG)</label>
                <input value={form.combination} onChange={e => set('combination', e.target.value)}
                  placeholder="e.g. PCB" className="input-field" />
              </div>
            </>
          )}

          {isUniversity && (
            <>
              <div className="rounded-xl px-3 py-3" style={{ backgroundColor: 'rgba(255,184,0,0.08)' }}>
                <p className="text-text-disabled text-xs">Your AI tutor will focus all learning around your university course.</p>
              </div>
              <div>
                <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">University Course</label>
                <input value={form.course} onChange={e => set('course', e.target.value)}
                  placeholder="e.g. Bachelor of Medicine" className="input-field" />
              </div>
            </>
          )}

          {isProfessional && (
            <>
              <div className="rounded-xl px-3 py-3" style={{ backgroundColor: 'rgba(255,184,0,0.08)' }}>
                <p className="text-text-disabled text-xs">Your AI tutor will focus all learning around your profession.</p>
              </div>
              <div>
                <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Your Profession</label>
                <input value={form.profession} onChange={e => set('profession', e.target.value)}
                  placeholder="e.g. Nurse, Engineer, Teacher" className="input-field" />
              </div>
            </>
          )}

          {showSchool && (
            <div>
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">School (Optional)</label>
              <input value={form.school} onChange={e => set('school', e.target.value)}
                placeholder="Your school name" className="input-field" />
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all mt-2"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: '#0A0A1F',
            }}>
            {loading ? <Loader2 size={22} className="animate-spin" /> : 'Create Account'}
          </button>

          <p className="text-center text-text-disabled text-sm pt-2">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
          </p>
        </form>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Loader2 size={36} className="animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}
