import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionService } from '../services/collection';
import type { UserListItem, ListType } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Download, List, Grid3X3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SetGroup {
  setCode: string;
  setName: string;
  setIcon?: string;
  items: UserListItem[];
  totalQuantity: number;
}

const ListsPage = () => {
  const queryClient = useQueryClient();
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [groupBySet, setGroupBySet] = useState(true);

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

  // Group items by set
  const groupBySetFn = (arr: UserListItem[]): SetGroup[] => {
    const groups = new Map<string, SetGroup>();
    
    for (const item of arr) {
      const setCode = item.card?.set?.code?.toUpperCase() || 'UNKNOWN';
      const setName = item.card?.set?.nameFr || item.card?.set?.name || 'Set inconnu';
      const setIcon = item.card?.set?.iconSvgUri;
      
      if (!groups.has(setCode)) {
        groups.set(setCode, {
          setCode,
          setName,
          setIcon,
          items: [],
          totalQuantity: 0
        });
      }
      
      const group = groups.get(setCode)!;
      group.items.push(item);
      group.totalQuantity += item.quantity || 1;
    }
    
    // Sort groups by set name
    return Array.from(groups.values()).sort((a, b) => a.setName.localeCompare(b.setName));
  };

  const wishlistGroups = useMemo(() => groupBySetFn(wishlist), [wishlist]);
  const tradeGroups = useMemo(() => groupBySetFn(trade), [trade]);

  const toggleSet = (setCode: string, listType: ListType) => {
    const key = `${listType}-${setCode}`;
    setExpandedSets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSetExpanded = (setCode: string, listType: ListType) => {
    const key = `${listType}-${setCode}`;
    return expandedSets[key] ?? false;
  };

  // Export CSV function
  const exportCsv = (arr: UserListItem[], filename: string) => {
    const rows: string[] = [];
    const header = [
      'setCode', 'setName', 'cardName', 'cardNameFr', 'collectorNumber', 'rarity', 'quantity', 'notes', 'priceEur', 'priceEurFoil'
    ];
    rows.push(header.join(','));

    for (const item of arr) {
      const c = item.card || {};
      let prices: any = {};
      try { 
        prices = c.prices ? (typeof c.prices === 'string' ? JSON.parse(c.prices) : c.prices) : {}; 
      } catch {}
      
      rows.push([
        (c.set?.code || '').toUpperCase(),
        JSON.stringify(c.set?.nameFr || c.set?.name || ''),
        JSON.stringify(c.name || ''),
        JSON.stringify(c.nameFr || ''),
        c.collectorNumber || '',
        c.rarity || '',
        String(item.quantity ?? 1),
        JSON.stringify(item.notes || ''),
        prices.eur ? String(prices.eur) : '',
        prices.eur_foil ? String(prices.eur_foil) : ''
      ].join(','));
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Export ${filename} terminé`);
  };

  const renderCard = (item: UserListItem) => {
    const imageUris = typeof item.card.imageUris === 'string' 
      ? JSON.parse(item.card.imageUris || '{}') 
      : item.card.imageUris || {};
    
    return (
      <div key={item.id} className="bg-gray-800 border border-gray-700 rounded p-3 flex items-center gap-3">
        <img 
          src={imageUris.small || ''} 
          alt="" 
          className="w-12 h-16 object-cover rounded" 
        />
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium truncate">{item.card.nameFr || item.card.name}</div>
          <div className="text-gray-400 text-sm">{item.card.set?.code?.toUpperCase()} #{item.card.collectorNumber}</div>
          <div className="text-gray-400 text-xs">
            Qté: {item.quantity}
            {item.notes ? ` • ${item.notes}` : ''}
          </div>
        </div>
        <button 
          onClick={() => removeMutation.mutate(item.id)} 
          className="btn-outline text-xs"
          disabled={removeMutation.isPending}
        >
          Retirer
        </button>
      </div>
    );
  };

  const renderSetGroup = (group: SetGroup, listType: ListType) => {
    const isExpanded = isSetExpanded(group.setCode, listType);
    
    return (
      <div key={group.setCode} className="border border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSet(group.setCode, listType)}
          className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            {group.setIcon && (
              <img src={group.setIcon} alt="" className="w-5 h-5 invert opacity-70" />
            )}
            <span className="text-white font-medium">{group.setName}</span>
            <span className="text-gray-400 text-sm">({group.setCode})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">
              {group.items.length} carte{group.items.length > 1 ? 's' : ''} • {group.totalQuantity} ex.
            </span>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={`p-3 bg-gray-850 ${viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' 
                : 'space-y-2'}`}
              >
                {group.items
                  .sort((a, b) => {
                    const numA = parseInt(a.card.collectorNumber || '0');
                    const numB = parseInt(b.card.collectorNumber || '0');
                    return numA - numB;
                  })
                  .map(item => renderCard(item))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderSection = (title: string, arr: UserListItem[], groups: SetGroup[], listType: ListType) => (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">
          {title} ({arr.length} carte{arr.length > 1 ? 's' : ''})
        </h2>
        <button
          onClick={() => exportCsv(arr, `${listType.toLowerCase()}.csv`)}
          className="btn-outline text-xs flex items-center gap-1"
          disabled={arr.length === 0}
          title={`Exporter ${title} en CSV`}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>
      
      {arr.length === 0 ? (
        <div className="text-gray-400">Aucun élément</div>
      ) : groupBySet ? (
        <div className="space-y-2">
          {groups.map(group => renderSetGroup(group, listType))}
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' 
          : 'space-y-2'}
        >
          {arr.map(item => renderCard(item))}
        </div>
      )}
    </div>
  );

  if (isLoading) return <div className="py-10 flex justify-center"><LoadingSpinner/></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Wishlist & Trade</h1>
          <p className="text-gray-400">Gérez vos listes d'envies et d'échange</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Toggle groupBySet */}
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={groupBySet}
              onChange={(e) => setGroupBySet(e.target.checked)}
              className="form-checkbox rounded bg-gray-700 border-gray-600 text-primary-500 focus:ring-primary-500"
            />
            Grouper par set
          </label>
          
          {/* View mode toggle */}
          <div className="flex items-center border border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              title="Vue liste"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              title="Vue grille"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
          
          {/* Export all */}
          <button
            onClick={() => exportCsv(items, 'all-lists.csv')}
            className="btn-primary text-sm flex items-center gap-1"
            disabled={items.length === 0}
          >
            <Download className="w-4 h-4" />
            Tout exporter
          </button>
        </div>
      </div>
      
      {renderSection('Wishlist', wishlist, wishlistGroups, 'WISHLIST')}
      {renderSection('Trade list', trade, tradeGroups, 'TRADE')}
    </div>
  );
};

export default ListsPage;