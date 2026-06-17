import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, User, Mail, Lock, MapPin, GraduationCap } from 'lucide-react'
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
    <div className="min-h-screen bg-gradient-to-b from-surface to-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,184,0,0.1), transparent)' }} />
      <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.1), transparent)' }} />

      <div className="w-full max-w-xl relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <Logo size="sm" />
          </div>
          <h1 className="text-text-white text-3xl font-bold">Create Account</h1>
          <p className="text-text-disabled mt-2 text-sm">Join Uganda's Smart Learning Companion</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-3xl p-6">
          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-5 text-error text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Your full name" required className="input-field pl-9" />
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="your@email.com" required className="input-field pl-9" />
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input type={showPwd ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min 6 characters" required className="input-field pl-9 pr-10" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-light">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Repeat password" required className="input-field pl-9 pr-10" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-light">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">District</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <select value={form.district} onChange={e => set('district', e.target.value)} className="input-field pl-9">
                  <option value="">Select your district</option>
                  {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Education Level</label>
              <div className="relative">
                <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <select value={form.education_level} onChange={e => set('education_level', e.target.value)} className="input-field pl-9">
                  <option value="">Select level</option>
                  {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {isALevel && (
              <>
                <div className="col-span-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,184,0,0.08)' }}>
                  <p className="text-text-disabled text-xs">Enter your subject combination (e.g. PCB, HEG). General Paper is always included.</p>
                </div>
                <div className="col-span-2">
                  <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Subject Combination</label>
                  <input value={form.combination} onChange={e => set('combination', e.target.value)}
                    placeholder="e.g. PCB" className="input-field" />
                </div>
              </>
            )}

            {isUniversity && (
              <>
                <div className="col-span-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,184,0,0.08)' }}>
                  <p className="text-text-disabled text-xs">Your AI tutor will focus all learning around your university course.</p>
                </div>
                <div className="col-span-2">
                  <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">University Course</label>
                  <input value={form.course} onChange={e => set('course', e.target.value)}
                    placeholder="e.g. Bachelor of Medicine" className="input-field" />
                </div>
              </>
            )}

            {isProfessional && (
              <>
                <div className="col-span-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,184,0,0.08)' }}>
                  <p className="text-text-disabled text-xs">Your AI tutor will focus all learning around your profession.</p>
                </div>
                <div className="col-span-2">
                  <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Your Profession</label>
                  <input value={form.profession} onChange={e => set('profession', e.target.value)}
                    placeholder="e.g. Nurse, Engineer, Teacher" className="input-field" />
                </div>
              </>
            )}

            {showSchool && (
              <div className="col-span-2">
                <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">School (Optional)</label>
                <input value={form.school} onChange={e => set('school', e.target.value)}
                  placeholder="Your school name" className="input-field" />
              </div>
            )}

            <div className="col-span-2">
              <button type="submit" disabled={loading}
                className="w-full h-12 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all"
                style={{
                  background: loading ? 'linear-gradient(135deg, #252545, #252545)' : 'linear-gradient(135deg, #F59E0B, #D97706)',
                  color: loading ? '#606080' : '#0A0A1F',
                }}>
                {loading ? <Loader2 size={20} className="animate-spin" /> : 'Create Account'}
              </button>
            </div>

            <div className="col-span-2 flex items-center gap-3">
              <div className="flex-1 h-px bg-outline" />
              <span className="text-text-disabled text-sm">or</span>
              <div className="flex-1 h-px bg-outline" />
            </div>

            <Link to="/login"
              className="col-span-2 w-full h-12 rounded-2xl font-semibold text-base flex items-center justify-center transition-all"
              style={{
                border: '1.5px solid',
                borderColor: 'rgba(255,184,0,0.5)',
                color: '#FFB800',
              }}>
              Sign In
            </Link>
          </form>
        </div>

        <p className="text-center text-text-disabled text-sm mt-6">🇺🇬 Empowering Ugandan Students</p>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl px-8 py-8 flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-text-disabled text-sm">Creating your account...</p>
          </div>
        </div>
      )}
    </div>
  )
}
