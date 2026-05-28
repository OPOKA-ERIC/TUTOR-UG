import type { UserProfile } from '@/types'

export const EDUCATION_LEVELS = [
  'Primary 1','Primary 2','Primary 3','Primary 4',
  'Primary 5','Primary 6','Primary 7',
  'S1','S2','S3','S4','S5','S6',
  'University','Professional',
]

export const PRIMARY_SUBJECTS = [
  'English','Mathematics','Science','Social Studies','Religious Education',
]

export const O_LEVEL_SUBJECTS = [
  'English Language','Mathematics','Biology','Chemistry','Physics',
  'Geography','History','Commerce','Agriculture','CRE',
  'IRE','Fine Art','Music','Physical Education',
  'Computer Studies','Technical Drawing','Luganda','French',
  'Entrepreneurship','Home Economics',
]

const A_LEVEL_MAP: Record<string, string> = {
  P:'Physics', C:'Chemistry', B:'Biology', M:'Mathematics',
  E:'Economics', G:'Geography', H:'History', L:'Literature in English',
  D:'Divinity', A:'Art', T:'Technical Drawing', F:'French',
  U:'Luganda', S:'Subsidiary ICT', K:'Kiswahili',
}

export const REGIONS = ['Northern','Eastern','Central','Western','West Nile']

export const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export function getSidebarSubjects(profile: UserProfile): string[] {
  const level = profile.education_level
  if (level.startsWith('Primary')) return PRIMARY_SUBJECTS
  if (['S1','S2','S3','S4'].includes(level)) return O_LEVEL_SUBJECTS
  if (['S5','S6'].includes(level)) {
    const combo = (profile.combination || '').toUpperCase().trim()
    const subjects = combo.split('').map(l => A_LEVEL_MAP[l]).filter(Boolean)
    subjects.push('General Paper')
    return subjects.length === 1 ? [...Object.values(A_LEVEL_MAP), 'General Paper'] : subjects
  }
  return []
}

export function getSubjectsForLevel(level: string): string[] {
  if (level.startsWith('Primary')) return PRIMARY_SUBJECTS
  if (['S1','S2','S3','S4'].includes(level)) return O_LEVEL_SUBJECTS
  if (['S5','S6'].includes(level)) return [
    'Physics','Chemistry','Biology','Mathematics',
    'Economics','Geography','History','Literature',
    'Divinity','Art','General Paper',
  ]
  return ['Course Material','Research','Professional Skills']
}

export function formatTime(hour: number, min: number): string {
  return `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`
}
