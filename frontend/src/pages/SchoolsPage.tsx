import { AxiosError } from 'axios'
import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  activateSchoolYear,
  addTeacherToClass,
  confirmStudentImport,
  createClass,
  createSchool,
  createSchoolYear,
  deleteStudent,
  downloadStudentTemplate,
  getClassTeachers,
  getClasses,
  getMe,
  getSchoolYears,
  getSchools,
  getStudents,
  getUsers,
  previewStudents,
  removeTeacherFromClass,
  uploadStudentImage,
  ClassResponse,
  SchoolResponse,
  SchoolYearResponse,
  StudentConfirmItem,
  StudentPreviewItem,
  StudentResponse,
  UserResponse,
} from '../services/auth'

const formatDate = (value: string) => {
  if (!value) return value
  const [year, month, day] = value.split('-')
  return `${day}-${month}-${year}`
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<{ detail?: string }>
  const status = axiosError.response?.status
  const detail = axiosError.response?.data?.detail

  if (status === 307) {
    return 'De backend stuurt een redirect terug. Start de backend opnieuw op zodat de nieuwe routes actief zijn.'
  }

  if (status === 401) {
    return 'Sessie verlopen. Log opnieuw in.'
  }

  if (status === 403) {
    return 'Geen toegang.'
  }

  return detail ?? fallback
}

