import { useQuery } from '@tanstack/react-query';
import { rulesService } from '../services/rules';

export function useRules(enabled: boolean = true) {
  return useQuery({
    queryKey: ['rules'],
    queryFn: () => rulesService.getRules(),
    enabled,
    staleTime: 1000 * 60 * 60, // 1h
  });
}
