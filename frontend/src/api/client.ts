import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8083',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    if (data?.message) return data.message
    if (error.code === 'ECONNABORTED') return 'The backend did not respond in time.'
    if (!error.response) return 'Backend is unreachable. Check that KernelX is running and the API URL is correct.'
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}
