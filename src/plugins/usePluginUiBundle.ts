import { useQuery } from '@tanstack/react-query'
import { pluginsApi } from '@/services/pluginsApi'
import type { PluginUiContribution } from './types'

export function usePluginUiBundle(enabled = true) {
  return useQuery({
    queryKey: ['plugins', 'ui-bundle'],
    queryFn: () => pluginsApi.uiBundle(),
    enabled,
    staleTime: 15_000,
  })
}

export function useSlotContributions(slot: string): PluginUiContribution[] {
  const q = usePluginUiBundle()
  return (q.data?.contributions ?? []).filter((c) => c.slot === slot)
}
