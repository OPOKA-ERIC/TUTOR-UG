import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ChevronRight, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { EDUCATION_LEVELS, REGIONS } from '@/lib/constants'
import Logo from '@/components/Logo'

const DISTRICTS = [
  'Kampala','Wakiso','Mukono','Jinja','Mbale','Gulu','Lira','Mbarara',
  'Masaka','Arua','Fort Portal','Kabale','Soroti','Tororo','Iganga',
  'Hoima','Masindi','Kasese','Bushenyi','Ntungamo','Rukungiri','Kanungu',
  'Kisoro','Kabale','Bundibugyo','Kyenjojo','Kamwenge','Ibanda','Kiruhura',
  'Isingiro','Rakai','Lyantonde','Lwengo','Kalungu','Bukomansimbi',
  'Gomba','Butebo','Namisindwa','Pakwach','Zombo','Nebbi','Maracha',
  'Koboko','Yumbe','Moyo','Adjumani','Amuru','Nwoya','Lamwo','Kitgum',
  'Pader','Agago','Kole','Oyam','Apac','Dokolo','Alebtong','Otuke',
  'Amolatar','Kaberamaido','Serere','Ngora','Kumi','Bukedea','Bulambuli',
  'Sironko','Manafwa','Bududa','Mbale','Namisindwa','Butebo','Pallisa',
  'Kibuku','Butebo','Busia','Tororo','Butaleja','Namutumba','Iganga',
  'Bugiri','Mayuge','Jinja','Kamuli','Buyende','Kaliro','Luuka',
  'Namayingo','Buvuma','Mukono','Kayunga','Buikwe','Buvuma','Kalangala',
  'Masaka','Lwengo','Kalungu','Bukomansimbi','Rakai','Lyantonde',
  'Sembabule','Mubende','Mityana','Kassanda','Kiboga','Kyankwanzi',
  'Wakiso','Kampala','Luwero','Nakaseke','Nakasongola','Kayunga',
].sort()

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    district: '', region: '', education_level: '',
    school: '', combination: '', course: '', profession: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
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

  const showExtra = ['S5','S6'].includes(form.education_level)
  const showSchool = !['University','Professional'].includes(form.education_level) && form.education_level !== ''
  const showCourse = form.education_level === 'University'
  const showProfession = form.education_level === 'Professional'

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="text-text-disabled mt-2 text-sm">Create your learning account</p>
        </div>

        <div className="card">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1,2].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-outline'}`} />
            ))}
          </div>

          <h2 className="text-text-white text-xl font-bold mb-5">
            {step === 1 ? 'Account Details' : 'Your Profile'}
          </h2>

          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-4 text-error text-sm">{error}</div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-text-light text-sm mb-1.5 block">Full Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Your full name" className="input-field" />
              </div>
              <div>
                <label className="text-text-light text-sm mb-1.5 block">Email Address</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com" className="input-field" />
              </div>
              <div>
                <label className="text-text-light text-sm mb-1.5 block">Password</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder="Min 6 characters" className="input-field" />
              </div>
              <div>
                <label className="text-text-light text-sm mb-1.5 block">Confirm Password</label>
                <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Repeat password" className="input-field" />
              </div>
              <button onClick={() => {
                if (!form.name || !form.email || !form.password) { setError('Please fill all fields'); return }
                setError(''); setStep(2)
              }} className="btn-primary w-full flex items-center justify-center gap-2">
                Next <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-text-light text-sm mb-1.5 block">District</label>
                <select value={form.district} onChange={e => set('district', e.target.value)} className="input-field">
                  <option value="">Select your district</option>
                  {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-text-light text-sm mb-1.5 block">Region</label>
                <select value={form.region} onChange={e => set('region', e.target.value)} className="input-field">
                  <option value="">Select region</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-text-light text-sm mb-1.5 block">Education Level</label>
                <select value={form.education_level} onChange={e => set('education_level', e.target.value)} className="input-field">
                  <option value="">Select level</option>
                  {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              {showSchool && (
                <div>
                  <label className="text-text-light text-sm mb-1.5 block">School Name</label>
                  <input value={form.school} onChange={e => set('school', e.target.value)}
                    placeholder="Your school" className="input-field" />
                </div>
              )}
              {showExtra && (
                <div>
                  <label className="text-text-light text-sm mb-1.5 block">Combination (e.g. PCB, HEG)</label>
                  <input value={form.combination} onChange={e => set('combination', e.target.value)}
                    placeholder="e.g. PCB" className="input-field" />
                </div>
              )}
              {showCourse && (
                <div>
                  <label className="text-text-light text-sm mb-1.5 block">Course / Programme</label>
                  <input value={form.course} onChange={e => set('course', e.target.value)}
                    placeholder="e.g. Computer Science" className="input-field" />
                </div>
              )}
              {showProfession && (
                <div>
                  <label className="text-text-light text-sm mb-1.5 block">Profession</label>
                  <input value={form.profession} onChange={e => set('profession', e.target.value)}
                    placeholder="e.g. Nurse, Engineer" className="input-field" />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1">
                  <ChevronLeft size={18} /> Back
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-text-disabled text-sm mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
