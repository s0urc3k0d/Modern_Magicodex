import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Plus, Minus, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setsService, collectionService } from '../services/collection';
import { pickCardImageUrl, isExtraSafe, sortByCollector } from '../domain/cards/normalize';
import LoadingSpinner from './LoadingSpinner';
import toast from 'react-hot-toast';

type Props = { isOpen: boolean; onClose: () => void };

const BulkAddBySetModal = ({ isOpen, onClose }: Props) => {
  const [searchSet, setSearchSet] = useState('');
  const [selectedSet, setSelectedSet] = useState<any | null>(null);
  const [selected, setSelected] = useState<Record<string, { qty: number; foil: boolean }>>({});
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const queryClient = useQueryClient();

  // Load sets with search
  const { data: setsData, isLoading: setsLoading } = useQuery({
    queryKey: ['sets', searchSet],
    queryFn: async () => {
      const res = await setsService.getSets(1, 20, searchSet);
      return res;
    },
    enabled: isOpen && !selectedSet,
  });

  // Load cards of selected set
  const { data: setCardsData, isLoading: cardsLoading } = useQuery({
    queryKey: ['set-cards', selectedSet?.id, page, limit],
    queryFn: async () => {
      if (!selectedSet) return { cards: [], pagination: { page: 1, totalPages: 1 } } as any;
      return setsService.getSetCards(selectedSet.id, page, limit);
    },
    enabled: !!selectedSet,
  });

  // Load all pages for correct global numeric ordering
  const [allCards, setAllCards] = useState<any[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [variantFilter, setVariantFilter] = useState<'all'|'standard'|'extras'>('all');
  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      if (!selectedSet) { setAllCards([]); return; }
      setAllLoading(true);
      try {
        const first = await setsService.getSetCards(selectedSet.id, 1, limit);
        let items = [...(first.cards || [])];
        const totalPages = first.pagination?.totalPages || 1;
        for (let p = 2; p <= totalPages; p++) {
          const resp = await setsService.getSetCards(selectedSet.id, p, limit);
          items = items.concat(resp.cards || []);
        }
        if (!cancelled) setAllCards(items);
      } catch {
        if (!cancelled) setAllCards([]);
      } finally {
        if (!cancelled) setAllLoading(false);
      }
    };
    loadAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSet?.id, limit]);

  // Mutate bulk add
  // Bulk progress state
  const [adding, setAdding] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const cancelRef = useRef(false);
  const [progress, setProgress] = useState(() => ({
    active: false,
    currentChunk: 0,
    totalChunks: 0,
    processedItems: 0,
    totalItems: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    affected: 0,
  }));

  const handleAddSelected = async () => {
    const entries = Object.entries(selected);
    if (entries.length === 0 || adding) return;
    setAdding(true);
    setCancelRequested(false);
    cancelRef.current = false;
    const bulkItems = entries.map(([cardId, cfg]) => ({
      cardId,
      quantity: cfg.foil ? 0 : cfg.qty,
      quantityFoil: cfg.foil ? cfg.qty : 0,
      language: 'fr'
    }));
    const CHUNK = 300;
    const totalChunks = Math.ceil(bulkItems.length / CHUNK);
    const totalItems = bulkItems.length;
    let created = 0, updated = 0, deleted = 0, affected = 0, processedItems = 0;
    setProgress({ active: true, currentChunk: 0, totalChunks, processedItems: 0, totalItems, created: 0, updated: 0, deleted: 0, affected: 0 });
    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (cancelRef.current) break;
        const slice = bulkItems.slice(chunkIndex * CHUNK, (chunkIndex + 1) * CHUNK);
        const resp = await collectionService.addCardsBulk(slice, 'increment');
        const s = resp.summary || {};
        created += s.created || 0;
        updated += s.updated || 0;
        deleted += s.deleted || 0;
        affected += s.affected || 0;
        processedItems += slice.length;
        setProgress({
          active: true,
            currentChunk: chunkIndex + 1,
            totalChunks,
            processedItems,
            totalItems,
            created,
            updated,
            deleted,
            affected,
        });
      }
      if (cancelRef.current) {
        toast('Ajout annulé – résultats partiels conservés');
      } else {
        toast.success(`Ajout terminé: ${created} créées, ${updated} mises à jour${deleted? ', '+deleted+' supprimées':''}`);
        queryClient.invalidateQueries({ queryKey: ['collection'] });
        queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
        setSelected({});
        onClose();
      }
    } catch (error: any) {
      if (error?.response?.status === 429) {
        toast.error('Trop de requêtes: réessayez après une pause');
      } else if (error?.message === 'Network Error') {
        toast.error('Réseau indisponible');
      } else {
        toast.error('Ajout en masse échoué');
      }
    } finally {
      setAdding(false);
      setCancelRequested(false);
      cancelRef.current = false;
      setProgress(p => ({ ...p, active: false }));
    }
  };

  const cancelAdd = () => {
    setCancelRequested(true);
    cancelRef.current = true;
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedSet(null);
      setSelected({});
      setSearchSet('');
      setPage(1);
    }
  }, [isOpen]);

  const toggleSelect = (card: any) => {
    setSelected(prev => {
      const cur = prev[card.id];
      if (cur) {
        const { qty, foil } = cur;
        const nq = qty + 1;
        return { ...prev, [card.id]: { qty: nq, foil } };
      }
      return { ...prev, [card.id]: { qty: 1, foil: false } };
    });
  };

  const decSelect = (cardId: string) => {
    setSelected(prev => {
      const cur = prev[cardId];
      if (!cur) return prev;
      const nq = cur.qty - 1;
      if (nq <= 0) {
        const { [cardId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [cardId]: { ...cur, qty: nq } };
    });
  };

  const toggleFoil = (cardId: string) => {
    setSelected(prev => {
      const cur = prev[cardId];
      if (!cur) return prev;
      return { ...prev, [cardId]: { ...cur, foil: !cur.foil } };
    });
  };

  const totalQty = useMemo(() => Object.values(selected).reduce((s, v) => s + v.qty, 0), [selected]);

  // Heuristic to separate extras/variants from standard (safe version)
  const isExtra = (collectorNumber?: string, card?: any) => isExtraSafe({ collectorNumber, ...(card || {}) });

  const filteredCards = useMemo(() => {
    const base = (allCards.length ? allCards : setCardsData?.cards || []).slice();
    if (variantFilter === 'all') return base;
  if (variantFilter === 'standard') return base.filter((c:any)=>!isExtra(c.collectorNumber, c));
  return base.filter((c:any)=>isExtra(c.collectorNumber, c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards, setCardsData?.cards, variantFilter]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={()=>{ if(!adding) onClose(); }}>
          <motion.div className="bg-mtg-surface border border-gray-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="font-semibold text-white">Ajout en masse par set</div>
              <button onClick={()=>{ if(!adding) onClose(); }} disabled={adding} className="text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 flex min-h-0">
              {/* Left: Set picker */}
              <div className="w-80 p-4 border-r border-gray-700 flex flex-col">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                  <input value={searchSet} onChange={(e)=>setSearchSet(e.target.value)} placeholder="Rechercher un set..." className="input w-full pl-9"/>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {setsLoading ? (
                    <div className="text-gray-400 text-sm">Chargement…</div>
                  ) : (
                    <div className="space-y-1">
                      {setsData?.sets?.map((s:any)=>(
                        <button key={s.id} onClick={()=>{ setSelectedSet(s); setPage(1); }} className={`w-full text-left px-2 py-1 rounded hover:bg-gray-700 ${selectedSet?.id===s.id? 'bg-gray-700':''}`}>
                          <div className="text-white text-sm truncate">{s.nameFr || s.name}</div>
                          <div className="text-xs text-gray-400">{s.code?.toUpperCase()} • {s.releasedAt ? new Date(s.releasedAt).getFullYear():'N/A'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Cards of set */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                  <div className="text-white font-medium">
                    {selectedSet ? (
                      <>
                        {(selectedSet.nameFr || selectedSet.name)} <span className="text-gray-400">({selectedSet.code?.toUpperCase()})</span>
                      </>
                    ) : 'Choisissez un set' }
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-400">Afficher:</span>
                      <div className="inline-flex rounded border border-gray-600 overflow-hidden">
                        <button disabled={adding} onClick={()=>setVariantFilter('all')} className={`px-2 py-1 ${variantFilter==='all'?'bg-gray-600 text-white':'text-gray-300 hover:bg-gray-700'} ${adding?'opacity-50 cursor-not-allowed':''}`}>Toutes</button>
                        <button disabled={adding} onClick={()=>setVariantFilter('standard')} className={`px-2 py-1 ${variantFilter==='standard'?'bg-gray-600 text-white':'text-gray-300 hover:bg-gray-700'} ${adding?'opacity-50 cursor-not-allowed':''}`}>Standard</button>
                        <button disabled={adding} onClick={()=>setVariantFilter('extras')} className={`px-2 py-1 ${variantFilter==='extras'?'bg-gray-600 text-white':'text-gray-300 hover:bg-gray-700'} ${adding?'opacity-50 cursor-not-allowed':''}`}>Extras</button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-300">Sélection: {Object.keys(selected).length} • Total: {totalQty}</div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedSet ? (
                    (cardsLoading || allLoading) ? (
                      <div className="text-gray-400 text-sm">Chargement des cartes…</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {sortByCollector(filteredCards).map((c:any)=>{
                          const imageUrl = pickCardImageUrl(typeof c.imageUris==='string'? JSON.parse(c.imageUris||'{}') : (c.imageUris||{}), 'small');
                          const sel = selected[c.id];
                          return (
                            <div
                              key={c.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => { if(!adding) toggleSelect(c); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(c); } }}
                              title="Cliquer pour ajouter +1"
                              className={`bg-gray-800 border ${sel? 'border-mtg-gold':'border-gray-700'} rounded-lg overflow-hidden cursor-pointer transition shadow-sm hover:shadow-md hover:border-mtg-gold focus:outline-none focus:ring-2 focus:ring-mtg-primary/60 select-none`}
                            >
                              <div className="aspect-[5/7] bg-gray-900">
                                {imageUrl? (
                                  <img src={imageUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" decoding="async"/>
                                ): <div className="w-full h-full"/>}
                                {isExtra(c.collectorNumber, c) && (
                                  <span className="absolute top-1 left-1 text-[10px] bg-indigo-600/90 text-white px-1.5 py-0.5 rounded">
                                    EXTRA
                                  </span>
                                )}
                              </div>
                              <div className="p-2 text-xs">
                                <div className="text-white truncate">{c.nameFr || c.name}</div>
                                <div className="text-gray-400">#{c.collectorNumber} • {c.rarity}</div>
                                <div className="flex items-center gap-1 mt-2">
                                  <button disabled={adding} onClick={(e)=>{ e.stopPropagation(); decSelect(c.id); }} className="btn-icon-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed" title="-1"><Minus className="w-3 h-3"/></button>
                                  <button disabled={adding} onClick={(e)=>{ e.stopPropagation(); toggleSelect(c); }} className="btn-icon-sm bg-mtg-primary text-mtg-black hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" title="+1"><Plus className="w-3 h-3"/></button>
                                  <button disabled={adding} onClick={(e)=>{ e.stopPropagation(); toggleFoil(c.id); }} className={`btn-icon-sm ${selected[c.id]?.foil? 'bg-mtg-primary text-mtg-black':'bg-gray-700 hover:bg-gray-600'} disabled:opacity-40 disabled:cursor-not-allowed`} title="Foil"><Sparkles className="w-3 h-3"/></button>
                                  <div className="ml-auto text-gray-300">{sel? sel.qty: 0}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="text-gray-400 text-sm">Sélectionnez un set pour voir ses cartes</div>
                  )}
                </div>
                {/* Pagination supprimée: toutes les cartes sont chargées et affichées en bloc dans la modale */}
                <div className="p-4 border-t border-gray-700 flex flex-col gap-3">
                  {progress.active && (
                    <div className="space-y-2" aria-live="polite">
                      <div className="flex items-center justify-between text-xs text-gray-300">
                        <span>Progression: chunk {progress.currentChunk}/{progress.totalChunks}</span>
                        <span>{progress.processedItems}/{progress.totalItems} cartes</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
                        <div className="h-full bg-mtg-primary transition-all" style={{ width: progress.totalChunks? `${(progress.currentChunk / progress.totalChunks) * 100}%` : '0%' }} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
                        <span>Créées: <span className="text-gray-200">{progress.created}</span></span>
                        <span>MàJ: <span className="text-gray-200">{progress.updated}</span></span>
                        {progress.deleted > 0 && <span>Supprimées: <span className="text-gray-200">{progress.deleted}</span></span>}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    {!adding && (
                      <button onClick={onClose} className="btn-outline">Annuler</button>
                    )}
                    {adding && !cancelRequested && (
                      <button onClick={cancelAdd} className="btn-outline border-yellow-500 text-yellow-400 hover:bg-yellow-500/10">Annuler l'opération</button>
                    )}
                    {adding && cancelRequested && (
                      <span className="text-xs text-yellow-400">Annulation en attente…</span>
                    )}
                    <button onClick={handleAddSelected} disabled={Object.keys(selected).length===0 || adding} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                      {adding? <LoadingSpinner/> : 'Ajouter ('+ totalQty +')'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BulkAddBySetModal;
