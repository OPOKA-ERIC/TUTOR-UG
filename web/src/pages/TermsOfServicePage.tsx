import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import LegalPage, { type LegalSection } from '@/components/LegalPage'

const SECTIONS: LegalSection[] = [
  {
    title: '1. Acceptance of Terms',
    body: 'By creating an account and using TutorUG, you confirm that you are at least 8 years old or have parental consent, and that you agree to be bound by these terms.',
  },
  {
    title: '2. Use of the Service',
    body: 'TutorUG is an AI-powered educational platform designed for Ugandan students. You may use the service for personal, non-commercial educational purposes only. You must not misuse the platform, attempt to reverse-engineer it, or use it to generate harmful content.',
  },
  {
    title: '3. User Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate information during registration. TutorUG reserves the right to suspend accounts that violate these terms.',
  },
  {
    title: '4. AI-Generated Content',
    body: 'TutorUG uses Anthropic Claude AI to generate educational responses. While we strive for accuracy, AI responses may occasionally contain errors. Always verify important information with your teachers or official curriculum materials.',
  },
  {
    title: '5. Uploaded Content',
    body: 'You retain ownership of documents and notes you upload. By uploading content, you grant TutorUG a limited licence to process and analyse it solely for the purpose of providing educational assistance to you.',
  },
  {
    title: '6. Prohibited Conduct',
    body: 'You must not use TutorUG to cheat in examinations, upload copyrighted material without permission, harass other users, attempt to access other users’ data, or use the service for any illegal purpose.',
  },
  {
    title: '7. Service Availability',
    body: "TutorUG is provided on an 'as is' basis. We do not guarantee uninterrupted access. We may update, modify, or discontinue features at any time with reasonable notice.",
  },
  {
    title: '8. Limitation of Liability',
    body: 'TutorUG and its founders shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid for the service in the past 12 months.',
  },
  {
    title: '9. Changes to Terms',
    body: 'We may update these terms from time to time. Continued use of TutorUG after changes constitutes acceptance of the new terms. We will notify users of significant changes via the app.',
  },
  {
    title: '10. Contact',
    body: 'For questions about these Terms, contact us at:\n\nEmail: info@tutorug.com\nTutorUG, Uganda',
  },
]

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="Effective: January 2025"
      intro="By using TutorUG, you agree to these Terms of Service. Please read them carefully before using the app."
      sections={SECTIONS}
      renderBack={() => (
        <Link to="/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: '#7C4DFF' }}>
          <ArrowLeft size={13} /> Back to Settings
        </Link>
      )}
    />
  )
}
