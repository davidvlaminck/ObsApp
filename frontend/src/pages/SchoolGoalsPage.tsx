import { AxiosError } from 'axios'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { FormEvent, useEffect, useState } from 'react'
import {
  createManagedDomain,
  createObservationGoal,
  deleteManagedDomain,
  deleteObservationGoal,
  getManagedDomains,
  getObservationGoalClasses,
  getObservationGoals,
  updateManagedDomain,
  updateObservationGoal,
  ClassOption,
  ObservationGoalResponse,
  SchoolGoalDomainResponse,
} from '../services/observations'

const SCHOOL_GOALS_SUBJECT = 'Schooleigen doelen'

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<{ detail?: string }>
  const status = axiosError.response?.status
  const detail = axiosError.response?.data?.detail

  if (status === 401) {
    return 'Sessie verlopen. Log opnieuw in.'
  }

  if (status === 403) {
    return 'Geen toegang.'
  }

  return detail ?? fallback
}

export default function SchoolGoalsPage() {
  const [goals, setGoals] = useState<ObservationGoalResponse[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [managedDomains, setManagedDomains] = useState<SchoolGoalDomainResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [domainSaving, setDomainSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [newDomainName, setNewDomainName] = useState('')
  const [showNewDomainForm, setShowNewDomainForm] = useState(false)
  const [editingDomainName, setEditingDomainName] = useState('')
  const [editingDomain, setEditingDomain] = useState<SchoolGoalDomainResponse | null>(null)
  const [editingDomainNameVisible, setEditingDomainNameVisible] = useState(false)
  const [showNewGoalForm, setShowNewGoalForm] = useState(false)
  const [modalGoalForm, setModalGoalForm] = useState({ name: '', class_id: null as number | null })
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null)
  const [editingGoalName, setEditingGoalName] = useState('')
  const [editingGoalClassId, setEditingGoalClassId] = useState<number | null>(null)

  const loadGoals = async () => {
    try {
      const data = await getObservationGoals({ subject: SCHOOL_GOALS_SUBJECT })
      setGoals(data)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan schooleigen doelen niet laden.'))
    }
  }

  const loadDomains = async () => {
    try {
      const managedDomainsData = await getManagedDomains()
      setManagedDomains(managedDomainsData)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan domeinen niet laden.'))
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [classesData] = await Promise.all([getObservationGoalClasses()])
        setClasses(classesData)
        await Promise.all([loadDomains(), loadGoals()])
      } catch (err) {
        setError(getErrorMessage(err, 'Kan gegevens niet laden.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleCreateDomain = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = newDomainName.trim()
    if (!trimmed) {
      setError('Geen domeinnaam ingevuld.')
      return
    }

    try {
      setDomainSaving(true)
      setError('')
      setSuccess('')
      const created = await createManagedDomain(trimmed)
      setManagedDomains((current) => [...current, created])
      setNewDomainName('')
      setShowNewDomainForm(false)
      setSuccess(`Domein "${trimmed}" is toegevoegd.`)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan domein niet toevoegen.'))
    } finally {
      setDomainSaving(false)
    }
  }

  const handleCancelNewDomain = () => {
    setShowNewDomainForm(false)
    setNewDomainName('')
    setError('')
  }

  const startEditDomain = (domain: SchoolGoalDomainResponse) => {
    setEditingDomain(domain)
    setEditingDomainName(domain.name)
    setEditingDomainNameVisible(false)
  }

  const cancelEditDomain = () => {
    setEditingDomain(null)
    setEditingDomainName('')
    setEditingDomainNameVisible(false)
    setShowNewGoalForm(false)
    setModalGoalForm({ name: '', class_id: null })
    setEditingGoalId(null)
    setEditingGoalName('')
    setEditingGoalClassId(null)
    setShowNewDomainForm(false)
    setNewDomainName('')
  }

  const saveEditDomain = async (id: number) => {
    const trimmed = editingDomainName.trim()
    if (!trimmed) {
      setError('Geen domeinnaam ingevuld.')
      return
    }

    try {
      setDomainSaving(true)
      setError('')
      setSuccess('')
      const updated = await updateManagedDomain(id, trimmed)
      setManagedDomains((current) => current.map((d) => (d.id === id ? updated : d)))
      setEditingDomain((current) => (current && current.id === id ? updated : current))
      setEditingDomainNameVisible(false)
      setSuccess(`Domein is bijgewerkt.`)
      await loadGoals()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan domein niet bijwerken.'))
    } finally {
      setDomainSaving(false)
    }
  }

  const cancelEditDomainName = () => {
    setEditingDomainNameVisible(false)
    setEditingDomainName(editingDomain?.name ?? '')
    setError('')
  }

  const handleDeleteDomain = async (id: number, name: string) => {
    if (!window.confirm(`Domein "${name}" verwijderen?`)) {
      return
    }

    try {
      setDomainSaving(true)
      setError('')
      setSuccess('')
      await deleteManagedDomain(id)
      setManagedDomains((current) => current.filter((d) => d.id !== id))
      setSuccess(`Domein "${name}" is verwijderd.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan domein niet verwijderen.'))
    } finally {
      setDomainSaving(false)
    }
  }

  const handleDeleteGoal = async (id: number) => {
    if (!window.confirm('Wil je dit schooleigen doel echt verwijderen?')) {
      return
    }

    try {
      setError('')
      setSuccess('')
      await deleteObservationGoal(id)
      setSuccess('Schooleigen doel is verwijderd.')
      await loadGoals()
    } catch (err) {
      setError(getErrorMessage(err, 'Kan schooleigen doel niet verwijderen.'))
    }
  }

  const handleModalGoalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!modalGoalForm.name.trim() || !editingDomain) {
      setError('Naam is verplicht.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await createObservationGoal({
        name: modalGoalForm.name.trim(),
        subject: SCHOOL_GOALS_SUBJECT,
        domain: editingDomain.name,
        subdomain: null,
        goal_id: null,
        class_id: modalGoalForm.class_id ?? undefined,
      })
      setModalGoalForm({ name: '', class_id: null })
      setShowNewGoalForm(false)
      setSuccess('Schooleigen doel is aangemaakt.')
      await loadGoals()
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(err.response?.data?.detail || 'Limiet bereikt.')
      } else {
        setError(getErrorMessage(err, 'Kan schooleigen doel niet aanmaken.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const startEditGoal = (goal: ObservationGoalResponse) => {
    setEditingGoalId(goal.id)
    setEditingGoalName(goal.name)
    setEditingGoalClassId(goal.class_id)
  }

  const cancelEditGoal = () => {
    setEditingGoalId(null)
    setEditingGoalName('')
    setEditingGoalClassId(null)
  }

  const cancelNewGoal = () => {
    setShowNewGoalForm(false)
    setModalGoalForm({ name: '', class_id: null })
    setError('')
  }

  const saveEditGoal = async (id: number) => {
    const trimmed = editingGoalName.trim()
    if (!trimmed) {
      setError('Geen doegnaam ingevuld.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await updateObservationGoal(id, {
        name: trimmed,
        class_id: editingGoalClassId ?? undefined,
      })
      cancelEditGoal()
      setSuccess('Schooleigen doel is bijgewerkt.')
      await loadGoals()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan schooleigen doel niet bijwerken.'))
    } finally {
      setSaving(false)
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

  return (
    <div>
      <section className="page-header">
        <div>
          <h1>Schooleigen doelen</h1>
          <p className="text-muted">Beheer je eigen schooldoelen naast de officiële doelen.</p>
        </div>
      </section>

      {error && <div className="inline-message inline-message-error">{error}</div>}
      {success && <div className="inline-message inline-message-success">{success}</div>}

      <div className="management-grid">
        <section className="form-card card">
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <h2>Domeinen beheren</h2>
                <p className="text-muted">Beheer de domeinen die je bij schooleigen doelen kunt gebruiken.</p>
              </div>
             <button
               className="btn btn-outline"
               type="button"
               onClick={() => setShowNewDomainForm(true)}
               disabled={domainSaving}
             >
               <AddIcon fontSize="small" aria-hidden="true" style={{ marginRight: 8 }} />
               Nieuw domein
             </button>
           </div>
 
           <div style={{ marginBottom: 16 }}>
            {managedDomains.length === 0 ? (
              <div className="empty-state compact">
                <h3>Geen domeinen</h3>
                <p className="text-muted">Klik op de knop hieronder om je eerste domein toe te voegen.</p>
              </div>
            ) : (
              <div className="user-list">
                {managedDomains.map((domain) => (
                  <div key={domain.id} className="user-item">
                    <div>
                      <strong>{domain.name}</strong>
                    </div>
                    <div className="domain-actions">
                      <button
                        className="table-action edit-icon-button"
                        type="button"
                        onClick={() => startEditDomain(domain)}
                        aria-label={`Bewerk ${domain.name}`}
                        title="Bewerken"
                        disabled={domainSaving}
                      >
                        <EditIcon fontSize="small" aria-hidden="true" />
                      </button>
                      <button
                        className="table-action danger-link delete-icon-button"
                        type="button"
                        onClick={() => handleDeleteDomain(domain.id, domain.name)}
                        aria-label={`Verwijder ${domain.name}`}
                        title="Verwijderen"
                        disabled={domainSaving}
                      >
                        <DeleteIcon fontSize="small" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
       </div>

       {showNewDomainForm && (
         <div className="modal-backdrop" onClick={() => handleCancelNewDomain()}>
           <div className="modal-card" onClick={(e) => e.stopPropagation()}>
             <div className="modal-header">
                <div>
                  <h2>Nieuw domein</h2>
                  <p>Voer de naam van het nieuwe domein in.</p>
                </div>
              </div>

             <section className="form-card card" style={{ marginBottom: 24 }}>
               <form onSubmit={handleCreateDomain}>
                 <div className="form-group">
                   <label htmlFor="new-domain-name">Naam</label>
                   <input
                     id="new-domain-name"
                     value={newDomainName}
                     onChange={(event) => setNewDomainName(event.target.value)}
                     placeholder="Bijv. Sociale vaardigheden"
                     autoFocus
                     disabled={domainSaving}
                   />
                 </div>
                 <div className="modal-actions">
                   <button
                     className="btn btn-primary btn-sm"
                     type="submit"
                     disabled={domainSaving}
                   >
                     {domainSaving ? 'Opslaan...' : 'Opslaan'}
                   </button>
                   <button
                     className="btn btn-sm btn-secondary"
                     type="button"
                     onClick={handleCancelNewDomain}
                     disabled={domainSaving}
                   >
                     Annuleren
                   </button>
                 </div>
               </form>
             </section>
           </div>
         </div>
       )}
 
        {editingDomain && (
          <div className="modal-backdrop" onClick={() => cancelEditDomain()}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Domein {editingDomain.name}</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    onClick={() => setEditingDomainNameVisible(true)}
                    disabled={domainSaving}
                    aria-label="Bewerk domeinnaam"
                    title="Naam bewerken"
                  >
                    <EditIcon fontSize="small" aria-hidden="true" />
                  </button>
                  <button className="btn btn-sm btn-secondary" type="button" onClick={() => cancelEditDomain()}>
                    Sluiten
                  </button>
                </div>
              </div>

              {editingDomainNameVisible && (
                <section className="form-card card" style={{ marginBottom: 24 }}>
                  <h3>Domeinnaam aanpassen</h3>
                  <div className="form-group">
                    <label htmlFor="edit-domain-name">Naam</label>
                    <input
                      id="edit-domain-name"
                      type="text"
                      value={editingDomainName}
                      onChange={(e) => setEditingDomainName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          saveEditDomain(editingDomain.id)
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          cancelEditDomainName()
                        }
                      }}
                      autoFocus
                      disabled={domainSaving}
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={() => saveEditDomain(editingDomain.id)}
                      disabled={domainSaving}
                    >
                      {domainSaving ? 'Opslaan...' : 'Opslaan'}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      type="button"
                      onClick={cancelEditDomainName}
                      disabled={domainSaving}
                    >
                      Annuleren
                    </button>
                  </div>
                </section>
              )}

              <section className="form-card card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <h3>Doelen beheren</h3>
                    <p className="text-muted">Maak, pas aan of verwijder doelen voor dit domein.</p>
                  </div>
                  {!showNewGoalForm && (
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => setShowNewGoalForm(true)}
                      disabled={saving}
                    >
                      <AddIcon fontSize="small" aria-hidden="true" style={{ marginRight: 8 }} />
                      Doel aanmaken
                    </button>
                  )}
                </div>

                {showNewGoalForm && (
                  <form onSubmit={handleModalGoalSubmit}>
                    <div className="form-group">
                      <label htmlFor="modal-goal-name">Nieuw doel</label>
                      <input
                        id="modal-goal-name"
                        value={modalGoalForm.name}
                        onChange={(e) => setModalGoalForm((current) => ({ ...current, name: e.target.value }))}
                        placeholder="Bijvoorbeeld: Teamwerk"
                        required
                        disabled={saving}
                        autoFocus
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="modal-goal-class">Klas (optioneel)</label>
                      <select
                        id="modal-goal-class"
                        value={modalGoalForm.class_id ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          setModalGoalForm((current) => ({
                            ...current,
                            class_id: value ? Number(value) : null,
                          }))
                        }}
                        disabled={saving}
                      >
                        <option value="">Alle klassen</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} ({cls.class_type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="modal-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        type="submit"
                        disabled={saving}
                      >
                        {saving ? 'Opslaan...' : 'Opslaan'}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        type="button"
                        onClick={cancelNewGoal}
                        disabled={saving}
                      >
                        Annuleren
                      </button>
                    </div>
                  </form>
                )}

                <div style={{ marginTop: 24 }}>
                 {goals
                   .filter((goal) => goal.domain === editingDomain.name)
                   .length === 0 ? (
                   <div className="empty-state compact">
                     <p className="text-muted">Nog geen doelen voor dit domein.</p>
                   </div>
                 ) : (
                   <div className="table-wrapper">
                     <table className="data-table">
                       <thead>
                         <tr>
                           <th>Naam</th>
                           <th>Klas</th>
                           <th>Acties</th>
                         </tr>
                       </thead>
                       <tbody>
                         {goals
                           .filter((goal) => goal.domain === editingDomain.name)
                           .map((goal) => {
                             const cls = classes.find((c) => c.id === goal.class_id)
                             return (
                               <tr key={goal.id}>
                                 <td>
                                {editingGoalId === goal.id ? (
                                     <input
                                       type="text"
                                       value={editingGoalName}
                                       onChange={(e) => setEditingGoalName(e.target.value)}
                                       onKeyDown={(e) => {
                                         if (e.key === 'Enter') {
                                           e.preventDefault()
                                           saveEditGoal(goal.id)
                                         }
                                         if (e.key === 'Escape') {
                                           e.preventDefault()
                                           cancelEditGoal()
                                         }
                                       }}
                                       autoFocus
                                       disabled={saving}
                                       style={{ fontSize: 14, padding: '4px 8px', width: '100%' }}
                                     />
                                   ) : (
                                     <strong>{goal.name}</strong>
                                   )}
                                 </td>
                                 <td>{cls ? `${cls.name} (${cls.class_type})` : 'Alle klassen'}</td>
                                 <td>
{editingGoalId === goal.id ? (
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                          className="btn btn-sm btn-primary"
                                          type="button"
                                          onClick={() => saveEditGoal(goal.id)}
                                          disabled={saving}
                                        >
                                          Opslaan
                                        </button>
                                        <button
                                          className="btn btn-sm btn-secondary"
                                          type="button"
                                          onClick={cancelEditGoal}
                                          disabled={saving}
                                        >
                                          Annuleren
                                        </button>
                                      </div>
                                    ) : (
                                     <>
                                       <button
                                         className="table-action edit-icon-button"
                                         type="button"
                                         onClick={() => startEditGoal(goal)}
                                         aria-label={`Bewerk ${goal.name}`}
                                         title="Bewerken"
                                         disabled={saving}
                                       >
                                         <EditIcon fontSize="small" aria-hidden="true" />
                                       </button>
                                       <button
                                         className="table-action danger-link delete-icon-button"
                                         type="button"
                                         onClick={() => handleDeleteGoal(goal.id)}
                                         aria-label={`Verwijder ${goal.name}`}
                                         title="Verwijderen"
                                         disabled={saving}
                                       >
                                         <DeleteIcon fontSize="small" aria-hidden="true" />
                                       </button>
                                     </>
                                   )}
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
           </div>
         </div>
       )}
     </div>
   )
 }
