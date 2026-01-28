import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import CardDisplay from './CardDisplay';
import type { UserCard } from '../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collectionService, setsService } from '../services/collection';
import { extractColors, sortByCollector, getCardPriceEUR, parsePrices, isExtraSafe } from '../domain/cards/normalize';
import toast from 'react-hot-toast';

interface CollectionBySetProps {
  userCards: UserCard[];
  forSaleData?: Record<string, { quantity: number; quantityFoil: number }>;
  viewMode?: 'grid' | 'list';
  onUpdateQuantity?: (cardId: string, newQuantity: number, newQuantityFoil: number) => void;
  onAddToSale?: (cardId: string) => void;
  searchQuery?: string;
  selectedRarity?: string;
  selectedColors?: string[];
  ownedOnly?: boolean;
}

interface SetGroup {
  set: any;
  cards: UserCard[];
  totalCards: number;
  totalFoils: number;
  uniqueCards: number;
}

// Child section component to isolate hooks per set (prevents hook order changes in parent)
interface SetGroupSectionProps {
  group: SetGroup;
  viewMode: 'grid' | 'list';
  forSaleData: Record<string, { quantity: number; quantityFoil: number }>;
  isStdExpanded: boolean;
  isXExpanded: boolean;
  toggleKey: (key: string) => void;
  sortUserCards: (arr: any[]) => any[];
  onUpdateQuantity?: (cardId: string, newQuantity: number, newQuantityFoil: number) => void;
  onAddToSale?: (cardId: string) => void;
  handleToggleListItem: (cardId: string, type: any) => Promise<null>;
}

