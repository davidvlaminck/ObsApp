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

// Klas-types sorteren: JK, 2K, 3K
const CLASS_TYPE_ORDER: Record<string, number> = {
  JK: 0,
  K2: 1,
  K3: 2,
}

export const sortClasses = <T extends { class_type: string; name: string }>(classes: T[]): T[] => {
  return [...classes].sort((a, b) => {
    const orderA = CLASS_TYPE_ORDER[a.class_type] ?? 999
    const orderB = CLASS_TYPE_ORDER[b.class_type] ?? 999
    if (orderA !== orderB) {
      return orderA - orderB
    }
    return a.name.localeCompare(b.name)
  })
}
