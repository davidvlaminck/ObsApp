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

export interface UserResponse {
  id: number
  email: string
  name: string
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/auth/login', data)
  return response.data
}

export async function getMe(): Promise<UserResponse> {
  const response = await api.get<UserResponse>('/auth/me')
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
