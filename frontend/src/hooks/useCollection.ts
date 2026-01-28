import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionService } from '../services/collection';
import toast from 'react-hot-toast';

export const useCollection = (page = 1, limit = 20, search?: string) => {
  return useQuery({
    queryKey: ['collection', page, limit, search],
    queryFn: () => collectionService.getCollection(page, limit, search),
  });
};

export const useCollectionStats = () => {
  return useQuery({
    queryKey: ['collection-stats'],
    queryFn: () => collectionService.getCollectionStats(),
  });
};

export const useAddCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, quantity, isFoil = false }: { cardId: string; quantity: number; isFoil?: boolean }) =>
      collectionService.addCard(cardId, quantity, isFoil),
    onSuccess: () => {
      toast.success('Carte ajoutée à votre collection !');
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
  // Refresh any deck ownership overlays
  queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'deck-owned' });
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout de la carte");
    },
  });
};

export const useUpdateCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Accept explicit quantities to align with API
    mutationFn: ({ cardId, quantity, quantityFoil }: { cardId: string; quantity?: number; quantityFoil?: number }) =>
      collectionService.updateCard(cardId, quantity as number, quantityFoil),
    onSuccess: () => {
      toast.success('Carte mise à jour !');
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
  queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'deck-owned' });
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });
};

export const useRemoveCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cardId: string) => collectionService.removeCard(cardId),
    onSuccess: () => {
      toast.success('Carte supprimée de votre collection');
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
  queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'deck-owned' });
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    },
  });
};
