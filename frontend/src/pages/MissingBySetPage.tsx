import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Search, Plus } from 'lucide-react';
import { collectionService } from '../services/collection';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import CardDisplay from '../components/CardDisplay';
import type { ListType } from '../types';

const MissingBySetPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Fetch existing list items to know what's already in wishlist/trade
  const { data: listsData } = useQuery({ 
    queryKey: ['lists'], 
    queryFn: () => collectionService.getListItems() 
  });

  // 1) Get collection stats grouped by set to know which sets the user owns at least one card
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['collection-stats', 'set'],
    queryFn: () => collectionService.getCollectionStats('set'),
  });

  // 3) Derive the list of setIds to show (those where user owns at least 1 unique card)
  const ownedSets: any[] = useMemo(() => {
    const grouped = stats?.grouped || [];
    return grouped.filter((g: any) => (g.uniqueCards || 0) > 0 && g.set?.id);
  }, [stats]);

  // Two independent collapses per set: standard and extras, keyed as `${setId}|std` and `${setId}|x`
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const toggleKey = (key: string) => {
    setOpenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Handler for toggling wishlist/trade list items
  const handleToggleListItem = async (cardId: string, type: ListType) => {
    try {
      const existing = listsData?.find((li: any) => li.cardId === cardId && li.type === type);
      if (existing) {
        await collectionService.deleteListItem(existing.id);
        toast.success(type === 'WISHLIST' ? 'Retiré de la Wishlist' : 'Retiré de la Trade list');
      } else {
        await collectionService.upsertListItem(cardId, type, 1);
        toast.success(type === 'WISHLIST' ? 'Ajouté à la Wishlist' : 'Ajouté à la Trade list');
      }
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    } catch {
      toast.error('Action liste échouée');
    }
    return null;
  };

  // Mutation to add a missing card to collection
  const addCardMutation = useMutation({
    mutationFn: ({ cardId, quantity }: { cardId: string; quantity: number }) =>
  collectionService.addCard(cardId, quantity, false),
    onSuccess: () => {
      toast.success('Carte ajoutée à votre collection');
  // Refresh collection stats and missing caches
  queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
  // Invalidate both scopes for any set (safe and simple)
  queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'collection' && q.queryKey[1] === 'missing' });
  // Also refresh deck ownership overlays
  queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'deck-owned' });
    },
    onError: () => toast.error("Impossible d'ajouter la carte"),
  });

  const handleAdd = (cardId: string) => {
    addCardMutation.mutate({ cardId, quantity: 1 });
  };

  const MissingList = ({ setId, open, extras }: { setId: string; open: boolean; extras?: boolean }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['collection', 'missing', setId, extras === true ? 'extras' : 'standard'],
      queryFn: () => collectionService.getMissingFromSet(setId, extras),
      enabled: open,
      staleTime: 1000 * 60 * 10,
    });

    const parseCollectorNumber = (cn: string | undefined) => {
      if (!cn) return { num: Number.POSITIVE_INFINITY, suffix: '' };
      // Match numeric part + optional alpha suffix (e.g., 0101a)
      const m = cn.match(/^(\d+)([A-Za-z]*)$/);
      if (m) {
        return { num: parseInt(m[1], 10), suffix: m[2] || '' };
      }
      // Fallback: try extracting leading number anywhere
      const m2 = cn.match(/(\d+)/);
      if (m2) return { num: parseInt(m2[1], 10), suffix: cn.replace(m2[1], '') };
      return { num: Number.POSITIVE_INFINITY, suffix: cn };
    };

  const cards = (data?.cards || [])
      .filter((c: any) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          (c.nameFr || c.name || '').toLowerCase().includes(q) ||
          (c.typeLineFr || c.typeLine || '').toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => {
        const pa = parseCollectorNumber(a.collectorNumber);
        const pb = parseCollectorNumber(b.collectorNumber);
        if (pa.num !== pb.num) return pa.num - pb.num;
        // Empty suffix comes before lettered variants
        if (pa.suffix === pb.suffix) return 0;
        if (!pa.suffix) return -1;
        if (!pb.suffix) return 1;
        return pa.suffix.localeCompare(pb.suffix);
      });

    return (
      <div className="mt-3">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : cards.length === 0 ? (
          <div className="text-sm text-gray-400 py-4">Aucune carte manquante 🎉</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {cards.map((card: any) => (
              <div key={card.id}>
                <CardDisplay
                  card={card}
                  userCard={null}
                  showQuantityControls={false}
                  onToggleListItem={handleToggleListItem}
                />
                <button
                  onClick={() => handleAdd(card.id)}
                  className="btn-primary text-xs flex items-center justify-center py-1.5 mt-2 w-full"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Ajouter à ma collection
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Removed MissingSection; we now render two independent collapses per set.

  if (statsLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Cartes manquantes par extension</h1>
        <p className="text-gray-400">Seules les extensions où vous possédez déjà des cartes sont listées.</p>
      </div>

      {/* Search bar */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Filtrer les cartes manquantes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Collapses per set: one for Standard, one for Extras */}
      <div className="space-y-3">
        {ownedSets.map((g: any) => {
          const set = g.set || {};
          const setId = set.id as string;
          const keyStd = `${setId}|std`;
          const keyX = `${setId}|x`;
          const isOpenStd = openKeys.has(keyStd);
          const isOpenX = openKeys.has(keyX);

          const baseHeader = (label: string, open: boolean) => (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-xs font-bold border border-gray-700">
                  {(set?.code || 'SET').toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-semibold">{set?.nameFr || set?.name || 'Extension'} — {label}</div>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          );

          return (
            <div key={setId} className="space-y-3">
              {/* Standard collapse */}
              <div className="card p-4">
                <button className="w-full text-left" onClick={() => toggleKey(keyStd)}>
                  {baseHeader('Standard', isOpenStd)}
                </button>
                {isOpenStd && (
                  <MissingList setId={setId} open extras={false} />
                )}
              </div>

              {/* Extras collapse */}
              <div className="card p-4">
                <button className="w-full text-left" onClick={() => toggleKey(keyX)}>
                  {baseHeader('Extras', isOpenX)}
                </button>
                {isOpenX && (
                  <MissingList setId={setId} open extras />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MissingBySetPage;
