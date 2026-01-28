import { useQuery } from '@tanstack/react-query';
import { collectionService } from '../services/collection';

export const ADV_COLLECTION_FILTERS_ENABLED = false; // feature flag (toggle to true to enable)

export type CollectionFilters = Parameters<typeof collectionService.getCollection>[3];

export function useCollectionFiltered(
  opts: {
    page?: number;
    limit?: number;
    search?: string;
    filters?: CollectionFilters;
    enabled?: boolean;
  } = {}
) {
  const { page = 1, limit = 20, search, filters, enabled = ADV_COLLECTION_FILTERS_ENABLED } = opts;
  return useQuery({
    queryKey: ['collection-adv', page, limit, search, filters ? JSON.stringify(filters) : ''],
    queryFn: () => collectionService.getCollection(page, limit, search, filters),
    enabled,
    // React Query v5: replace deprecated keepPreviousData with placeholderData
    placeholderData: (prev) => prev as any,
  });
}
