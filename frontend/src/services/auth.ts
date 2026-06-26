import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  needs_koepel_selection: boolean
}

export interface SchoolResponse {
  id: number
  name: string
  slug: string
  is_active: boolean
  created_at: string | null
}

export interface SchoolYearResponse {
  id: number
  school_id: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string | null
}

export interface ClassResponse {
  id: number
  school_year_id: number
  name: string
  class_type: string
  created_at: string | null
}

export interface UserCreate {
  email: string
  password?: string
  name: string
  is_active?: boolean
  is_superuser?: boolean
  school_id?: number | null
}

export interface UserResponse {
  id: number
  email: string
  name: string
  is_active: boolean
  is_superuser: boolean
  is_pending: boolean
  school_id: number | null
  is_demo: boolean
  demo_school_id: number | null
  demo_expires_at: string | null
  needs_koepel_selection: boolean
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/auth/login', data)
  return response.data
}

export async function getMe(): Promise<UserResponse> {
  const response = await api.get<UserResponse>('/auth/me')
  return response.data
}

export async function getSchools(): Promise<SchoolResponse[]> {
  const response = await api.get<SchoolResponse[]>('/schools')
  return response.data
}

export async function createSchool(data: { name: string; slug?: string; is_active?: boolean }): Promise<SchoolResponse> {
  const response = await api.post<SchoolResponse>('/schools', data)
  return response.data
}

export async function getSchoolYears(schoolId: number): Promise<SchoolYearResponse[]> {
  const response = await api.get<SchoolYearResponse[]>(`/schools/${schoolId}/school-years`)
  return response.data
}

export async function createSchoolYear(schoolId: number, data: { name: string; start_date: string; end_date: string; is_active?: boolean }): Promise<SchoolYearResponse> {
  const response = await api.post<SchoolYearResponse>(`/schools/${schoolId}/school-years`, data)
  return response.data
}

export async function activateSchoolYear(schoolYearId: number): Promise<SchoolYearResponse> {
  const response = await api.post<SchoolYearResponse>(`/schools/school-years/${schoolYearId}/activate`)
  return response.data
}

export async function getClasses(schoolYearId: number): Promise<ClassResponse[]> {
  const response = await api.get<ClassResponse[]>(`/schools/school-years/${schoolYearId}/classes`)
  return response.data
}

export async function createClass(schoolYearId: number, data: { name: string; class_type: string }): Promise<ClassResponse> {
  const response = await api.post<ClassResponse>(`/schools/school-years/${schoolYearId}/classes`, data)
  return response.data
}

export async function getClassTeachers(classId: number): Promise<UserResponse[]> {
  const response = await api.get<UserResponse[]>(`/schools/classes/${classId}/teachers`)
  return response.data
}

export async function addTeacherToClass(classId: number, teacherId: number): Promise<UserResponse[]> {
  const response = await api.post<UserResponse[]>(`/schools/classes/${classId}/teachers`, { teacher_id: teacherId })
  return response.data
}

export async function removeTeacherFromClass(classId: number, teacherId: number): Promise<UserResponse[]> {
  const response = await api.delete<UserResponse[]>(`/schools/classes/${classId}/teachers/${teacherId}`)
  return response.data
}

export interface StudentResponse {
  id: number
  class_id: number
  name: string
  image_path: string | null
  created_at: string | null
}

export async function getStudents(classId: number): Promise<StudentResponse[]> {
  const response = await api.get<StudentResponse[]>(`/schools/classes/${classId}/students`)
  return response.data
}

export async function uploadStudentImage(
  studentId: number,
  file: File,
): Promise<StudentResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<StudentResponse>(
    `/schools/students/${studentId}/image`,
    formData,
  )
  return response.data
}

export async function deleteStudent(studentId: number): Promise<StudentResponse> {
  const response = await api.delete<StudentResponse>(`/schools/students/${studentId}`)
  return response.data
}

export interface StudentPreviewItem {
  class_name: string
  student_name: string
  row_number: number
  is_valid: boolean
  error: string | null
}

export interface StudentPreviewResult {
  items: StudentPreviewItem[]
  valid_count: number
  invalid_count: number
}

export interface StudentConfirmItem {
  class_name: string
  student_name: string
}

export interface StudentBulkUploadResult {
  total: number
  created: number
  errors: string[]
}

export async function downloadStudentTemplate(schoolYearId: number): Promise<Blob> {
  const response = await api.get(`/schools/school-years/${schoolYearId}/classes/template`, {
    responseType: 'blob',
  })
  return response.data
}

export async function previewStudents(
  schoolYearId: number,
  file: File,
): Promise<StudentPreviewResult> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<StudentPreviewResult>(
    `/schools/school-years/${schoolYearId}/students/preview`,
    formData,
  )
  return response.data
}

export async function confirmStudentImport(
  schoolYearId: number,
  items: { class_name: string; student_name: string }[],
): Promise<StudentBulkUploadResult> {
  const response = await api.post<StudentBulkUploadResult>(
    `/schools/school-years/${schoolYearId}/students/confirm`,
    { items },
  )
  return response.data
}

export async function uploadStudents(
  schoolYearId: number,
  file: File,
): Promise<StudentBulkUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<StudentBulkUploadResult>(
    `/schools/school-years/${schoolYearId}/students/bulk`,
    formData,
  )
  return response.data
}

export async function getUsers(): Promise<UserResponse[]> {
  const response = await api.get<UserResponse[]>('/users')
  return response.data
}
export async function createUser(data: UserCreate): Promise<UserResponse> {
  const response = await api.post<UserResponse>('/users', data)
  return response.data
}

export interface SetPasswordRequest {
  token: string
  password: string
}

export async function setPassword(data: SetPasswordRequest): Promise<UserResponse> {
  const response = await api.post<UserResponse>('/auth/set-password', data)
  return response.data
}

export interface VlaanderenSchool {
  id: string
  name: string
  slug: string
  is_active: boolean
}

export interface DemoRegisterRequest {
  email: string
  name: string
}

export interface RegularRegisterRequest {
  email: string
  name: string
  school_id?: number | null
  school_name?: string | null
}

export async function getVlaanderenSchools(): Promise<VlaanderenSchool[]> {
  const response = await api.get<VlaanderenSchool[]>('/register/schools')
  return response.data
}

export async function registerDemo(data: DemoRegisterRequest): Promise<UserResponse> {
  const response = await api.post<UserResponse>('/register/demo', data)
  return response.data
}

export async function registerRegular(data: RegularRegisterRequest): Promise<UserResponse> {
  const response = await api.post<UserResponse>('/register/regular', data)
  return response.data
}

export interface KoepelResponse {
  id: number
  name: string
  slug: string
  is_active: boolean
}

export async function getKoepels(): Promise<KoepelResponse[]> {
  const response = await api.get<KoepelResponse[]>('/auth/koepels')
  return response.data
}

export async function selectKoepel(koepel: string): Promise<UserResponse> {
  const response = await api.post<UserResponse>('/auth/select-koepel', { koepel })
  return response.data
}

export async function resetDemo(): Promise<UserResponse> {
  const response = await api.post<UserResponse>('/auth/reset-demo')
  return response.data
}

export async function getMySchool(): Promise<SchoolResponse | null> {
  const response = await api.get<SchoolResponse | null>('/auth/my-school')
  return response.data
}


export function setToken(token: string) {
  localStorage.setItem('access_token', token)
}

export function getToken(): string | null {
  return localStorage.getItem('access_token')
}

export function clearToken() {
  localStorage.removeItem('access_token')
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
