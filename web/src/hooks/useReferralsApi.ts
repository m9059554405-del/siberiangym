import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ReferralMe } from '../types'

// Реферальная программа «приведи друга» (P4.4) — клиентская часть:
// свой код, бонусы и активация чужого кода.

export function useMyReferrals() {
  return useQuery({ queryKey: ['referrals', 'me'], queryFn: () => api.get<ReferralMe>('/referrals/me') })
}

export function useApplyReferralCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.post('/referrals/apply', { code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', 'me'] })
      qc.invalidateQueries({ queryKey: ['promo-codes'] })
    },
  })
}
