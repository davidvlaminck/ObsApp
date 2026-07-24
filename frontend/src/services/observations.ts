import axios from 'axios'
import { getToken } from './auth'
import type { ClassResponse, StudentResponse, UserResponse } from './auth'

export interface ClassOption {
  id: number
  name: string
  class_type: string
}

const api = axios.create({
  baseURL: '/api',
})

export interface GoalResponse {
  id: number
  code: string
  title: string
  description: string | null
  subject: string
  level: string | null
  domain: string | null
  subdomain: string | null
  cluster: string | null
  goal_type: string
  doel_soort: string | null
  target_type: string | null
  parent_goal_id: number | null
  vo_code: string | null
  vocabulary: string | null
  valid_from: string | null
  created_at: string | null
}

export interface GoalSummary {
  id: number
  code: string
  title: string
  description: string | null
  subject: string
  level: string | null
  domain: string | null
  subdomain: string | null
  cluster: string | null
  goal_type: string
  doel_soort: string | null
  vo_code: string | null
}

export interface ObservationGoalResponse {
  id: number
  school_id: number
  created_by: number
  name: string
  subject: string
  domain: string
  subdomain: string | null
  goal_id: number | null
  class_id: number | null
  goal: GoalSummary | null
  created_at: string | null
  updated_at: string | null
}

export interface ObservationGoalCreate {
  name: string
  subject: string
  domain: string
  subdomain?: string | null
  goal_id?: number | null
  class_id?: number | null
}

export interface GoalSearchFilters {
  subject?: string
  domain?: string
  subdomain?: string
  level?: string
  q?: string
  class_id?: number
}

export async function getObservationGoals(filters?: GoalSearchFilters): Promise<ObservationGoalResponse[]> {
  const response = await api.get<ObservationGoalResponse[]>('/observation-goals', { params: filters })
  return response.data
}

export async function getObservationGoalSubjects(): Promise<string[]> {
  const response = await api.get<string[]>('/observation-goals/subjects')
  return response.data
}

export async function getObservationGoalClasses(): Promise<ClassOption[]> {
  const response = await api.get<ClassOption[]>('/observation-goals/classes')
  return response.data
}

export async function getObservationGoalDomains(subject?: string): Promise<string[]> {
  const response = await api.get<string[]>('/observation-goals/domains', { params: { subject } })
  return response.data
}

export interface SchoolGoalDomainResponse {
  id: number
  school_id: number
  name: string
  created_at: string | null
}

export async function getManagedDomains(): Promise<SchoolGoalDomainResponse[]> {
  const response = await api.get<SchoolGoalDomainResponse[]>('/observation-goals/managed-domains')
  return response.data
}

export async function createManagedDomain(name: string): Promise<SchoolGoalDomainResponse> {
  const response = await api.post<SchoolGoalDomainResponse>('/observation-goals/managed-domains', { name })
  return response.data
}

export async function updateManagedDomain(id: number, name: string): Promise<SchoolGoalDomainResponse> {
  const response = await api.put<SchoolGoalDomainResponse>(`/observation-goals/managed-domains/${id}`, { name })
  return response.data
}

export async function deleteManagedDomain(id: number): Promise<void> {
  await api.delete(`/observation-goals/managed-domains/${id}`)
}

export async function getObservationGoalSubdomains(subject?: string, domain?: string): Promise<string[]> {
  const response = await api.get<string[]>('/observation-goals/subdomains', { params: { subject, domain } })
  return response.data
}

export async function createObservationGoal(data: ObservationGoalCreate): Promise<ObservationGoalResponse> {
  const response = await api.post<ObservationGoalResponse>('/observation-goals', data)
  return response.data
}

export async function deleteObservationGoal(id: number): Promise<void> {
  await api.delete(`/observation-goals/${id}`)
}

export async function updateObservationGoal(id: number, data: Partial<ObservationGoalCreate>): Promise<ObservationGoalResponse> {
  const response = await api.put<ObservationGoalResponse>(`/observation-goals/${id}`, data)
  return response.data
}

export async function searchOpStapGoals(filters: GoalSearchFilters): Promise<GoalResponse[]> {
  const response = await api.get<GoalResponse[]>('/observation-goals/goals/search', { params: filters })
  return response.data
}

export type ObservationStatus = 'onvoldoende' | 'in_ontwikkeling' | 'voldoende' | 'voorsprong' | 'geen_observatie'

export interface StudentObservationStatusResponse {
  id: number
  observation_goal_id: number
  student_id: number
  status: ObservationStatus
  observation_date: string
  comment: string | null
}

export interface ObservationContextResponse {
  goals: ObservationGoalResponse[]
  students: StudentResponse[]
  student_observations: Record<number, StudentObservationStatusResponse>
  class_info: ClassResponse | null
}

export interface OverviewResponse {
  goals: ObservationGoalResponse[]
  students: StudentResponse[]
  student_observations: Record<number, StudentObservationStatusResponse>
}

export interface StudentObservationCreate {
  observation_goal_id: number
  student_id: number
  status: ObservationStatus
  observation_date: string
  comment?: string | null
}

export interface StudentObservationResponse extends StudentObservationCreate {
  id: number
  school_id: number
  observed_by: number
  created_at: string | null
  updated_at: string | null
  observation_goal: ObservationGoalResponse | null
  observer: UserResponse | null
}

export interface ObservationContextFilters {
  class_id?: number
  subject?: string
  domain?: string
  selected_goal_id?: number | null
}

export async function getObservationContext(filters?: ObservationContextFilters): Promise<ObservationContextResponse> {
  const response = await api.get<ObservationContextResponse>('/observation-goals/observe/context', { params: filters })
  return response.data
}

export async function getOverview(classId: number, subject?: string, domain?: string): Promise<OverviewResponse> {
  const response = await api.get<OverviewResponse>('/observation-goals/overview', { params: { class_id: classId, subject, domain } })
  return response.data
}

export async function listStudentObservations(): Promise<StudentObservationResponse[]> {
  const response = await api.get<StudentObservationResponse[]>('/student-observations')
  return response.data
}

export async function createStudentObservation(data: StudentObservationCreate): Promise<StudentObservationResponse> {
  const response = await api.post<StudentObservationResponse>('/student-observations', data)
  return response.data
}

export async function deleteStudentObservation(studentObservationId: number): Promise<void> {
  await api.delete(`/student-observations/${studentObservationId}`)
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
