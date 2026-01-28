import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionService } from '../services/collection';
import type { UserListItem } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const ListsPage = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => collectionService.getListItems()
  });

  const items = (data || []) as UserListItem[];
  const wishlist = items.filter(i => i.type === 'WISHLIST');
  const trade = items.filter(i => i.type === 'TRADE');

  const removeMutation = useMutation({
    mutationFn: (id: string) => collectionService.deleteListItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      toast.success('Élément supprimé');
    },
    onError: () => toast.error('Suppression échouée')
  });

  if (isLoading) return <div className="py-10 flex justify-center"><LoadingSpinner/></div>;

  const renderSection = (title: string, arr: UserListItem[]) => (
    <div className="card p-4">
      <h2 className="text-xl font-semibold text-white mb-4">{title} ({arr.length})</h2>
      {arr.length === 0 ? (
        <div className="text-gray-400">Aucun élément</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {arr.map(item => (
            <div key={item.id} className="bg-gray-800 border border-gray-700 rounded p-3 flex items-center gap-3">
              <img src={(typeof item.card.imageUris === 'string' ? JSON.parse(item.card.imageUris || '{}') : item.card.imageUris || {}).small || ''} alt="" className="w-12 h-16 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{item.card.nameFr || item.card.name}</div>
                <div className="text-gray-400 text-sm">{item.card.set?.code?.toUpperCase()} #{item.card.collectorNumber}</div>
                <div className="text-gray-400 text-xs">Qté: {item.quantity}{item.notes ? ` • ${item.notes}` : ''}</div>
              </div>
              <button onClick={() => removeMutation.mutate(item.id)} className="btn-outline text-xs">Retirer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Wishlist & Trade</h1>
        <p className="text-gray-400">Gérez vos listes d'envies et d'échange</p>
      </div>
      {renderSection('Wishlist', wishlist)}
      {renderSection('Trade list', trade)}
    </div>
  );
};

export default ListsPage;