export default function SchoolsPage() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [schools, setSchools] = useState<SchoolResponse[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null)
  const [schoolYears, setSchoolYears] = useState<SchoolYearResponse[]>([])
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | null>(null)
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [studentsByClass, setStudentsByClass] = useState<Record<number, StudentResponse[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [schoolForm, setSchoolForm] = useState({ name: '', slug: '', is_active: true })
  const [schoolSaving, setSchoolSaving] = useState(false)
  const [schoolOpen, setSchoolOpen] = useState(false)

  const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '', is_active: false })
  const [yearSaving, setYearSaving] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const [canManageYears, setCanManageYears] = useState(false)

  const [classForm, setClassForm] = useState({ name: '', class_type: 'JK' })
  const [classSaving, setClassSaving] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [teachersByClass, setTeachersByClass] = useState<Record<number, UserResponse[]>>({})
  const [allUsers, setAllUsers] = useState<UserResponse[]>([])
  const [teacherModalClassId, setTeacherModalClassId] = useState<number | null>(null)

  const [uploading, setUploading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewItems, setPreviewItems] = useState<StudentPreviewItem[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const me = await getMe()
        setUser(me)
        const schoolsData = await getSchools()
        setSchools(schoolsData)
        if (me.school_id) {
          setSelectedSchoolId(me.school_id)
        }
        setCanManageYears(me.is_superuser || Boolean(me.school_id))
        setError('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan gegevens niet laden.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedSchoolId) {
      setSchoolYears([])
      setSelectedSchoolYearId(null)
      setClasses([])
      return
    }
    const loadYears = async () => {
      try {
        const years = await getSchoolYears(selectedSchoolId)
        setSchoolYears(years)
        const active = years.find((y) => y.is_active) ?? years[0] ?? null
        setSelectedSchoolYearId(active?.id ?? null)
        setError('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan schooljaren niet laden.'))
      }
    }
    loadYears()
  }, [selectedSchoolId])

   useEffect(() => {
    if (!selectedSchoolYearId) {
      setClasses([])
      setStudentsByClass({})
      setTeachersByClass({})
      return
    }
    const loadClasses = async () => {
      try {
        const data = await getClasses(selectedSchoolYearId)
        setClasses(data)
        // Load students for each class
        const studentsMap: Record<number, StudentResponse[]> = {}
        for (const cls of data) {
          try {
            const students = await getStudents(cls.id)
            studentsMap[cls.id] = students
          } catch {
            studentsMap[cls.id] = []
          }
        }
        setStudentsByClass(studentsMap)
        // Load teachers for each class
        const teachersMap: Record<number, UserResponse[]> = {}
        for (const cls of data) {
          try {
            const teachers = await getClassTeachers(cls.id)
            teachersMap[cls.id] = teachers
          } catch {
            teachersMap[cls.id] = []
          }
        }
        setTeachersByClass(teachersMap)
        setError('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan klassen niet laden.'))
      }
    }
    loadClasses()
  }, [selectedSchoolYearId])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getUsers()
        setAllUsers(users)
      } catch {
        // ignore
      }
    }
    loadUsers()
  }, [])

  const handleCreateSchool = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSchoolSaving(true)
    setError('')
    setSuccess('')
    try {
      const created = await createSchool({
        name: schoolForm.name,
        slug: schoolForm.slug || undefined,
        is_active: schoolForm.is_active,
      })
      setSuccess(`School ${created.name} is aangemaakt.`)
      setSchoolForm({ name: '', slug: '', is_active: true })
      setSchoolOpen(false)
      const schoolsData = await getSchools()
      setSchools(schoolsData)
      setSelectedSchoolId(created.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan school niet aanmaken.'))
    } finally {
      setSchoolSaving(false)
    }
  }

  const handleCreateSchoolYear = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedSchoolId) return
    setYearSaving(true)
    setError('')
    setSuccess('')
    try {
      const created = await createSchoolYear(selectedSchoolId, {
        name: yearForm.name,
        start_date: yearForm.start_date,
        end_date: yearForm.end_date,
        is_active: yearForm.is_active,
      })
      setSuccess(`Schooljaar ${created.name} is aangemaakt.`)
      setYearForm({ name: '', start_date: '', end_date: '', is_active: false })
      setYearOpen(false)
      const years = await getSchoolYears(selectedSchoolId)
      setSchoolYears(years)
      setSelectedSchoolYearId(created.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan schooljaar niet aanmaken.'))
    } finally {
      setYearSaving(false)
    }
  }

  const handleActivateSchoolYear = async (schoolYearId: number) => {
    setError('')
    setSuccess('')
    try {
      const updated = await activateSchoolYear(schoolYearId)
      setSuccess(`Schooljaar ${updated.name} is nu actief.`)
      if (selectedSchoolId) {
        const years = await getSchoolYears(selectedSchoolId)
        setSchoolYears(years)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Kan schooljaar niet activeren.'))
    }
  }

  const handleCreateClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedSchoolYearId) return
    setClassSaving(true)
    setError('')
    setSuccess('')
    try {
      const created = await createClass(selectedSchoolYearId, { name: classForm.name, class_type: classForm.class_type })
      setSuccess(`Klas ${created.name} is toegevoegd.`)
      setClassForm({ name: '', class_type: 'JK' })
      setClassOpen(false)
      const data = await getClasses(selectedSchoolYearId)
      setClasses(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan klas niet toevoegen.'))
    } finally {
      setClassSaving(false)
    }
  }

  const handleOpenTeacherModal = async (classId: number) => {
    setTeacherModalClassId(classId)
    try {
      const teachers = await getClassTeachers(classId)
      setTeachersByClass((current) => ({ ...current, [classId]: teachers }))
    } catch {
      // ignore
    }
  }

  const handleAddTeacher = async (classId: number, teacherId: number) => {
    setError('')
    setSuccess('')
    try {
      const teachers = await addTeacherToClass(classId, teacherId)
      setTeachersByClass((current) => ({ ...current, [classId]: teachers }))
      setSuccess('Leerkracht toegevoegd.')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan leerkracht niet toevoegen.'))
    }
  }

  const handleRemoveTeacher = async (classId: number, teacherId: number) => {
    setError('')
    setSuccess('')
    try {
      const teachers = await removeTeacherFromClass(classId, teacherId)
      setTeachersByClass((current) => ({ ...current, [classId]: teachers }))
      setSuccess('Leerkracht verwijderd.')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan leerkracht niet verwijderen.'))
    }
  }

  const handleDownloadTemplate = async () => {
    if (!selectedSchoolYearId) return
    try {
      const blob = await downloadStudentTemplate(selectedSchoolYearId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'leerlingen_template.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan template niet downloaden.'))
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedSchoolYearId) return

    setPreviewing(true)
    setError('')
    setSuccess('')
    try {
      const result = await previewStudents(selectedSchoolYearId, file)
      setPreviewItems(result.items)
      setShowPreview(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan bestand niet verwerken.'))
    } finally {
      setPreviewing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemovePreviewItem = (index: number) => {
    setPreviewItems((items) => items.filter((_, i) => i !== index))
  }

  const handleConfirmImport = async () => {
    if (!selectedSchoolYearId) return

    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const validItems: StudentConfirmItem[] = previewItems
        .filter((item) => item.is_valid)
        .map((item) => ({ class_name: item.class_name, student_name: item.student_name }))
      const result = await confirmStudentImport(selectedSchoolYearId, validItems)
      if (result.errors.length > 0) {
        setError(`Import voltooid met fouten: ${result.errors.join(', ')}`)
      } else {
        setSuccess(`${result.created} leerlingen toegevoegd.`)
      }
      setShowPreview(false)
      setPreviewItems([])
      // Refresh students after import
      if (selectedSchoolYearId) {
        const data = await getClasses(selectedSchoolYearId)
        setClasses(data)
        const studentsMap: Record<number, StudentResponse[]> = {}
        for (const cls of data) {
          try {
            const students = await getStudents(cls.id)
            studentsMap[cls.id] = students
          } catch {
            studentsMap[cls.id] = []
          }
        }
        setStudentsByClass(studentsMap)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Kan import niet voltooien.'))
    } finally {
      setUploading(false)
    }
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setPreviewItems([])
  }

  const handleStudentImageUpload = async (studentId: number, file: File) => {
    try {
      await uploadStudentImage(studentId, file)
      // Refresh students
      if (selectedSchoolYearId) {
        const data = await getClasses(selectedSchoolYearId)
        setClasses(data)
        const studentsMap: Record<number, StudentResponse[]> = {}
        for (const cls of data) {
          try {
            const students = await getStudents(cls.id)
            studentsMap[cls.id] = students
          } catch {
            studentsMap[cls.id] = []
          }
        }
        setStudentsByClass(studentsMap)
      }
      setSuccess('Afbeelding geüpload.')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan afbeelding niet uploaden.'))
    }
  }

  const handleDeleteStudent = async (studentId: number) => {
    if (!confirm('Weet je zeker dat je deze leerling wilt verwijderen?')) return
    try {
      await deleteStudent(studentId)
      // Refresh students
      if (selectedSchoolYearId) {
        const data = await getClasses(selectedSchoolYearId)
        setClasses(data)
        const studentsMap: Record<number, StudentResponse[]> = {}
        for (const cls of data) {
          try {
            const students = await getStudents(cls.id)
            studentsMap[cls.id] = students
          } catch {
            studentsMap[cls.id] = []
          }
        }
        setStudentsByClass(studentsMap)
      }
      setSuccess('Leerling verwijderd.')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan leerling niet verwijderen.'))
    }
  }

  if (loading) {
    return (
      <div className="center-container">
        <div className="card">
          <p>Laden...</p>
        </div>
      </div>
    )
  }

  const isSuperuser = user?.is_superuser ?? false

  return (
    <div>
      <section className="page-header">
        <div>
          <h1>Schoolbeheer</h1>
          <p className="text-muted">Beheer scholen, schooljaren en klassen.</p>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <section className="management-grid">
        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Scholen</h2>
              <p className="text-muted">Alleen zichtbaar voor superusers.</p>
            </div>
            {isSuperuser && (
              <div className="table-actions">
                <button className="btn btn-primary" type="button" onClick={() => setSchoolOpen((open) => !open)}>
                  {schoolOpen ? 'Formulier sluiten' : 'School aanmaken'}
                </button>
              </div>
            )}
          </div>

          {schoolOpen && isSuperuser && (
            <div className="card form-card">
              <h2>Nieuwe school</h2>
              <form onSubmit={handleCreateSchool}>
                <div className="form-group">
                  <label htmlFor="school-name">Naam</label>
                  <input
                    id="school-name"
                    type="text"
                    value={schoolForm.name}
                    onChange={(event) => setSchoolForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    disabled={schoolSaving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="school-slug">Slug (optioneel)</label>
                  <input
                    id="school-slug"
                    type="text"
                    value={schoolForm.slug}
                    onChange={(event) => setSchoolForm((current) => ({ ...current, slug: event.target.value }))}
                    disabled={schoolSaving}
                  />
                </div>
                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={schoolForm.is_active}
                      onChange={(event) => setSchoolForm((current) => ({ ...current, is_active: event.target.checked }))}
                      disabled={schoolSaving}
                    />
                    Actief
                  </label>
                </div>
                <button className="btn btn-primary" type="submit" disabled={schoolSaving}>
                  {schoolSaving ? 'Opslaan...' : 'School aanmaken'}
                </button>
              </form>
            </div>
          )}

          {schools.length === 0 ? (
            <div className="empty-state">
              <h2>Geen scholen gevonden</h2>
              <p className="text-muted">Maak hierboven een nieuwe school aan.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => (
                    <tr key={school.id} className={selectedSchoolId === school.id ? 'row-selected' : ''}>
                      <td>
                        <strong>{school.name}</strong>
                      </td>
                      <td>{school.slug}</td>
                      <td>
                        <span className={school.is_active ? 'badge badge-active' : 'badge'}>
                          {school.is_active ? 'Actief' : 'Inactief'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => setSelectedSchoolId(school.id)}
                        >
                          {selectedSchoolId === school.id ? 'Geselecteerd' : 'Selecteren'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Schooljaren</h2>
              <p className="text-muted">
                {selectedSchoolId ? `Voor geselecteerde school (${selectedSchoolId})` : 'Selecteer eerst een school.'}
              </p>
            </div>
            <div className="table-actions">
              {canManageYears && selectedSchoolId && (
                <button className="btn btn-primary" type="button" onClick={() => setYearOpen((open) => !open)}>
                  {yearOpen ? 'Formulier sluiten' : 'Schooljaar aanmaken'}
                </button>
              )}
            </div>
          </div>

          {yearOpen && canManageYears && selectedSchoolId && (
            <div className="card form-card">
              <h2>Nieuw schooljaar</h2>
              <form onSubmit={handleCreateSchoolYear}>
                <div className="form-group">
                  <label htmlFor="year-name">Naam</label>
                  <input
                    id="year-name"
                    type="text"
                    value={yearForm.name}
                    onChange={(event) => setYearForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    disabled={yearSaving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="year-start">Startdatum</label>
                  <input
                    id="year-start"
                    type="date"
                    value={yearForm.start_date}
                    onChange={(event) => setYearForm((current) => ({ ...current, start_date: event.target.value }))}
                    required
                    disabled={yearSaving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="year-end">Einddatum</label>
                  <input
                    id="year-end"
                    type="date"
                    value={yearForm.end_date}
                    onChange={(event) => setYearForm((current) => ({ ...current, end_date: event.target.value }))}
                    required
                    disabled={yearSaving}
                  />
                </div>
                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={yearForm.is_active}
                      onChange={(event) => setYearForm((current) => ({ ...current, is_active: event.target.checked }))}
                      disabled={yearSaving}
                    />
                    Actief
                  </label>
                </div>
                <button className="btn btn-primary" type="submit" disabled={yearSaving}>
                  {yearSaving ? 'Opslaan...' : 'Schooljaar aanmaken'}
                </button>
              </form>
            </div>
          )}

          {!selectedSchoolId ? (
            <div className="empty-state">
              <h2>Geen school geselecteerd</h2>
              <p className="text-muted">Selecteer een school om de schooljaren te bekijken.</p>
            </div>
          ) : schoolYears.length === 0 ? (
            <div className="empty-state">
              <h2>Geen schooljaren gevonden</h2>
              <p className="text-muted">Maak hierboven een nieuw schooljaar aan.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Periode</th>
                    <th>Status</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolYears.map((year) => (
                    <tr key={year.id} className={selectedSchoolYearId === year.id ? 'row-selected' : ''}>
                      <td>
                        <strong>{year.name}</strong>
                      </td>
                      <td>
                        {formatDate(year.start_date)} – {formatDate(year.end_date)}
                      </td>
                      <td>
                        <span className={year.is_active ? 'badge badge-active' : 'badge'}>
                          {year.is_active ? 'Actief' : 'Inactief'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => setSelectedSchoolYearId(year.id)}
                        >
                          {selectedSchoolYearId === year.id ? 'Geselecteerd' : 'Selecteren'}
                        </button>
                        {!year.is_active && canManageYears && (
                          <button className="table-action" type="button" onClick={() => handleActivateSchoolYear(year.id)}>
                            Activeren
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Klassen</h2>
              <p className="text-muted">
                {selectedSchoolYearId
                  ? `Voor geselecteerd schooljaar (${selectedSchoolYearId})`
                  : 'Selecteer eerst een schooljaar.'}
              </p>
            </div>
            <div className="table-actions">
               {selectedSchoolYearId && (
                 <>
                   <button className="btn btn-secondary" type="button" onClick={handleDownloadTemplate} disabled={uploading || previewing}>
                     Template downloaden
                   </button>
                   <button className="btn btn-primary" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || previewing}>
                     {previewing ? 'Verwerken...' : 'Leerlingen uploaden'}
                   </button>
                   <button className="btn btn-primary" type="button" onClick={() => setClassOpen((open) => !open)}>
                     {classOpen ? 'Formulier sluiten' : 'Klas toevoegen'}
                   </button>
                 </>
               )}
             </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          {classOpen && selectedSchoolYearId && (
            <div className="card form-card">
              <h2>Nieuwe klas</h2>
              <form onSubmit={handleCreateClass}>
                <div className="form-group">
                  <label htmlFor="class-name">Naam</label>
                  <input
                    id="class-name"
                    type="text"
                    value={classForm.name}
                    onChange={(event) => setClassForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    disabled={classSaving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="class-type">Soort klas</label>
                  <select
                    id="class-type"
                    value={classForm.class_type}
                    onChange={(event) => setClassForm((current) => ({ ...current, class_type: event.target.value }))}
                    disabled={classSaving}
                  >
                    <option value="JK">JK</option>
                    <option value="K2">K2</option>
                    <option value="K3">K3</option>
                  </select>
                </div>
                <button className="btn btn-primary" type="submit" disabled={classSaving}>
                  {classSaving ? 'Opslaan...' : 'Klas toevoegen'}
                </button>
              </form>
            </div>
          )}

          {!selectedSchoolYearId ? (
             <div className="empty-state">
               <h2>Geen schooljaar geselecteerd</h2>
               <p className="text-muted">Selecteer een schooljaar om de klassen te bekijken.</p>
             </div>
           ) : classes.length === 0 ? (
             <div className="empty-state">
               <h2>Geen klassen gevonden</h2>
               <p className="text-muted">Voeg hierboven een nieuwe klas toe of upload leerlingen via Excel.</p>
             </div>
           ) : (
             <div className="table-wrapper">
               <table className="data-table">
                  <thead>
                    <tr>
                      <th>Naam</th>
                      <th>Type</th>
                      <th>Schooljaar</th>
                      <th>Leerlingen</th>
                      <th>Leerkrachten</th>
                    </tr>
                  </thead>
                 <tbody>
                    {classes.map((cls) => {
                      const year = schoolYears.find((y) => y.id === cls.school_year_id)
                      const students = studentsByClass[cls.id] || []
                      const teachers = teachersByClass[cls.id] || []
                      return (
                        <tr key={cls.id}>
                          <td>
                            <strong>{cls.name}</strong>
                          </td>
                          <td>{cls.class_type}</td>
                          <td>{year?.name ?? `Schooljaar ${cls.school_year_id}`}</td>
                          <td>
                             {students.length > 0 ? (
                               <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                                 {students.map((s) => (
                                   <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                     {s.image_path && (
                                       <img
                                         src={s.image_path}
                                         alt={s.name}
                                         style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                       />
                                     )}
                                     <span>{s.name}</span>
                                     <input
                                       type="file"
                                       accept="image/*"
                                       style={{ display: 'none' }}
                                       id={`image-upload-${s.id}`}
                                       onChange={(e) => {
                                         const file = e.target.files?.[0]
                                         if (file) handleStudentImageUpload(s.id, file)
                                       }}
                                     />
                                     <label htmlFor={`image-upload-${s.id}`} className="table-action" style={{ cursor: 'pointer' }}>
                                       📷
                                     </label>
                                     <button
                                       className="table-action"
                                       type="button"
                                       onClick={() => handleDeleteStudent(s.id)}
                                       style={{ color: '#d32f2f' }}
                                     >
                                       ✕
                                     </button>
                                   </li>
                                 ))}
                               </ul>
                             ) : (
                               <span className="text-muted">Geen leerlingen</span>
                             )}
                          </td>
                          <td>
                            {teachers.length > 0 ? (
                              <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                                {teachers.map((t) => (
                                  <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{t.name}</span>
                                    <button
                                      className="table-action"
                                      type="button"
                                      onClick={() => handleRemoveTeacher(cls.id, t.id)}
                                      style={{ color: '#d32f2f' }}
                                    >
                                      ✕
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-muted">Geen leerkrachten</span>
                            )}
                            <button
                              className="btn btn-secondary"
                              type="button"
                              style={{ marginTop: '4px' }}
                              onClick={() => handleOpenTeacherModal(cls.id)}
                            >
                              Leerkracht toevoegen
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      </section>

      {showPreview && (
        <div className="preview-modal">
          <div className="card">
            <div className="table-header">
              <div>
                <h2>Voorbeeld leerlingen import</h2>
                <p className="text-muted">
                  {previewItems.filter((item) => item.is_valid).length} geldige, {previewItems.filter((item) => !item.is_valid).length} ongeldige records
                </p>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rij</th>
                    <th>Klas</th>
                    <th>Leerling</th>
                    <th>Status</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, index) => (
                    <tr key={index}>
                      <td>{item.row_number}</td>
                      <td>{item.class_name}</td>
                      <td>{item.student_name}</td>
                      <td>
                        {item.is_valid ? (
                          <span className="badge badge-active">Geldig</span>
                        ) : (
                          <span className="badge">{item.error}</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => handleRemovePreviewItem(index)}
                        >
                          Verwijderen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="preview-actions">
              <button className="btn btn-secondary" type="button" onClick={handleCancelPreview}>
                Annuleren
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleConfirmImport}
                disabled={uploading || previewItems.filter((item) => item.is_valid).length === 0}
              >
                {uploading ? 'Importeren...' : 'Bevestigen en importeren'}
              </button>
            </div>
          </div>
        </div>
      )}
      {teacherModalClassId !== null && (
        <div className="preview-modal">
          <div className="card">
            <div className="table-header">
              <div>
                <h2>Leerkrachten beheren</h2>
                <p className="text-muted">Kies een leerkracht om toe te voegen aan deze klas.</p>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>E-mail</th>
                    <th>Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers
                    .filter((u) => !u.is_superuser)
                    .map((u) => {
                      const alreadyLinked = (teachersByClass[teacherModalClassId] || []).some((t) => t.id === u.id)
                      return (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.email}</td>
                          <td>
                            {alreadyLinked ? (
                              <span className="badge badge-active">Toegevoegd</span>
                            ) : (
                              <button
                                className="btn btn-primary"
                                type="button"
                                onClick={() => handleAddTeacher(teacherModalClassId, u.id)}
                              >
                                Toevoegen
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            <div className="preview-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setTeacherModalClassId(null)}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
