import { useMemo } from 'react'
import { sortSubjects } from '../lib/subjectSort'

type SubjectChipsProps = {
  subjects: string[]
  selectedSubject: string
  onSelect: (subject: string) => void
  disabled?: boolean
}

export const SubjectChips = ({ subjects, selectedSubject, onSelect, disabled = false }: SubjectChipsProps) => {
  const sortedSubjects = useMemo(() => sortSubjects(subjects), [subjects])

  return (
    <div className="subject-chips">
      <button
        type="button"
        className={`subject-chip ${selectedSubject === '' ? 'active all' : ''}`}
        disabled={disabled}
        onClick={() => onSelect('')}
      >
        Alle vakken
      </button>

      {sortedSubjects.map((subject, index) => (
        <button
          key={subject}
          type="button"
          className={`subject-chip chip-${index % 6} ${
            selectedSubject === subject ? 'active' : ''
          }`}
          disabled={disabled}
          onClick={() => onSelect(subject)}
        >
          {subject}
        </button>
      ))}
    </div>
  )
}
