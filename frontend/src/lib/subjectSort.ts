const PRIORITY_SUBJECTS = ['Nederlands', 'Wiskunde', 'Wetenschap en techniek'] as const
type PrioritySubject = typeof PRIORITY_SUBJECTS[number]

const getPriorityIndex = (subject: string): number => {
  return PRIORITY_SUBJECTS.indexOf(subject as PrioritySubject)
}

export const sortSubjects = (subjects: string[]): string[] => {
  const prioritySet = new Set(PRIORITY_SUBJECTS)

  const priority: string[] = []
  const rest: string[] = []

  for (const subject of subjects) {
    if (prioritySet.has(subject as PrioritySubject)) {
      priority.push(subject)
    } else {
      rest.push(subject)
    }
  }

  priority.sort((a, b) => getPriorityIndex(a) - getPriorityIndex(b))
  rest.sort((a, b) => a.localeCompare(b))

  return [...priority, ...rest]
}
