import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { CatalogCategory, CleaningZone, StockLocation, WriteoffReason } from '../types'

// Пункт чек-листа ссылается на зону точки (P4.2): названия берутся из
// настроек зала, а не из глобальной константы.
export interface CleaningChecklistItem {
  id: string
  zoneId: string
  done: boolean
  zone: { id: string; name: string }
}
export interface CleaningChecklist {
  id: string
  date: string
  responsibleName: string
  items: CleaningChecklistItem[]
}

export function useCleaningChecklists() {
  return useQuery({ queryKey: ['cleaning-checklists'], queryFn: () => api.get<CleaningChecklist[]>('/cleaning-checklists') })
}

export function useCreateCleaningChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { date: string; responsibleName: string }) => api.post<CleaningChecklist>('/cleaning-checklists', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleaning-checklists'] }),
  })
}

export function useToggleCleaningItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { checklistId: string; zoneId: string }) => api.post(`/cleaning-checklists/${vars.checklistId}/toggle/${vars.zoneId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleaning-checklists'] }),
  })
}

// Зоны уборки точки (P4.2): читает любая роль, настраивает CEO.
export function useCleaningZones() {
  return useQuery({ queryKey: ['cleaning-zones'], queryFn: () => api.get<CleaningZone[]>('/cleaning-zones') })
}

export function useCreateCleaningZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { name: string }) => api.post<CleaningZone>('/cleaning-zones', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleaning-zones'] }),
  })
}

export function useUpdateCleaningZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; name?: string; position?: number }) => api.patch<CleaningZone>(`/cleaning-zones/${vars.id}`, vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleaning-zones'] }),
  })
}

export function useDeleteCleaningZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cleaning-zones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleaning-zones'] }),
  })
}

export interface EquipmentItem {
  id: string
  name: string
  category: string
  zone: string
  responsibleName: string
  lastServiceDate: string
  nextServiceDate: string
  intervalDays: number
  warrantyUntil: string | null
}

export function useEquipment() {
  return useQuery({ queryKey: ['equipment'], queryFn: () => api.get<EquipmentItem[]>('/equipment') })
}

export function useCreateEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { name: string; category: string; zone: string; responsibleName: string; lastServiceDate: string; intervalDays: number; warrantyUntil?: string }) =>
      api.post<EquipmentItem>('/equipment', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export function useCompleteEquipmentService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; responsibleName: string; serviceDate?: string }) =>
      api.post<EquipmentItem>(`/equipment/${vars.id}/complete-service`, { responsibleName: vars.responsibleName, serviceDate: vars.serviceDate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export interface StockBatchView {
  id: string
  location: StockLocation
  quantity: number
  receivedAt: string
  expiresAt: string
  daysLeft: number
  expiringSoon: boolean
}
export interface StockItemSummary {
  catalogItemId: string
  name: string
  category: CatalogCategory
  emoji: string
  shelfQty: number
  warehouseQty: number
  batches: StockBatchView[]
}

export function useStockSummary() {
  return useQuery({ queryKey: ['stock', 'summary'], queryFn: () => api.get<StockItemSummary[]>('/stock/summary') })
}

export function useStockCatalog() {
  return useQuery({ queryKey: ['stock', 'catalog'], queryFn: () => api.get<{ id: string; name: string; category: CatalogCategory; price: number; emoji: string }[]>('/stock/catalog') })
}

export interface StockHistory {
  writeoffs: { id: string; date: string; quantity: number; location: StockLocation; reason: WriteoffReason; comment: string | null; catalogItem: { name: string } }[]
  receipts: { id: string; date: string; quantity: number; location: StockLocation; catalogItem: { name: string } }[]
  inventoryCounts: { id: string; date: string; entries: { catalogItemId: string; countedQty: number; systemQty: number }[] }[]
}

export function useStockHistory() {
  return useQuery({ queryKey: ['stock', 'history'], queryFn: () => api.get<StockHistory>('/stock/history') })
}

function useInvalidateStock() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['stock'] })
  }
}

export function useCreateCatalogItem() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (dto: { name: string; category: CatalogCategory; price: number; emoji: string }) => api.post('/stock/catalog', dto),
    onSuccess: invalidate,
  })
}

export function useReceiveStock() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (dto: { catalogItemId: string; location: StockLocation; quantity: number; expiresAt: string }) => api.post('/stock/receive', dto),
    onSuccess: invalidate,
  })
}

export function useWriteOffStock() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (dto: { catalogItemId: string; location: StockLocation; quantity: number; reason: WriteoffReason; comment?: string }) => api.post('/stock/write-off', dto),
    onSuccess: invalidate,
  })
}

export function useFinalizeInventory() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (entries: { catalogItemId: string; location: StockLocation; countedQty: number }[]) => api.post('/stock/inventory', { entries }),
    onSuccess: invalidate,
  })
}
