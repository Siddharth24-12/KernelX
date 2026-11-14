import { api } from './client'
import type { ProcessTreeNode } from '../types/api'
export const processTreeApi = { get: async () => (await api.get<ProcessTreeNode[]>('/api/processes/tree')).data }
