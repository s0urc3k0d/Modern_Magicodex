// Clean reconstructed implementation with maybeboard & bulk save
import React, { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FixedSizeList as VList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import { motion } from 'framer-motion';
import { Save, Search, BarChart3, Download, Upload, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { decksService } from '../services/decks';
import { cardsService, collectionService } from '../services/collection';
import LoadingSpinner from '../components/LoadingSpinner';
import ManaSymbol from '../components/ManaSymbol';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);
const Pie = React.lazy(() => import('react-chartjs-2').then(m => ({ default: m.Pie })));
const Bar = React.lazy(() => import('react-chartjs-2').then(m => ({ default: m.Bar })));
import { SINGLETON_FORMATS, SIDEBOARD_LIMIT, MAIN_MINIMUM, BANLIST, copyLimitFor } from '../domain/decks/rules';
import type { DeckFormat } from '../domain/decks/rules';

interface DeckCardLocal { card: any; quantity: number; }
type ActiveView = 'cards' | 'stats' | 'visual';
type OwnedFilter = 'all' | 'owned' | 'unowned';

// Hoisted helper so color distribution & other hooks can use it before its textual position.
function isLand(c: any): boolean {
  const tl = (c?.typeLine || c?.typeLineFr || '') as string;
  // Include French 'Terrain'
  return tl.includes('Land') || tl.includes('Terrain');
}

const DeckBuilderPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<DeckFormat>('Standard');
  const [selectedArchetype, setSelectedArchetype] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('cards');
  const [deckCards, setDeckCards] = useState<DeckCardLocal[]>([]);
  const [sideboardCards, setSideboardCards] = useState<DeckCardLocal[]>([]);
  const [maybeBoardCards, setMaybeBoardCards] = useState<DeckCardLocal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>(() => (localStorage.getItem('builderOwnedFilter') as OwnedFilter) || 'all');
  const [ownedMap, setOwnedMap] = useState<Record<string, { quantity: number; quantityFoil: number }>>({});
  const [isOverMain, setIsOverMain] = useState(false);
  const [isOverSide, setIsOverSide] = useState(false);
  const [serverValidation, setServerValidation] = useState<{ valid: boolean; issues: string[] }|null>(null);

  const formats: DeckFormat[] = ['Standard','Pioneer','Modern','Legacy','Vintage','Historic','Commander'];
  const archetypes = ['Aggro','Midrange','Control','Combo','Ramp','Tempo','Stompy','Reanimator','Tokens'];

  const { data: existingDeck, isLoading: deckLoading } = useQuery({ queryKey: ['deck', id], enabled: !!id, queryFn: () => decksService.getDeck(id!) });
  useEffect(() => { if (!existingDeck) return; setDeckName(existingDeck.name||''); setDeckDescription(existingDeck.description||''); setSelectedFormat((existingDeck.format as DeckFormat)||'Standard'); setSelectedArchetype(existingDeck.archetype||''); setDeckCards((existingDeck.mainboard||[]).map((dc:any)=>({card:dc.card,quantity:dc.quantity}))); setSideboardCards((existingDeck.sideboard||[]).map((dc:any)=>({card:dc.card,quantity:dc.quantity}))); setMaybeBoardCards((existingDeck.maybeboard||[]).map((dc:any)=>({card:dc.card,quantity:dc.quantity}))); }, [existingDeck]);
  // Seed server validation from cached deck fields if present
  useEffect(()=>{ if(existingDeck && typeof existingDeck.lastValidationValid === 'boolean') { setServerValidation({ valid: !!existingDeck.lastValidationValid, issues: (existingDeck.lastValidationIssues||[]) as string[] }); } },[existingDeck]);

  useEffect(()=>{ const t=setTimeout(()=>setDebouncedSearchQuery(searchQuery.trim()),400); return ()=>clearTimeout(t); },[searchQuery]);
  // Advanced search filter states
  const [advColors, setAdvColors] = useState<string[]>([]);
  const [advRarity, setAdvRarity] = useState<string>('');
  const [advTypeContains, setAdvTypeContains] = useState<string>('');
  const [advPriceMin, setAdvPriceMin] = useState<string>('');
  const [advPriceMax, setAdvPriceMax] = useState<string>('');

  const { data: searchResults, isLoading: cardsLoading } = useQuery({
    queryKey:['builder-search',debouncedSearchQuery, { advColors, advRarity, advTypeContains, advPriceMin, advPriceMax }],
    enabled: debouncedSearchQuery.length>=2,
    queryFn: async ()=>{
      const priceMinNum = advPriceMin.trim()? parseFloat(advPriceMin): undefined;
      const priceMaxNum = advPriceMax.trim()? parseFloat(advPriceMax): undefined;
      const res = await cardsService.getCardsFtsAdvanced(debouncedSearchQuery, {
        limit: 120,
        colors: advColors,
        rarity: advRarity || undefined,
        typeContains: advTypeContains || undefined,
        priceMin: Number.isFinite(priceMinNum)? priceMinNum: undefined,
        priceMax: Number.isFinite(priceMaxNum)? priceMaxNum: undefined,
      });
      return res.cards;
    }
  });

  // Ownership mapping (card ids -> quantities) also indexed by oracleId for search filtering
  useEffect(()=>{ const load= async()=>{ const ids=[...deckCards, ...sideboardCards, ...maybeBoardCards].map(dc=>dc.card.id); const unique=Array.from(new Set(ids)); if(!unique.length){ setOwnedMap({}); return;} try{ const holdings= await collectionService.getUserCardsByIds(unique); const map:Record<string,{quantity:number;quantityFoil:number}>={}; holdings.forEach((uc:any)=>{ map[uc.cardId]={ quantity:uc.quantity, quantityFoil:uc.quantityFoil }; }); // also under oracleId
      [...deckCards, ...sideboardCards, ...maybeBoardCards].forEach(dc=>{ if(dc.card?.oracleId && map[dc.card.id]) map[dc.card.oracleId]=map[dc.card.id]; }); setOwnedMap(map); }catch{} }; load(); },[deckCards, sideboardCards, maybeBoardCards]);
  // Prefetch ownership for search results
  useEffect(()=>{ if(!searchResults) return; const oracleIds=Array.from(new Set(searchResults.map((c:any)=>c.oracleId).filter(Boolean))); const missing=oracleIds.filter(oid=>!ownedMap[oid]); if(!missing.length) return; (async()=>{ try{ const params=new URLSearchParams({ oracleIds: missing.join(',') }); const res= await fetch(`${import.meta.env.VITE_API_URL||'/api'}/collection/cards?${params}`, { headers:{ Authorization:`Bearer ${localStorage.getItem('token')||''}` }}); const holdings=await res.json(); const clone={...ownedMap}; holdings.forEach((uc:any)=>{ if(uc.oracleId) clone[uc.oracleId]={ quantity:uc.quantity, quantityFoil:uc.quantityFoil }; }); setOwnedMap(clone); }catch{} })(); },[searchResults, ownedMap]);

  useEffect(()=>{ localStorage.setItem('builderOwnedFilter', ownedFilter); },[ownedFilter]);

  const isOwnedByOracle = useCallback((oracleId?:string, fallbackCardId?:string)=>{ if(oracleId && ownedMap[oracleId]){ const v=ownedMap[oracleId]; return (v.quantity+v.quantityFoil)>0;} if(fallbackCardId && ownedMap[fallbackCardId]){ const v=ownedMap[fallbackCardId]; return (v.quantity+v.quantityFoil)>0;} return false; },[ownedMap]);

  const filteredSearchResults = useMemo(()=>{ if(!searchResults) return []; if(ownedFilter==='all') return searchResults; return searchResults.filter((c:any)=>{ const ownedQty=c.oracleId? ((ownedMap[c.oracleId]?.quantity||0)+(ownedMap[c.oracleId]?.quantityFoil||0)) : 0; return ownedFilter==='owned'? ownedQty>0 : ownedQty===0; }); },[searchResults, ownedFilter, ownedMap]);

  const getCardColorsSafe=(card:any):string[]=>{
    let source:any = card?.colors ?? card?.colorIdentity;
    if(!source) return [];
    if(Array.isArray(source)) return source.filter((c:string)=>['W','U','B','R','G'].includes(c));
    if(typeof source==='string'){
      // Attempt JSON parse first
      try {
        const parsed = JSON.parse(source);
        if(Array.isArray(parsed)) return parsed.filter((c:string)=>['W','U','B','R','G'].includes(c));
      } catch {
        // Fallbacks: comma-separated, compact concatenated, or single letters
        const commaParts = source.split(',').map(p=>p.trim()).filter(p=>['W','U','B','R','G'].includes(p));
        if(commaParts.length) return commaParts;
        const compact = source.replace(/[^WUBRG]/g,'');
        if(compact.length){ return [...new Set(compact.split(''))]; }
      }
    }
    return [];
  };
  const calculateColorDistribution=()=>{
    const colors={W:0,U:0,B:0,R:0,G:0,C:0};
    deckCards.forEach(dc=>{
      // Skip lands entirely from color distribution
      if (isLand(dc.card)) return;
      const cs=getCardColorsSafe(dc.card);
      if(cs.length){
        cs.forEach(c=>{
          if(['W','U','B','R','G'].includes(c)) (colors as any)[c]+=dc.quantity; else colors.C+=dc.quantity;
        });
      } else {
        // Non-land, no colors: treat as colorless spell
        colors.C+=dc.quantity;
      }
    });
    return colors;
  };
  const calculateManaCurve=()=>{ const curve=Array(8).fill(0); deckCards.forEach(dc=>{ const raw=Number(dc.card.cmc??0); const cmc=Number.isFinite(raw)? Math.min(Math.max(0,Math.floor(raw)),7):0; curve[cmc]+=dc.quantity; }); return curve; };
  const calculateTypeDistribution=()=>{ const types={Creature:0,Instant:0,Sorcery:0,Enchantment:0,Artifact:0,Planeswalker:0,Land:0,Other:0}; deckCards.forEach(dc=>{ const tl=dc.card?.typeLine||''; if(tl.includes('Creature')) types.Creature+=dc.quantity; else if(tl.includes('Instant')) types.Instant+=dc.quantity; else if(tl.includes('Sorcery')) types.Sorcery+=dc.quantity; else if(tl.includes('Enchantment')) types.Enchantment+=dc.quantity; else if(tl.includes('Artifact')) types.Artifact+=dc.quantity; else if(tl.includes('Planeswalker')) types.Planeswalker+=dc.quantity; else if(tl.includes('Land')) types.Land+=dc.quantity; else types.Other+=dc.quantity; }); return types; };
  const deckStats=useMemo(()=>({ totalCards: deckCards.reduce((s,c)=>s+c.quantity,0), totalSideboard: sideboardCards.reduce((s,c)=>s+c.quantity,0), avgCmc: deckCards.length? deckCards.reduce((s,c)=>s+(c.card.cmc||0)*c.quantity,0)/deckCards.reduce((s,c)=>s+c.quantity,0):0, colorDistribution: calculateColorDistribution(), manaCurve: calculateManaCurve(), typeDistribution: calculateTypeDistribution() }), [deckCards, sideboardCards]);

  const addDeckCardMutation = useMutation({ mutationFn: ({ deckId, cardId, quantity, board }: { deckId:string; cardId:string; quantity:number; board:'main'|'side'|'maybe'; }) => decksService.addCardToDeck(deckId,{cardId,quantity,board}), onSuccess:()=>{ queryClient.invalidateQueries({queryKey:['deck']}); }});
  const updateDeckCardMutation = useMutation({ mutationFn: ({ deckId, cardId, board, quantity }: { deckId:string; cardId:string; board:'main'|'side'|'maybe'; quantity:number; }) => decksService.updateDeckCard(deckId,cardId,board,{quantity}), onSuccess:()=>{ queryClient.invalidateQueries({queryKey:['deck']}); }});
  const removeDeckCardMutation = useMutation({ mutationFn: ({ deckId, cardId, board }: { deckId:string; cardId:string; board:'main'|'side'|'maybe'; }) => decksService.removeDeckCard(deckId,cardId,board), onSuccess:()=>{ queryClient.invalidateQueries({queryKey:['deck']}); }});

  const changeBoardState = (board:'main'|'side'|'maybe') => board==='main' ? { list:deckCards, set:setDeckCards } : board==='side' ? { list:sideboardCards, set:setSideboardCards } : { list:maybeBoardCards, set:setMaybeBoardCards };
  const addCardToDeck=(card:any, quantity=1, board:'main'|'side'|'maybe'='main')=>{ const { list, set } = changeBoardState(board); const existing=list.find(c=>c.card.id===card.id); const newQty= existing? existing.quantity+quantity: quantity; if(existing) set(list.map(c=>c.card.id===card.id?{...c,quantity:newQty}:c)); else set([...list,{card,quantity:newQty}]); if(id) addDeckCardMutation.mutate({ deckId:id, cardId:card.id, quantity:newQty, board }); };
  const removeCardFromDeck=(cardId:string, board:'main'|'side'|'maybe'='main')=>{ const { list, set } = changeBoardState(board); set(list.filter(c=>c.card.id!==cardId)); if(id) removeDeckCardMutation.mutate({ deckId:id, cardId, board }); };
  const updateCardQuantity=(cardId:string,newQuantity:number, board:'main'|'side'|'maybe'='main')=>{ const { list, set } = changeBoardState(board); if(newQuantity<=0){ removeCardFromDeck(cardId,board); return;} set(list.map(c=>c.card.id===cardId?{...c,quantity:newQuantity}:c)); if(id) updateDeckCardMutation.mutate({ deckId:id, cardId, board, quantity:newQuantity }); };

  const handleSaveDeck=()=> saveDeckMutation.mutate({ name:deckName, description:deckDescription, format:selectedFormat, archetype:selectedArchetype, isPublic:false });
  const saveDeckMutation = useMutation({ mutationFn:(deckData:any)=> id? decksService.updateDeck(id,deckData): decksService.createDeck(deckData), onSuccess: async (data: any)=>{ if(!id){ const newId=data.id; try { const ops=[...deckCards.map(dc=>({ cardId:dc.card.id, quantity:dc.quantity, board:'main' as const })), ...sideboardCards.map(dc=>({ cardId:dc.card.id, quantity:dc.quantity, board:'side' as const })), ...maybeBoardCards.map(dc=>({ cardId:dc.card.id, quantity:dc.quantity, board:'maybe' as const }))]; if(ops.length) await decksService.bulkUpsertDeckCards(newId, ops); } catch { toast.error('Bulk initial save partielle'); } navigate(`/decks/builder/${newId}`);} queryClient.invalidateQueries({ queryKey:['deck'] }); }, onError:()=> toast.error('Erreur lors de la sauvegarde du deck') });

  const refreshServerValidation = async () => {
    if(!id) return;
    try { const res = await decksService.validateDeck(id); setServerValidation({ valid: res.valid, issues: res.issues||[] }); } catch { toast.error('Validation serveur impossible'); }
  };

  const handleExportMTGA= async ()=>{ if(!id){ toast.error('Sauvegardez le deck avant export'); return;} try{ const res=await decksService.exportDeckMTGA(id); await navigator.clipboard.writeText(res.format||''); toast.success('Deck MTGA copié'); } catch { toast.error("Échec de l'export MTGA"); } };
  const handleImportMTGA= async ()=>{ const decklistText=prompt('Collez votre decklist MTGA ici:'); if(!decklistText) return; try{ const result=await decksService.importDeckFromMTGA(decklistText, deckName||'Deck importé'); if(!id && result.deck?.id) navigate(`/decks/builder/${result.deck.id}`); } catch { toast.error("Échec de l'import MTGA"); } };

  const handleDragStart=(e:React.DragEvent, card:any)=>{ try{ e.dataTransfer.setData('application/json', JSON.stringify({card})); }catch{} e.dataTransfer.effectAllowed='copyMove'; };
  const parseDropData=(e:React.DragEvent)=>{ try{ const d=e.dataTransfer.getData('application/json'); return d? JSON.parse(d): null; }catch{ return null; } };
  const onDragOverZone=(e:React.DragEvent)=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy'; };
  const handleDragStartDeck=(e:React.DragEvent, deckCard:any, board:'main'|'side'|'maybe')=>{ try{ e.dataTransfer.setData('application/json', JSON.stringify({ deckCardId:deckCard.card.id, sourceBoard:board })); }catch{} e.dataTransfer.effectAllowed='move'; };

  const onDropMain=(e:React.DragEvent)=>{ e.preventDefault(); const payload=parseDropData(e); if(!payload){ setIsOverMain(false); return;} if(payload.card){ addCardToDeck(payload.card,1,'main'); } else if(payload.deckCardId && payload.sourceBoard && payload.sourceBoard!=='main'){ const sourceList = payload.sourceBoard==='side'? sideboardCards : maybeBoardCards; const sourceSet = payload.sourceBoard==='side'? setSideboardCards : setMaybeBoardCards; const existingSource=sourceList.find(dc=>dc.card.id===payload.deckCardId); if(existingSource){ const qty=existingSource.quantity; sourceSet(sourceList.filter(dc=>dc.card.id!==payload.deckCardId)); const mainExisting=deckCards.find(dc=>dc.card.id===payload.deckCardId); if(mainExisting){ setDeckCards(deckCards.map(dc=>dc.card.id===payload.deckCardId?{...dc,quantity:dc.quantity+qty}:dc)); } else { setDeckCards([...deckCards,{ card:existingSource.card, quantity:qty }]); } if(id){ removeDeckCardMutation.mutate({ deckId:id, cardId:payload.deckCardId, board:payload.sourceBoard}); const newQty=(mainExisting? mainExisting.quantity+qty: qty); addDeckCardMutation.mutate({ deckId:id, cardId:payload.deckCardId, quantity:newQty, board:'main'}); } } } setIsOverMain(false); };
  const onDropSide=(e:React.DragEvent)=>{ e.preventDefault(); const payload=parseDropData(e); if(!payload){ setIsOverSide(false); return;} if(payload.card){ addCardToDeck(payload.card,1,'side'); } else if(payload.deckCardId && payload.sourceBoard && payload.sourceBoard!=='side'){ const sourceList = payload.sourceBoard==='main'? deckCards : maybeBoardCards; const sourceSet = payload.sourceBoard==='main'? setDeckCards : setMaybeBoardCards; const existingSource=sourceList.find(dc=>dc.card.id===payload.deckCardId); if(existingSource){ const qty=existingSource.quantity; sourceSet(sourceList.filter(dc=>dc.card.id!==payload.deckCardId)); const sideExisting=sideboardCards.find(dc=>dc.card.id===payload.deckCardId); if(sideExisting){ setSideboardCards(sideboardCards.map(dc=>dc.card.id===payload.deckCardId?{...dc,quantity:dc.quantity+qty}:dc)); } else { setSideboardCards([...sideboardCards,{ card:existingSource.card, quantity:qty }]); } if(id){ removeDeckCardMutation.mutate({ deckId:id, cardId:payload.deckCardId, board:payload.sourceBoard}); const newQty=(sideExisting? sideExisting.quantity+qty: qty); addDeckCardMutation.mutate({ deckId:id, cardId:payload.deckCardId, quantity:newQty, board:'side'}); } } } setIsOverSide(false); };
  const onDropMaybe=(e:React.DragEvent)=>{ e.preventDefault(); const payload=parseDropData(e); if(!payload){ return;} if(payload.card){ addCardToDeck(payload.card,1,'maybe'); } else if(payload.deckCardId && payload.sourceBoard && payload.sourceBoard!=='maybe'){ const sourceList = payload.sourceBoard==='main'? deckCards : sideboardCards; const sourceSet = payload.sourceBoard==='main'? setDeckCards : setSideboardCards; const existingSource=sourceList.find(dc=>dc.card.id===payload.deckCardId); if(existingSource){ const qty=existingSource.quantity; sourceSet(sourceList.filter(dc=>dc.card.id!==payload.deckCardId)); const maybeExisting=maybeBoardCards.find(dc=>dc.card.id===payload.deckCardId); if(maybeExisting){ setMaybeBoardCards(maybeBoardCards.map(dc=>dc.card.id===payload.deckCardId?{...dc,quantity:dc.quantity+qty}:dc)); } else { setMaybeBoardCards([...maybeBoardCards,{ card:existingSource.card, quantity:qty }]); } if(id){ removeDeckCardMutation.mutate({ deckId:id, cardId:payload.deckCardId, board:payload.sourceBoard}); const newQty=(maybeExisting? maybeExisting.quantity+qty: qty); addDeckCardMutation.mutate({ deckId:id, cardId:payload.deckCardId, quantity:newQty, board:'maybe'}); } } } };

  const BASIC_NAMES: Record<string,string>={ W:'Plains',U:'Island',B:'Swamp',R:'Mountain',G:'Forest' };
  const mainCount=deckCards.reduce((s,dc)=>s+dc.quantity,0); const sideCount=sideboardCards.reduce((s,dc)=>s+dc.quantity,0); const landsInDeck=deckCards.filter(dc=>isLand(dc.card)).reduce((s,dc)=>s+dc.quantity,0);
  const computeCopyViolations=()=>{ const byOracle:Record<string,number>={}; deckCards.forEach(dc=>{ const oid=dc.card?.oracleId||dc.card?.id; if(!oid) return; byOracle[oid]=(byOracle[oid]||0)+dc.quantity; }); const violations:string[]=[]; const limit=copyLimitFor(selectedFormat); Object.entries(byOracle).forEach(([oid,qty])=>{ const dc=deckCards.find(d=>(d.card?.oracleId||d.card?.id)===oid); const nm=dc?.card?.nameFr||dc?.card?.name||'Carte'; const isBasic=['Plains','Island','Swamp','Mountain','Forest','Wastes'].includes(dc?.card?.name||''); if(!isBasic && qty>limit) violations.push(`${nm} (${qty} > ${limit})`); }); return violations; };
  const banViolations=()=>{ const fmt = selectedFormat as DeckFormat; const list = (BANLIST as Record<DeckFormat, string[]>)[fmt] || []; const banned=new Set(list.map((n:string)=>n.toLowerCase())); const hits:string[]=[]; deckCards.forEach(dc=>{ const nm=(dc.card?.nameFr||dc.card?.name||'').toLowerCase(); if(banned.has(nm)) hits.push(dc.card?.nameFr||dc.card?.name); }); return hits; };
  const parseManaPips=(manaCost?:string)=>{ const res={W:0,U:0,B:0,R:0,G:0} as Record<'W'|'U'|'B'|'R'|'G',number>; if(!manaCost) return res; const matches=manaCost.match(/\{([^}]+)\}/g)||[]; for(const m of matches){ const sym=m.replace(/[{}]/g,''); if(['W','U','B','R','G'].includes(sym)) res[sym as keyof typeof res]+=1; else if(sym.includes('/')){ const parts=sym.split('/').filter(p=>['W','U','B','R','G'].includes(p)); if(parts.length){ const share=1/parts.length; parts.forEach(p=>{ res[p as keyof typeof res]+=share; }); } } } return res; };
  const colorDemand=useMemo(()=>{ const total={W:0,U:0,B:0,R:0,G:0} as Record<'W'|'U'|'B'|'R'|'G',number>; deckCards.forEach(dc=>{ if(isLand(dc.card)) return; const p=parseManaPips(dc.card?.manaCost); (Object.keys(total) as Array<keyof typeof total>).forEach(k=>{ total[k]+=p[k]*dc.quantity; }); }); return total; },[deckCards]);
  const landTarget=useMemo(()=>{ const fmt = selectedFormat as DeckFormat; if(SINGLETON_FORMATS.has(fmt)) return deckStats.avgCmc>3.2?37:deckStats.avgCmc<2.5?35:36; const cmc=deckStats.avgCmc; if(cmc<2.2) return 22; if(cmc<2.6) return 23; if(cmc<3.0) return 24; if(cmc<3.4) return 25; return 26; },[selectedFormat, deckStats.avgCmc]);
  const currentBasicCounts=useMemo(()=>{ const counts={W:0,U:0,B:0,R:0,G:0} as Record<'W'|'U'|'B'|'R'|'G',number>; deckCards.forEach(dc=>{ const name=(dc.card?.name||'').toLowerCase(); if(name==='plains') counts.W+=dc.quantity; if(name==='island') counts.U+=dc.quantity; if(name==='swamp') counts.B+=dc.quantity; if(name==='mountain') counts.R+=dc.quantity; if(name==='forest') counts.G+=dc.quantity; }); return counts; },[deckCards]);
  const suggestedBasics=useMemo(()=>{ const totalDemand=Object.values(colorDemand).reduce((s,v)=>s+v,0); const toAllocate=Math.max(0, landTarget - deckCards.filter(dc=>isLand(dc.card)).reduce((s,dc)=>s+dc.quantity,0)); if(toAllocate<=0||totalDemand===0) return {W:0,U:0,B:0,R:0,G:0} as Record<'W'|'U'|'B'|'R'|'G',number>; const raw={W:0,U:0,B:0,R:0,G:0} as Record<'W'|'U'|'B'|'R'|'G',number>; (Object.keys(colorDemand) as Array<keyof typeof colorDemand>).forEach(k=>{ raw[k]=Math.round((colorDemand[k]/totalDemand)*toAllocate); }); let diff=toAllocate-Object.values(raw).reduce((s,v)=>s+v,0); const order=['W','U','B','R','G'] as const; let idx=0; while(diff!==0){ raw[order[idx%5]]+= diff>0?1:-1; diff+= diff>0?-1:1; idx++; if(idx>25) break; } const final={W:0,U:0,B:0,R:0,G:0} as Record<'W'|'U'|'B'|'R'|'G',number>; order.forEach(k=>{ final[k]=Math.max(0, raw[k]-currentBasicCounts[k]); }); return final; },[colorDemand, landTarget, currentBasicCounts, deckCards]);
  const applyManaSuggestions=async()=>{
    try {
      let added=0;
      for(const [k,qty] of Object.entries(suggestedBasics)){
        const q=qty as number; if(q<=0) continue;
        const name=BASIC_NAMES[k];
        // Primary: FTS
        let res=await cardsService.getCardsFts(name,5);
        let candidate=(res.cards||[]).find((c:any)=>(c.name===name)||(c.typeLine||'').includes('Basic Land')) || (res.cards||[])[0];
        // Fallback: generic search endpoint if FTS failed
        if(!candidate){
          const generic=await cardsService.getCards(1,10,name);
          candidate=(generic.cards||[]).find((c:any)=>(c.name===name)||(c.typeLine||'').includes('Basic Land')) || (generic.cards||[])[0];
        }
        if(candidate){ addCardToDeck(candidate,q,'main'); added+=q; }
      }
      if(added>0) toast.success('Suggestions de terrains appliquées'); else toast('Aucune carte de terrain de base trouvée');
    } catch { toast.error('Impossible d\'appliquer les terrains'); }
  };
  const colorChartData=useMemo(()=>({ labels:['Blanc','Bleu','Noir','Rouge','Vert','Incolore'], datasets:[{ data:Object.values(deckStats.colorDistribution), backgroundColor:['#FFFBD5','#0E68AB','#150B00','#D3202A','#00733E','#CCCCCC'], borderWidth:2, borderColor:'#374151' }] }),[deckStats.colorDistribution]);
  const manaCurveChartData=useMemo(()=>({ labels:['0','1','2','3','4','5','6','7+'], datasets:[{ label:'Nombre de cartes', data:deckStats.manaCurve, backgroundColor:'#E49B0F', borderColor:'#B8860B', borderWidth:1 }] }),[deckStats.manaCurve]);

  const filteredMain=useMemo(()=> ownedFilter==='all'?deckCards: deckCards.filter(dc=> ownedFilter==='owned'? isOwnedByOracle(dc.card?.oracleId, dc.card?.id): !isOwnedByOracle(dc.card?.oracleId, dc.card?.id)), [deckCards, ownedFilter, isOwnedByOracle]);
  const filteredSide=useMemo(()=> ownedFilter==='all'?sideboardCards: sideboardCards.filter(dc=> ownedFilter==='owned'? isOwnedByOracle(dc.card?.oracleId, dc.card?.id): !isOwnedByOracle(dc.card?.oracleId, dc.card?.id)), [sideboardCards, ownedFilter, isOwnedByOracle]);
  const filteredMaybe=useMemo(()=> ownedFilter==='all'?maybeBoardCards: maybeBoardCards.filter(dc=> ownedFilter==='owned'? isOwnedByOracle(dc.card?.oracleId, dc.card?.id): !isOwnedByOracle(dc.card?.oracleId, dc.card?.id)), [maybeBoardCards, ownedFilter, isOwnedByOracle]);

  if(deckLoading) return <div className="flex justify-center items-center min-h-96"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="text" value={deckName} onChange={e=>setDeckName(e.target.value)} className="text-3xl font-bold bg-transparent text-white border-none outline-none focus:text-mtg-primary transition-colors" placeholder="Nom du deck" />
            {/* Local legality badge */}
            {(() => {
              const issues: string[] = [];
              const min = MAIN_MINIMUM[selectedFormat] || 60;
              if (mainCount < min) issues.push(`Main ${mainCount}/${min}`);
              if (SIDEBOARD_LIMIT[selectedFormat] && sideCount > SIDEBOARD_LIMIT[selectedFormat]) issues.push(`Side ${sideCount}/${SIDEBOARD_LIMIT[selectedFormat]}`);
              const copies = computeCopyViolations();
              if (copies.length) issues.push(`${copies.length} copie(s)`);
              const banned = banViolations();
              if (banned.length) issues.push(`${banned.length} bannie(s)`);
              const legal = issues.length === 0;
              return (
                <div
                  className={`text-xs font-semibold rounded-full px-3 py-1 border flex items-center gap-1 ${legal ? 'bg-mtg-green text-black border-mtg-green' : 'bg-red-700/70 text-white border-red-600'}`}
                  title={legal ? 'Aucun problème détecté localement' : issues.join('\n')}
                >
                  {legal ? 'Légal (local)' : `Problèmes: ${issues.length}`}
                </div>
              );
            })()}
            {/* Server legality badge (cached) */}
            {serverValidation && (
              <div
                className={`text-xs font-semibold rounded-full px-3 py-1 border flex items-center gap-1 ${serverValidation.valid ? 'bg-mtg-green/80 text-black border-mtg-green' : 'bg-red-800/70 text-white border-red-700'}`}
                title={serverValidation.valid ? 'Serveur: aucun problème enregistré' : serverValidation.issues.join('\n')}
              >
                {serverValidation.valid ? 'Légal (serveur)' : `Serveur: ${serverValidation.issues.length}`}
              </div>
            )}
            {/* Owned percentage */}
            {(() => {
              const ownedMatch = deckCards.reduce((sum, dc) => {
                const hold = ownedMap[dc.card.oracleId || dc.card.id];
                const have = hold ? hold.quantity + hold.quantityFoil : 0;
                return sum + Math.min(have, dc.quantity);
              }, 0);
              const pct = mainCount ? Math.round((ownedMatch / mainCount) * 100) : 0;
              return <div className="text-xs font-medium px-2 py-1 rounded bg-mtg-surface border border-gray-700" title="Proportion de cartes principales réellement possédées">Possédé {pct}%</div>;
            })()}
            {/* Progress toward minimum */}
            {(() => {
              const required = MAIN_MINIMUM[selectedFormat] || 60;
              const ratio = Math.min(1, mainCount / required);
              return (
                <div className="flex items-center gap-1" title={`Progression ${mainCount}/${required}`}>
                  <div className="h-3 w-32 bg-gray-700 rounded overflow-hidden">
                    <div className={`h-full ${ratio>=1?'bg-mtg-green':'bg-mtg-primary'} transition-all`} style={{ width: `${ratio*100}%` }} />
                  </div>
                  <span className="text-2xs text-gray-300">{mainCount}/{required}</span>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <select value={selectedFormat} onChange={e=>setSelectedFormat(e.target.value as DeckFormat)} className="px-3 py-1 bg-mtg-surface border border-gray-700 rounded-lg text-white text-sm focus:border-mtg-primary focus:outline-none">
              {formats.map(f=> <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={selectedArchetype} onChange={e=>setSelectedArchetype(e.target.value)} className="px-3 py-1 bg-mtg-surface border border-gray-700 rounded-lg text-white text-sm focus:border-mtg-primary focus:outline-none">
              <option value="">Sélectionner un archétype</option>
              {archetypes.map(a=> <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {existingDeck?.colors?.length>0 && <div className="flex items-center gap-1 mt-2">{existingDeck.colors.map((c:string)=><ManaSymbol key={(existingDeck as any).id + c} symbol={c} size="sm" />)}</div>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-outline flex items-center" onClick={handleImportMTGA}><Upload className="w-4 h-4 mr-2" />Importer</button>
          <button className="btn-outline flex items-center" onClick={handleExportMTGA}><Download className="w-4 h-4 mr-2" />Exporter</button>
          <button className="btn-outline flex items-center" onClick={applyManaSuggestions} disabled={Object.values(suggestedBasics).every(v=>v===0)} title="Appliquer une base de terrains suggérée"><span className="w-4 h-4 mr-2">🌱</span>Auto-terrains</button>
          <button className="btn-primary flex items-center" onClick={handleSaveDeck} disabled={saveDeckMutation.isPending}><Save className="w-4 h-4 mr-2" />Sauvegarder</button>
          {id && <button className="btn-outline text-xs" onClick={refreshServerValidation}>Rafraîchir validation</button>}
        </div>
      </div>

      <div className="card p-1 inline-flex">
        <button onClick={()=>setActiveView('cards')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView==='cards'?'bg-mtg-primary text-mtg-black':'text-gray-400 hover:text-white'}`}><Search className="w-4 h-4 mr-2" />Cartes</button>
        <button onClick={()=>setActiveView('stats')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView==='stats'?'bg-mtg-primary text-mtg-black':'text-gray-400 hover:text-white'}`}><BarChart3 className="w-4 h-4 mr-2" />Statistiques</button>
        <button onClick={()=>setActiveView('visual')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView==='visual'?'bg-mtg-primary text-mtg-black':'text-gray-400 hover:text-white'}`}><Eye className="w-4 h-4 mr-2" />Aperçu visuel</button>
      </div>

      {activeView==='stats' && (
        <Suspense fallback={<div className="text-gray-400 mt-4">Chargement des graphiques...</div>}>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-mtg-surface p-4 rounded-lg border border-gray-700">
              <h3 className="text-white font-semibold mb-2">Répartition des couleurs</h3>
              <Pie data={colorChartData} />
            </div>
            <div className="bg-mtg-surface p-4 rounded-lg border border-gray-700">
              <h3 className="text-white font-semibold mb-2">Courbe de mana</h3>
              <Bar data={manaCurveChartData} />
            </div>
          </div>
        </Suspense>
      )}

      {activeView==='cards' && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3 gap-4">
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Rechercher des cartes (min 2 caractères)" className="w-full px-3 py-2 bg-mtg-background border border-gray-700 rounded text-white placeholder-gray-400 focus:border-mtg-primary focus:outline-none" />
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Possession:</span>
              <div className="inline-flex rounded-lg overflow-hidden border border-gray-700">
                <button className={`px-2 py-1 text-xs ${ownedFilter==='all'?'bg-mtg-primary text-black':'text-gray-300 hover:text-white'}`} onClick={()=>setOwnedFilter('all')}>Toutes</button>
                <button className={`px-2 py-1 text-xs ${ownedFilter==='owned'?'bg-mtg-primary text-black':'text-gray-300 hover:text-white'}`} onClick={()=>setOwnedFilter('owned')}>Possédées</button>
                <button className={`px-2 py-1 text-xs ${ownedFilter==='unowned'?'bg-mtg-primary text-black':'text-gray-300 hover:text-white'}`} onClick={()=>setOwnedFilter('unowned')}>Manquantes</button>
              </div>
            </div>
          </div>
          {/* Advanced filters */}
          <details className="mb-3 group" open={false}>
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-white flex items-center gap-2">Filtres avancés <span className="opacity-50 group-open:rotate-180 transition-transform">▼</span></summary>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="font-semibold mb-1">Couleurs</div>
                <div className="flex flex-wrap gap-1">
                  {['W','U','B','R','G','C'].map(c => {
                    const active = advColors.includes(c);
                    return <button key={c} onClick={()=> setAdvColors(active? advColors.filter(x=>x!==c): [...advColors,c])} className={`px-2 py-1 rounded border text-2xs ${active? 'bg-mtg-primary text-black border-mtg-primary':'border-gray-700 text-gray-300 hover:text-white'}`}>{c}</button>;
                  })}
                  {advColors.length>0 && <button onClick={()=>setAdvColors([])} className="px-2 py-1 rounded border border-gray-700 text-2xs text-gray-400 hover:text-white">Reset</button>}
                </div>
              </div>
              <div>
                <label className="font-semibold mb-1 block">Rareté</label>
                <select value={advRarity} onChange={e=>setAdvRarity(e.target.value)} className="w-full bg-mtg-background border border-gray-700 rounded px-2 py-1">
                  <option value="">(toutes)</option>
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="mythic">Mythic</option>
                </select>
              </div>
              <div>
                <label className="font-semibold mb-1 block">Type contient</label>
                <input value={advTypeContains} onChange={e=>setAdvTypeContains(e.target.value)} placeholder="ex: Creature" className="w-full bg-mtg-background border border-gray-700 rounded px-2 py-1" />
              </div>
              <div>
                <label className="font-semibold mb-1 block">Prix EUR</label>
                <div className="flex gap-2">
                  <input value={advPriceMin} onChange={e=>setAdvPriceMin(e.target.value)} placeholder="min" className="w-20 bg-mtg-background border border-gray-700 rounded px-2 py-1" />
                  <input value={advPriceMax} onChange={e=>setAdvPriceMax(e.target.value)} placeholder="max" className="w-20 bg-mtg-background border border-gray-700 rounded px-2 py-1" />
                  <button onClick={()=>{ setAdvPriceMin(''); setAdvPriceMax(''); }} className="px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white">×</button>
                </div>
              </div>
            </div>
          </details>
          {cardsLoading ? (
            <div className="space-y-2">{Array.from({length:8}).map((_,i)=><div key={i} className="h-18 bg-gray-800 animate-pulse rounded-lg" />)}</div>
          ) : filteredSearchResults.length>0 ? (
            <VList height={480} itemCount={filteredSearchResults.length} itemSize={80} width="100%">
              {({index, style}:ListChildComponentProps)=>{ const card=filteredSearchResults[index]; return (
                <div style={style} key={card.id} className="px-0.5">
                  <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="p-0 bg-mtg-surface rounded-lg hover:bg-opacity-80 transition-colors group h-full">
                    <div className="flex items-center gap-3 p-3" draggable onDragStart={e=>handleDragStart(e,card)}>
                      {card.imageUris ? <img src={typeof card.imageUris==='string'? JSON.parse(card.imageUris).small : card.imageUris.small} alt={card.name} className="w-12 h-16 object-cover rounded" loading="lazy" decoding="async" /> : <div className="w-12 h-16 rounded bg-gray-800" /> }
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{card.nameFr||card.name}</div>
                        <div className="text-sm text-gray-400 truncate">{card.typeLineFr||card.typeLine}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {card.oracleId && ownedMap[card.oracleId] && <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-mtg-green text-black">{ownedMap[card.oracleId].quantity + ownedMap[card.oracleId].quantityFoil}</span>}
                        <button onClick={()=>addCardToDeck(card,1,'main')} className="btn-primary px-2 py-1 text-xs">Main</button>
                        <button onClick={()=>addCardToDeck(card,1,'side')} className="btn-outline px-2 py-1 text-xs">Side</button>
                        <button onClick={()=>addCardToDeck(card,1,'maybe')} className="btn-outline px-2 py-1 text-xs">Maybe</button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ); }}
            </VList>
          ) : (
            <div className="text-center py-8 text-gray-400">{debouncedSearchQuery.length>=2? 'Aucun résultat':'Tapez au moins 2 caractères pour rechercher'}</div>
          )}
        </div>
      )}

      {/* Mainboard */}
      <div className={`card p-4 border ${isOverMain?'border-mtg-primary':'border-transparent'}`} onDragOver={onDragOverZone} onDragEnter={()=>setIsOverMain(true)} onDragLeave={()=>setIsOverMain(false)} onDrop={onDropMain}>
        <h3 className="text-lg font-semibold text-white mb-3">Deck principal ({deckStats.totalCards})</h3>
        <VList height={300} itemCount={filteredMain.length} itemSize={80} width="100%">
          {({index, style}:ListChildComponentProps)=>{ const deckCard=filteredMain[index]; const owned=ownedMap[deckCard.card.oracleId||deckCard.card.id]; return (
            <div style={style} key={deckCard.card.id} className="px-0.5">
              <motion.div initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} className={`p-0 bg-mtg-surface rounded-lg hover:bg-opacity-80 transition-colors h-full ${!isOwnedByOracle(deckCard.card?.oracleId, deckCard.card?.id)?'ring-1 ring-red-700/50':''}`}>
                <div className="flex items-center justify-between p-3" draggable onDragStart={e=>handleDragStartDeck(e,deckCard,'main')}>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm font-medium text-mtg-accent w-8">{deckCard.quantity}x</span>
                    {deckCard.card.imageUris ? <img src={typeof deckCard.card.imageUris==='string'? JSON.parse(deckCard.card.imageUris).small : deckCard.card.imageUris.small} alt={deckCard.card.name} className="w-12 h-16 object-cover rounded" loading="lazy" decoding="async" /> : <div className="w-12 h-16 rounded bg-gray-800" /> }
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{deckCard.card.nameFr || deckCard.card.name}</div>
                      <div className="text-sm text-gray-400 truncate">{deckCard.card.typeLineFr || deckCard.card.typeLine}</div>
                    </div>
                    {owned && <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-mtg-green text-black">{owned.quantity + owned.quantityFoil}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>updateCardQuantity(deckCard.card.id, deckCard.quantity-1,'main')} className="btn-icon-sm bg-red-600 hover:bg-red-700">-</button>
                    <button onClick={()=>updateCardQuantity(deckCard.card.id, deckCard.quantity+1,'main')} className="btn-icon-sm bg-green-600 hover:bg-green-700">+</button>
                    <button onClick={()=>removeCardFromDeck(deckCard.card.id,'main')} className="btn-outline px-2 py-1 text-xs">Retirer</button>
                  </div>
                </div>
              </motion.div>
            </div>
          ); }}
        </VList>
      </div>

      {/* Sideboard */}
      <div className={`card p-4 border ${isOverSide?'border-mtg-secondary':'border-transparent'}`} onDragOver={onDragOverZone} onDragEnter={()=>setIsOverSide(true)} onDragLeave={()=>setIsOverSide(false)} onDrop={onDropSide}>
        <h3 className="text-lg font-semibold text-white mb-3">Sideboard ({deckStats.totalSideboard})</h3>
        <VList height={240} itemCount={filteredSide.length} itemSize={80} width="100%">
          {({index, style}:ListChildComponentProps)=>{ const deckCard=filteredSide[index]; const owned=ownedMap[deckCard.card.oracleId||deckCard.card.id]; return (
            <div style={style} key={deckCard.card.id} className="px-0.5">
              <motion.div initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} className={`p-0 bg-mtg-surface rounded-lg hover:bg-opacity-80 transition-colors h-full ${!isOwnedByOracle(deckCard.card?.oracleId, deckCard.card?.id)?'ring-1 ring-red-700/50':''}`}>
                <div className="flex items-center justify-between p-3" draggable onDragStart={e=>handleDragStartDeck(e,deckCard,'side')}>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm font-medium text-mtg-accent w-8">{deckCard.quantity}x</span>
                    {deckCard.card.imageUris ? <img src={typeof deckCard.card.imageUris==='string'? JSON.parse(deckCard.card.imageUris).small : deckCard.card.imageUris.small} alt={deckCard.card.name} className="w-12 h-16 object-cover rounded" loading="lazy" decoding="async" /> : <div className="w-12 h-16 rounded bg-gray-800" /> }
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{deckCard.card.nameFr || deckCard.card.name}</div>
                      <div className="text-sm text-gray-400 truncate">{deckCard.card.typeLineFr || deckCard.card.typeLine}</div>
                    </div>
                    {owned && <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-mtg-green text-black">{owned.quantity + owned.quantityFoil}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>updateCardQuantity(deckCard.card.id, deckCard.quantity-1,'side')} className="btn-icon-sm bg-red-600 hover:bg-red-700">-</button>
                    <button onClick={()=>updateCardQuantity(deckCard.card.id, deckCard.quantity+1,'side')} className="btn-icon-sm bg-green-600 hover:bg-green-700">+</button>
                    <button onClick={()=>removeCardFromDeck(deckCard.card.id,'side')} className="btn-outline px-2 py-1 text-xs">Retirer</button>
                  </div>
                </div>
              </motion.div>
            </div>
          ); }}
        </VList>
      </div>

      {/* Maybeboard */}
      <div className="card p-4" onDragOver={onDragOverZone} onDrop={onDropMaybe}>
        <h3 className="text-lg font-semibold text-white mb-3">Maybeboard ({filteredMaybe.reduce((s,dc)=>s+dc.quantity,0)})</h3>
        <VList height={200} itemCount={filteredMaybe.length} itemSize={80} width="100%">
          {({index, style}:ListChildComponentProps)=>{ const deckCard=filteredMaybe[index]; const owned=ownedMap[deckCard.card.oracleId||deckCard.card.id]; return (
            <div style={style} key={deckCard.card.id} className="px-0.5">
              <motion.div initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} className={`p-0 bg-mtg-surface rounded-lg hover:bg-opacity-80 transition-colors h-full ${!isOwnedByOracle(deckCard.card?.oracleId, deckCard.card?.id)?'ring-1 ring-red-700/50':''}`}>
                <div className="flex items-center justify-between p-3" draggable onDragStart={e=>handleDragStartDeck(e,deckCard,'maybe')}>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm font-medium text-mtg-accent w-8">{deckCard.quantity}x</span>
                    {deckCard.card.imageUris ? <img src={typeof deckCard.card.imageUris==='string'? JSON.parse(deckCard.card.imageUris).small : deckCard.card.imageUris.small} alt={deckCard.card.name} className="w-12 h-16 object-cover rounded" loading="lazy" decoding="async" /> : <div className="w-12 h-16 rounded bg-gray-800" /> }
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{deckCard.card.nameFr || deckCard.card.name}</div>
                      <div className="text-sm text-gray-400 truncate">{deckCard.card.typeLineFr || deckCard.card.typeLine}</div>
                    </div>
                    {owned && <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-mtg-green text-black">{owned.quantity + owned.quantityFoil}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>updateCardQuantity(deckCard.card.id, deckCard.quantity-1,'maybe')} className="btn-icon-sm bg-red-600 hover:bg-red-700">-</button>
                    <button onClick={()=>updateCardQuantity(deckCard.card.id, deckCard.quantity+1,'maybe')} className="btn-icon-sm bg-green-600 hover:bg-green-700">+</button>
                    <button onClick={()=>removeCardFromDeck(deckCard.card.id,'maybe')} className="btn-outline px-2 py-1 text-xs">Retirer</button>
                  </div>
                </div>
              </motion.div>
            </div>
          ); }}
        </VList>
      </div>

      {activeView==='visual' && (
        <motion.div key="visual" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Aperçu visuel du deck</h3>
          {deckCards.length>0 ? (
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
              {deckCards.map(dc=>{ const card=dc.card; let img:string|undefined; const iu=card?.imageUris; if(iu){ if(typeof iu==='string'){ try{ img=JSON.parse(iu)?.small || JSON.parse(iu)?.normal; }catch{} } else { img=iu.small || iu.normal; } } return (
                <div key={card.id} className="relative">
                  {img ? <img src={img} alt={card.name} className="w-full rounded" loading="lazy" decoding="async" /> : <div className="aspect-[2/3] w-full rounded bg-gray-800" />}
                  {dc.quantity>1 && <span className="absolute -top-2 -right-2 w-6 h-6 bg-mtg-primary text-mtg-black text-xs font-bold rounded-full flex items-center justify-center">{dc.quantity}</span>}
                </div>
              ); })}
            </div>
          ) : <div className="text-gray-400">Aucune carte dans le deck.</div>}
        </motion.div>
      )}

      {activeView==='stats' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Statistiques générales</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center"><div className="text-2xl font-bold text-mtg-primary">{deckStats.totalCards}</div><div className="text-sm text-gray-400">Cartes main</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-mtg-secondary">{deckStats.totalSideboard}</div><div className="text-sm text-gray-400">Sideboard</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-mtg-accent">{deckStats.avgCmc.toFixed(1)}</div><div className="text-sm text-gray-400">CMC moyen</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-mtg-green">{deckStats.typeDistribution.Land}</div><div className="text-sm text-gray-400">Terrains</div></div>
            </div>
          </div>
          <div className="card p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Conseils & Légalité ({selectedFormat})</h4>
            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-200">
              {mainCount < (MAIN_MINIMUM[selectedFormat] || 60) && <li>Nombre de cartes insuffisant en main ({mainCount}/{MAIN_MINIMUM[selectedFormat] || 60}).</li>}
              {(SIDEBOARD_LIMIT as any)[selectedFormat] && sideCount > (SIDEBOARD_LIMIT as any)[selectedFormat] && <li>Sideboard trop grand ({sideCount}/{(SIDEBOARD_LIMIT as any)[selectedFormat]} max).</li>}
              {computeCopyViolations().length>0 && <li>Copies excédentaires: {computeCopyViolations().join(', ')}.</li>}
              {banViolations().length>0 && <li>Cartes bannies: {banViolations().join(', ')}.</li>}
              {landsInDeck < landTarget && <li>Trop peu de terrains: {landsInDeck} / {landTarget} recommandés.</li>}
              {deckStats.avgCmc > 3.2 && <li>Courbe lourde (CMC moyen {deckStats.avgCmc.toFixed(2)}): ajoutez des sorts à bas coût.</li>}
              {deckStats.manaCurve[0] + deckStats.manaCurve[1] < 8 && mainCount >= (MAIN_MINIMUM[selectedFormat] || 60) && <li>Peu de sorts à 0-1 mana: envisagez d'accélérer la courbe.</li>}
              {computeCopyViolations().length===0 && banViolations().length===0 && mainCount >= (MAIN_MINIMUM[selectedFormat] || 60) && sideCount <= (SIDEBOARD_LIMIT[selectedFormat] || 15) && <li className="text-mtg-green">Pas de problème de légalité détecté.</li>}
            </ul>
          </div>
          <div className="card p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Suggestions de mana base</h4>
            <div className="text-sm text-gray-300 mb-3">Objectif terrains: {landTarget} (actuels: {landsInDeck})</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              {(['W','U','B','R','G'] as const).map(k=> <div key={k} className="bg-mtg-surface rounded p-2 border border-gray-700"><div className="font-medium">{BASIC_NAMES[k]}</div><div>Demande: {Math.round(colorDemand[k])}</div><div>Ajouter: {suggestedBasics[k]}</div></div>)}
            </div>
            <div className="mt-3"><button className="btn-primary" onClick={applyManaSuggestions} disabled={Object.values(suggestedBasics).every(v=>v===0)}>Appliquer les terrains de base</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckBuilderPage;
