import { api } from './client'
import type { SavedConfiguration, SavedSimulation, SchedulerPreferences } from '../types/api'
export const archiveApi = {
  simulations: async () => (await api.get<SavedSimulation[]>('/api/simulations')).data,
  simulation: async (id: string) => (await api.get<SavedSimulation>(`/api/simulations/${encodeURIComponent(id)}`)).data,
  saveSimulation: async (name: string) => (await api.post<SavedSimulation>('/api/simulations/save', { name })).data,
  deleteSimulation: async (id: string) => api.delete(`/api/simulations/${encodeURIComponent(id)}`),
  configurations: async () => (await api.get<SavedConfiguration[]>('/api/configurations')).data,
  configuration: async (id: string) => (await api.get<SavedConfiguration>(`/api/configurations/${encodeURIComponent(id)}`)).data,
  saveConfiguration: async (config: SchedulerPreferences & { name: string }) => (await api.post<SavedConfiguration>('/api/configurations', config)).data,
  deleteConfiguration: async (id: string) => api.delete(`/api/configurations/${encodeURIComponent(id)}`),
}