const SetGroupSection = ({ group, viewMode, forSaleData, isStdExpanded, isXExpanded, toggleKey, sortUserCards, onUpdateQuantity, onAddToSale, handleToggleListItem }: SetGroupSectionProps) => {
  // Separate queries per group; only run when expanded
  const { data: standardPage, isLoading: standardLoading } = useQuery({
    queryKey: ['set-standard-count', group.set.id],
    queryFn: async () => setsService.getSetCards(group.set.id, 1, 1, false),
    staleTime: 1000 * 60 * 10,
    // Charger au montage pour que le header affiche les stats sans ouvrir le collapse
    enabled: true
  });
  const { data: extrasPage, isLoading: extrasLoading } = useQuery({
    queryKey: ['set-extras-count', group.set.id],
    queryFn: async () => setsService.getSetCards(group.set.id, 1, 1, true),
    staleTime: 1000 * 60 * 10,
    // Charger au montage pour que le header affiche les stats sans ouvrir le collapse
    enabled: true
  });

  // Classify using backend flag when present, else fall back to heuristic
  const extraCards = group.cards.filter((uc: any) => uc.card && isExtraSafe(uc.card));
  const standardCards = group.cards.filter((uc: any) => uc.card && !isExtraSafe(uc.card));
  const ownedStandardUnique = standardCards.length;
  const ownedExtrasUnique = extraCards.length;
  const sumQty = (arr: any[]) => arr.reduce((acc, uc) => acc + (uc.quantity || 0), 0);
  const sumFoil = (arr: any[]) => arr.reduce((acc, uc) => acc + (uc.quantityFoil || 0), 0);
  const standardTotalQty = sumQty(standardCards);
  const standardTotalFoil = sumFoil(standardCards);
  const extrasTotalQty = sumQty(extraCards);
  const extrasTotalFoil = sumFoil(extraCards);

  const standardTotalInSet: number | undefined = (standardPage as any)?.pagination?.total;
  const standardPercent = typeof standardTotalInSet === 'number' && standardTotalInSet > 0 ? Math.round((ownedStandardUnique / standardTotalInSet) * 100) : undefined;

  const extrasTotal = (extrasPage as any)?.pagination?.total as number | undefined;
  const extrasPercent = typeof extrasTotal === 'number' && extrasTotal > 0 ? Math.round((ownedExtrasUnique / extrasTotal) * 100) : undefined;
  // Show extras header if expanded, loading, we own any extras, or the set has extras per count
  const showExtras = Boolean(
    isXExpanded ||
    extrasLoading ||
    ownedExtrasUnique > 0 ||
    (typeof extrasTotal === 'number' && extrasTotal > 0)
  );

  const stdKey = `${group.set.id}|std`;
  const xKey = `${group.set.id}|x`;

  return (
    <motion.div key={group.set.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
      {/* Standard header */}
      <button onClick={() => toggleKey(stdKey)} className="w-full p-4 flex items-center justify-between hover:bg-mtg-surface transition-colors">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isStdExpanded ? (<ChevronDown className="w-5 h-5 text-mtg-primary" />) : (<ChevronRight className="w-5 h-5 text-gray-400" />)}
            <div>
              <h3 className="text-left text-lg font-semibold">{group.set.nameFr || group.set.name}</h3>
              <p className="text-sm text-gray-400 text-left">{group.set.code?.toUpperCase()} • {group.set.releasedAt ? new Date(group.set.releasedAt).getFullYear() : 'N/A'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="hidden md:block">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>{ownedStandardUnique}/{standardLoading ? '…' : (standardTotalInSet ?? '—')}</span>
              <span className="ml-4">{standardLoading ? '…' : (standardPercent ?? '—')}{!standardLoading && typeof standardPercent === 'number' ? '%' : ''}</span>
            </div>
            <div className="h-2 w-48 bg-gray-700 rounded">
              <div className="h-2 bg-mtg-primary rounded" style={{ width: `${!standardLoading && typeof standardPercent === 'number' ? standardPercent : 0}%` }} />
            </div>
          </div>
          <div className="text-center">
            <div className="text-mtg-primary font-semibold">{ownedStandardUnique}</div>
            <div className="text-gray-400">Uniques</div>
          </div>
          <div className="text-center">
            <div className="text-mtg-secondary font-semibold">{standardTotalQty}</div>
            <div className="text-gray-400">Total</div>
          </div>
          {standardTotalFoil > 0 && (
            <div className="text-center">
              <div className="text-mtg-accent font-semibold">{standardTotalFoil}</div>
              <div className="text-gray-400">Foil</div>
            </div>
          )}
        </div>
      </button>
      <AnimatePresence>
        {isStdExpanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-gray-700 p-4">
              <div className="mb-2 text-sm text-gray-300">Standard <span className="text-gray-500">({standardCards.length})</span></div>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sortUserCards(standardCards).map((uc: any) => (
                    <CardDisplay key={uc.id} card={uc.card} userCard={uc}
                      forSaleQuantity={forSaleData[uc.cardId]}
                      onUpdateQuantity={onUpdateQuantity}
                      onAddToSale={onAddToSale}
                      onToggleListItem={handleToggleListItem}
                      showQuantityControls={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortUserCards(standardCards).map((uc: any) => (
                    <CardDisplay key={uc.id} card={uc.card} userCard={uc}
                      forSaleQuantity={forSaleData[uc.cardId]}
                      onUpdateQuantity={onUpdateQuantity}
                      onAddToSale={onAddToSale}
                      onToggleListItem={handleToggleListItem}
                      showQuantityControls={true}
                      viewMode="list"
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extras header */}
      {showExtras && (
        <button onClick={() => toggleKey(xKey)} className="w-full p-4 flex items-center justify-between hover:bg-mtg-surface transition-colors border-t border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isXExpanded ? (<ChevronDown className="w-5 h-5 text-mtg-primary" />) : (<ChevronRight className="w-5 h-5 text-gray-400" />)}
              <div>
                <h3 className="text-left text-lg font-semibold">{group.set.nameFr || group.set.name} — Extras</h3>
                <p className="text-sm text-gray-400 text-left">{group.set.code?.toUpperCase()} • {group.set.releasedAt ? new Date(group.set.releasedAt).getFullYear() : 'N/A'}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="hidden md:block">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{ownedExtrasUnique}/{extrasLoading ? '…' : (extrasTotal ?? '—')}</span>
                <span className="ml-4">{extrasLoading ? '…' : (extrasPercent ?? '—')}{!extrasLoading && typeof extrasPercent === 'number' ? '%' : ''}</span>
              </div>
              <div className="h-2 w-48 bg-gray-700 rounded">
                <div className="h-2 bg-mtg-primary rounded" style={{ width: `${!extrasLoading && typeof extrasPercent === 'number' ? extrasPercent : 0}%` }} />
              </div>
            </div>
            <div className="text-center">
              <div className="text-mtg-primary font-semibold">{ownedExtrasUnique}</div>
              <div className="text-gray-400">Uniques</div>
            </div>
            {extrasTotalQty > 0 && (
              <div className="text-center">
                <div className="text-mtg-secondary font-semibold">{extrasTotalQty}</div>
                <div className="text-gray-400">Total</div>
              </div>
            )}
            {extrasTotalFoil > 0 && (
              <div className="text-center">
                <div className="text-mtg-accent font-semibold">{extrasTotalFoil}</div>
                <div className="text-gray-400">Foil</div>
              </div>
            )}
          </div>
        </button>
      )}
      <AnimatePresence>
        {showExtras && isXExpanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-gray-700 p-4">
              <div className="mb-2 text-sm text-gray-300">Extras <span className="text-gray-500">({extraCards.length})</span></div>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sortUserCards(extraCards).map((uc: any) => (
                    <CardDisplay key={uc.id} card={uc.card} userCard={uc}
                      forSaleQuantity={forSaleData[uc.cardId]}
                      onUpdateQuantity={onUpdateQuantity}
                      onAddToSale={onAddToSale}
                      onToggleListItem={handleToggleListItem}
                      showQuantityControls={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortUserCards(extraCards).map((uc: any) => (
                    <CardDisplay key={uc.id} card={uc.card} userCard={uc}
                      forSaleQuantity={forSaleData[uc.cardId]}
                      onUpdateQuantity={onUpdateQuantity}
                      onAddToSale={onAddToSale}
                      onToggleListItem={handleToggleListItem}
                      showQuantityControls={true}
                      viewMode="list"
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CollectionBySet = ({
  userCards,
  forSaleData = {},
  viewMode = 'grid',
  onUpdateQuantity,
  onAddToSale,
  searchQuery = '',
  selectedRarity = '',
  selectedColors = [],
  ownedOnly = false
}: CollectionBySetProps) => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showEmptySets, setShowEmptySets] = useState(false);
  const [sortBy, setSortBy] = useState<'collector' | 'priceAsc' | 'priceDesc' | 'name'>('collector');

  const { data: listsData } = useQuery({ queryKey: ['lists'], queryFn: () => collectionService.getListItems() });

  // Local parsing helper removed (unused); relies on shared sortByCollector from domain utilities.

  const sortUserCards = (arr: any[]) => {
    if (sortBy === 'collector') return sortByCollector(arr);
    if (sortBy === 'name') return arr.slice().sort((a: any, b: any) => {
      const na = (a.card?.nameFr || a.card?.name || '').toString();
      const nb = (b.card?.nameFr || b.card?.name || '').toString();
      const c = na.localeCompare(nb);
      return c !== 0 ? c : (sortByCollector([a, b]) as any)[0] === a ? -1 : 1;
    });
    const price = (uc: any) => {
      const prices = parsePrices(uc.card || {} as any);
      const n = getCardPriceEUR(prices) ?? NaN;
      return Number.isFinite(n) ? n : NaN;
    };
    return arr.slice().sort((a: any, b: any) => {
      const pa = price(a);
      const pb = price(b);
      if (Number.isNaN(pa) && Number.isNaN(pb)) return (sortByCollector([a, b]) as any)[0] === a ? -1 : 1;
      if (Number.isNaN(pa)) return sortBy === 'priceAsc' ? 1 : -1;
      if (Number.isNaN(pb)) return sortBy === 'priceAsc' ? -1 : 1;
      const diff = pa - pb;
      if (diff !== 0) return sortBy === 'priceAsc' ? diff : -diff;
      return (sortByCollector([a, b]) as any)[0] === a ? -1 : 1;
    });
  };

  const handleToggleListItem = async (cardId: string, type: any) => {
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

  const groupCardsBySet = () => {
    const setGroups = new Map<string, SetGroup>();
    userCards.forEach((userCard: any) => {
      const card = userCard.card;
      if (!card?.set) return;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = (card.name?.toLowerCase() || '').includes(q) || (card.nameFr?.toLowerCase() || '').includes(q);
        const matchesType = (card.typeLine?.toLowerCase() || '').includes(q) || (card.typeLineFr?.toLowerCase() || '').includes(q);
        if (!matchesName && !matchesType) return;
      }
      if (selectedRarity && card.rarity !== selectedRarity) return;
      if (selectedColors.length > 0) {
        const cids = extractColors(card);
        if (cids.length && !selectedColors.some((col) => cids.includes(col))) return;
      }
      if (ownedOnly && userCard.quantity <= 0 && userCard.quantityFoil <= 0) return;

      const setId = card.set.id;
      if (!setGroups.has(setId)) {
        setGroups.set(setId, { set: card.set, cards: [], totalCards: 0, totalFoils: 0, uniqueCards: 0 });
      }
      const g = setGroups.get(setId)!;
      g.cards.push(userCard);
      g.totalCards += userCard.quantity;
      g.totalFoils += userCard.quantityFoil;
      g.uniqueCards += 1;
    });
    const arr = Array.from(setGroups.values());
    return showEmptySets ? arr : arr.filter(g => g.totalCards > 0 || g.totalFoils > 0);
  };

  const setGroups = groupCardsBySet();
  setGroups.sort((a, b) => (a.set.nameFr || a.set.name || '').localeCompare(b.set.nameFr || b.set.name || ''));

  const toggleKey = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpanded(next);
  };
  const expandAll = () => {
    const keys: string[] = [];
    for (const g of setGroups) keys.push(`${g.set.id}|std`, `${g.set.id}|x`);
    setExpanded(new Set(keys));
  };
  const collapseAll = () => setExpanded(new Set());

  if (setGroups.length === 0) {
    return <div className="text-center py-8 text-gray-400">Aucune carte trouvée avec les filtres actuels</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={expandAll} className="text-sm text-mtg-primary hover:text-mtg-secondary transition-colors">Tout développer</button>
          <button onClick={collapseAll} className="text-sm text-mtg-primary hover:text-mtg-secondary transition-colors">Tout réduire</button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <label htmlFor="sortBy" className="hidden sm:block">Trier par</label>
            <select id="sortBy" value={sortBy} onChange={(e)=>setSortBy(e.target.value as any)} className="input">
              <option value="collector">Numéro de collection (défaut)</option>
              <option value="priceAsc">Prix EUR ↑</option>
              <option value="priceDesc">Prix EUR ↓</option>
              <option value="name">Nom (A→Z)</option>
            </select>
          </div>
          <button onClick={() => setShowEmptySets(!showEmptySets)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            {showEmptySets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showEmptySets ? 'Masquer les sets vides' : 'Afficher les sets vides'}
          </button>
        </div>
      </div>

      {setGroups.map(group => {
        const stdKey = `${group.set.id}|std`;
        const xKey = `${group.set.id}|x`;
        return (
          <SetGroupSection
            key={group.set.id}
            group={group}
            viewMode={viewMode}
            forSaleData={forSaleData}
            isStdExpanded={expanded.has(stdKey)}
            isXExpanded={expanded.has(xKey)}
            toggleKey={toggleKey}
            sortUserCards={sortUserCards}
            onUpdateQuantity={onUpdateQuantity}
            onAddToSale={onAddToSale}
            handleToggleListItem={handleToggleListItem}
          />
        );
      })}
    </div>
  );
};

export default CollectionBySet;
