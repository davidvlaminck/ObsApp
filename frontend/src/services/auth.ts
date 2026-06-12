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
}

export interface SchoolResponse {
  id: number
  name: string
  slug: string
  is_active: boolean
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
