import type { CSSProperties } from 'react'
import type { StudentResponse } from '../services/auth'

type StudentAvatarProps = {
  student: StudentResponse
  className?: string
  style?: CSSProperties
}

const avatarColors = [
  '#1976d2',
  '#7b1fa2',
  '#00897b',
  '#c62828',
  '#f9a825',
  '#2e7d32',
  '#6a1b9a',
  '#0277bd',
  '#ef6c00',
  '#5d4037',
  '#455a64',
  '#8e24aa',
]

export const getStudentInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return ''
  }

  const firstInitial = parts[0].charAt(0).toUpperCase()
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : firstInitial

  return `${firstInitial}${lastInitial}`
}

export const getStudentAvatarColor = (name: string) => {
  const hash = name.split('').reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
  return avatarColors[hash % avatarColors.length]
}

export function StudentAvatar({ student, className, style }: StudentAvatarProps) {
  const hasImage = Boolean(student.image_path?.trim())

  if (hasImage) {
    return (
      <img
        src={student.image_path ?? ''}
        alt={student.name}
        className={`student-avatar-image ${className ?? ''}`.trim()}
        style={style}
      />
    )
  }

  return (
    <span
      className={`student-avatar ${className ?? ''}`.trim()}
      style={{ backgroundColor: getStudentAvatarColor(student.name), ...style }}
      aria-hidden="true"
    >
      {getStudentInitials(student.name)}
    </span>
  )
}
