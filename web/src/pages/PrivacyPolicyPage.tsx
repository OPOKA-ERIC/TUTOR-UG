import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import LegalPage, { type LegalSection } from '@/components/LegalPage'

const SECTIONS: LegalSection[] = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide during registration including your name, email address, district, education level, school, and course or profession. We also collect chat messages, quiz results, and uploaded documents to provide our learning services.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'Your information is used solely to personalise your learning experience on TutorUG. We use your district and education level to provide localised Ugandan content. Your chat history and quiz results are used to track your progress and improve AI responses.',
  },
  {
    title: '3. Data Storage & Security',
    body: 'All data is stored securely on Supabase servers with AES-256 encryption at rest and TLS encryption in transit. Your documents are stored in private storage buckets accessible only to you. API keys and sensitive credentials are never stored on your device.',
  },
  {
    title: '4. Data Sharing',
    body: 'We do not sell, trade, or share your personal information with third parties. Your data is only shared with our AI provider (Anthropic Claude) to generate educational responses, and only the minimum necessary context is sent.',
  },
  {
    title: '5. Profile Pictures',
    body: 'Profile pictures you upload are stored in a public storage bucket solely for display purposes within the app. You can change or remove your profile picture at any time from Settings.',
  },
  {
    title: '6. Children’s Privacy',
    body: 'TutorUG serves students from Primary level upwards. We take extra care to protect the privacy of younger users. We do not knowingly collect unnecessary personal information from children.',
  },
  {
    title: '7. Your Rights',
    body: 'You have the right to access, correct, or delete your personal data at any time. You can delete your account by contacting us at info@tutorug.com. Upon deletion, all your data including messages, quiz results, and documents will be permanently removed.',
  },
  {
    title: '8. Contact Us',
    body: 'If you have any questions about this Privacy Policy, please contact us at:\n\nEmail: info@tutorug.com\nTutorUG, Uganda',
  },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="Last updated: January 2025"
      intro="TutorUG is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information."
      sections={SECTIONS}
      backTo="/settings"
      renderBack={() => (
        <Link to="/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: '#7C4DFF' }}>
          <ArrowLeft size={13} /> Back to Settings
        </Link>
      )}
    />
  )
}
