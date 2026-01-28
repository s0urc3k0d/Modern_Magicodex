import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Eye, Sparkles, ShoppingCart } from 'lucide-react';
import type { Card, UserCard, ListType, UserListItem } from '../types';
import { ManaCost } from './ManaSymbol';
import { normalizeCardBasics, pickCardImageUrl, getCardPriceEUR } from '../domain/cards/normalize';

interface CardDisplayProps {
  card: Card;
  userCard?: UserCard | null;
  onAddToCollection?: (cardId: string, quantity: number, foil?: boolean) => void;
  onUpdateQuantity?: (cardId: string, newQuantity: number, newQuantityFoil: number) => void;
  onToggleListItem?: (cardId: string, type: ListType) => Promise<UserListItem | null> | void;
  onAddToSale?: (cardId: string) => void;
  showQuantityControls?: boolean;
  viewMode?: 'grid' | 'list';
}

const CardDisplay = ({
  card,
  userCard,
  onAddToCollection,
  onUpdateQuantity,
  onToggleListItem,
  onAddToSale,
  showQuantityControls = true,
  viewMode = 'grid'
}: CardDisplayProps) => {
  const [showFullImage, setShowFullImage] = useState(false);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isOwned = userCard && (userCard.quantity > 0 || userCard.quantityFoil > 0);
  const totalQuantity = (userCard?.quantity || 0) + (userCard?.quantityFoil || 0);

  // Normalisation des données JSON
  const { imageUris, prices } = normalizeCardBasics(card as any);

  // Obtenir l'URL de l'image appropriée
  const getImageUrl = () => {
    return pickCardImageUrl(imageUris, 'normal');
  };
  const getSmallUrl = () => {
    return pickCardImageUrl(imageUris, 'small');
  };

  // Formatage du coût de mana
  const formatManaCost = (manaCost?: string) => {
    if (!manaCost) return null;
    
    return <ManaCost manaCost={manaCost} size="sm" />;
  };

  // Small helper to toggle list items (wishlist/trade)
  const handleToggleList = (type: ListType) => {
    if (onToggleListItem) {
      const r = onToggleListItem(card.id, type);
      if (r && typeof (r as any).then === 'function') {
        (r as Promise<any>).catch(() => {});
      }
    }
  };

  // Rendu en mode grille
  if (viewMode === 'grid') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gray-800 rounded-lg overflow-hidden border transition-all duration-200 hover:shadow-lg ${
          isOwned 
            ? 'border-mtg-gold shadow-mtg-gold/20' 
            : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        {/* Image de la carte */}
        <div className="relative aspect-[5/7] bg-gray-900 overflow-hidden">
          {getImageUrl() && !imageError ? (
            <>
              {/* Blurred small placeholder */}
              {getSmallUrl() && (
                <img
                  src={getSmallUrl() ?? undefined}
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover blur-sm scale-105 transition-opacity duration-300 ${
                    fullImageLoaded ? 'opacity-0' : 'opacity-100'
                  }`}
                  onLoad={() => setThumbLoaded(true)}
                  loading="lazy"
                  decoding="async"
                />
              )}

              {/* Full image */}
              <img
                src={getImageUrl() ?? undefined}
                alt={card.nameFr || card.name}
                className={`relative z-10 w-full h-full object-cover transition-opacity duration-300 ${
                  fullImageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setFullImageLoaded(true)}
                onError={() => setImageError(true)}
                onClick={() => setShowFullImage(true)}
                loading="lazy"
                decoding="async"
              />

              {/* Skeleton while loading */}
              {!fullImageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse" />
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <span className="text-sm">Image non disponible</span>
              </div>
            </div>
          )}
          
          {/* Badge de quantité possédée */}
          {isOwned && (
            <div className="absolute top-2 right-2 bg-mtg-gold text-black px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              {userCard?.quantityFoil > 0 && <Sparkles className="h-3 w-3" />}
              {totalQuantity}
            </div>
          )}
          
          {/* Badge de rareté */}
          <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold ${
            card.rarity === 'mythic' ? 'bg-orange-500 text-white' :
            card.rarity === 'rare' ? 'bg-yellow-500 text-black' :
            card.rarity === 'uncommon' ? 'bg-gray-400 text-black' :
            'bg-gray-600 text-white'
          }`}>
            {card.rarity.charAt(0).toUpperCase()}
          </div>
        </div>

  {/* Informations de la carte */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-white text-sm truncate">
              {card.nameFr || card.name}
            </h3>
            {formatManaCost(card.manaCost)}
          </div>
          
          <p className="text-gray-400 text-xs mb-2 truncate">
            {card.typeLineFr || card.typeLine}
          </p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{card.set.code.toUpperCase()} #{card.collectorNumber}</span>
            {((card as any).priceEur ?? null) !== null && (card as any).priceEur !== undefined ? (
              <span className="text-mtg-gold font-medium">{Number((card as any).priceEur).toFixed(2)}€</span>
            ) : getCardPriceEUR(prices) !== null && (
              <span className="text-mtg-gold font-medium">
                {getCardPriceEUR(prices)!.toFixed(2)}€
              </span>
            )}
          </div>

          {/* Wishlist / Trade quick actions */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button
              title="Ajouter/retirer de la Wishlist"
              onClick={() => handleToggleList('WISHLIST')}
              className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Wishlist
            </button>
            <button
              title="Ajouter/retirer de la Trade list"
              onClick={() => handleToggleList('TRADE')}
              className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Trade
            </button>
            {onAddToSale && isOwned && (
              <button
                title="Mettre en vente"
                onClick={() => onAddToSale(card.id)}
                className="text-xs px-2 py-1 rounded border border-mtg-gold text-mtg-gold hover:bg-mtg-gold hover:text-mtg-black flex items-center gap-1"
              >
                <ShoppingCart className="w-3 h-3" />
                Vendre
              </button>
            )}
          </div>

          {/* Contrôles de quantité */}
          {showQuantityControls && (
            <div className="mt-3 flex items-center justify-between">
              {isOwned ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newQuantity = Math.max(0, (userCard?.quantity || 0) - 1);
                      onUpdateQuantity?.(card.id, newQuantity, userCard?.quantityFoil || 0);
                    }}
                    className="btn-icon-sm bg-red-600 hover:bg-red-700"
                    disabled={!userCard?.quantity || userCard.quantity <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  
                  <span className="text-white font-medium min-w-[2rem] text-center">
                    {userCard?.quantity || 0}
                  </span>
                  
                  <button
                    onClick={() => {
                      const newQuantity = (userCard?.quantity || 0) + 1;
                      onUpdateQuantity?.(card.id, newQuantity, userCard?.quantityFoil || 0);
                    }}
                    className="btn-icon-sm bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  
                  {/* Contrôle foil */}
                  <div className="border-l border-gray-600 pl-2 ml-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-mtg-gold" />
                    <button
                      onClick={() => {
                        const newQuantityFoil = Math.max(0, (userCard?.quantityFoil || 0) - 1);
                        onUpdateQuantity?.(card.id, userCard?.quantity || 0, newQuantityFoil);
                      }}
                      className="btn-icon-sm bg-red-600 hover:bg-red-700"
                      disabled={!userCard?.quantityFoil || userCard.quantityFoil <= 0}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    
                    <span className="text-white font-medium min-w-[1.5rem] text-center">
                      {userCard?.quantityFoil || 0}
                    </span>
                    
                    <button
                      onClick={() => {
                        const newQuantityFoil = (userCard?.quantityFoil || 0) + 1;
                        onUpdateQuantity?.(card.id, userCard?.quantity || 0, newQuantityFoil);
                      }}
                      className="btn-icon-sm bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onAddToCollection?.(card.id, 1, false)}
                  className="btn-primary text-xs px-3 py-1.5 w-full"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter à la collection
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal d'image pleine taille */}
        {showFullImage && getImageUrl() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowFullImage(false)}
          >
            <motion.img
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
              src={imageUris.large ?? getImageUrl() ?? undefined}
              alt={card.nameFr || card.name}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Rendu en mode liste
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`bg-gray-800 rounded-lg p-4 border transition-all duration-200 hover:shadow-lg ${
        isOwned 
          ? 'border-mtg-gold shadow-mtg-gold/20' 
          : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Miniature */}
        <div className="relative w-16 h-22 bg-gray-900 rounded overflow-hidden flex-shrink-0">
          {getImageUrl() && !imageError ? (
            <>
              {!thumbLoaded && (
                <div className="absolute inset-0 bg-gray-800 animate-pulse" />
              )}
              <img
                src={imageUris.small ?? getImageUrl() ?? undefined}
                alt={card.nameFr || card.name}
                className={`w-full h-full object-cover transition-opacity duration-300 ${thumbLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setThumbLoaded(true)}
                onError={() => setImageError(true)}
                onClick={() => setShowFullImage(true)}
                loading="lazy"
                decoding="async"
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Eye className="h-4 w-4" />
            </div>
          )}
          
          {isOwned && (
            <div className="absolute -top-1 -right-1 bg-mtg-gold text-black px-1 rounded-full text-xs font-bold min-w-[1.25rem] text-center">
              {totalQuantity}
            </div>
          )}
        </div>

        {/* Informations principales */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white truncate">
              {card.nameFr || card.name}
            </h3>
            {formatManaCost(card.manaCost)}
            <div className={`px-2 py-0.5 rounded text-xs font-bold ${
              card.rarity === 'mythic' ? 'bg-orange-500 text-white' :
              card.rarity === 'rare' ? 'bg-yellow-500 text-black' :
              card.rarity === 'uncommon' ? 'bg-gray-400 text-black' :
              'bg-gray-600 text-white'
            }`}>
              {card.rarity}
            </div>
          </div>
          
          <p className="text-gray-400 text-sm mb-1">
            {card.typeLineFr || card.typeLine}
          </p>
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{card.set.name} ({card.set.code.toUpperCase()})</span>
            <span>#{card.collectorNumber}</span>
            {((card as any).priceEur ?? null) !== null && (card as any).priceEur !== undefined ? (
              <span className="text-mtg-gold font-medium">{Number((card as any).priceEur).toFixed(2)}€</span>
            ) : getCardPriceEUR(prices) !== null && (
              <span className="text-mtg-gold font-medium">{getCardPriceEUR(prices)!.toFixed(2)}€</span>
            )}
          </div>
        </div>

        {/* Wishlist / Trade quick actions */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <button
            title="Ajouter/retirer de la Wishlist"
            onClick={() => handleToggleList('WISHLIST')}
            className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Wishlist
          </button>
          <button
            title="Ajouter/retirer de la Trade list"
            onClick={() => handleToggleList('TRADE')}
            className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Trade
          </button>
          {onAddToSale && isOwned && (
            <button
              title="Mettre en vente"
              onClick={() => onAddToSale(card.id)}
              className="text-xs px-2 py-1 rounded border border-mtg-gold text-mtg-gold hover:bg-mtg-gold hover:text-mtg-black flex items-center gap-1"
            >
              <ShoppingCart className="w-3 h-3" />
              Vendre
            </button>
          )}
        </div>

        {/* Contrôles de quantité */}
        {showQuantityControls && (
          <div className="flex items-center gap-3">
            {isOwned ? (
              <>
                {/* Contrôles normaux */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newQuantity = Math.max(0, (userCard?.quantity || 0) - 1);
                      onUpdateQuantity?.(card.id, newQuantity, userCard?.quantityFoil || 0);
                    }}
                    className="btn-icon-sm bg-red-600 hover:bg-red-700"
                    disabled={!userCard?.quantity || userCard.quantity <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  
                  <span className="text-white font-medium min-w-[2rem] text-center">
                    {userCard?.quantity || 0}
                  </span>
                  
                  <button
                    onClick={() => {
                      const newQuantity = (userCard?.quantity || 0) + 1;
                      onUpdateQuantity?.(card.id, newQuantity, userCard?.quantityFoil || 0);
                    }}
                    className="btn-icon-sm bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                
                {/* Contrôles foil */}
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-mtg-gold" />
                  <button
                    onClick={() => {
                      const newQuantityFoil = Math.max(0, (userCard?.quantityFoil || 0) - 1);
                      onUpdateQuantity?.(card.id, userCard?.quantity || 0, newQuantityFoil);
                    }}
                    className="btn-icon-sm bg-red-600 hover:bg-red-700"
                    disabled={!userCard?.quantityFoil || userCard.quantityFoil <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  
                  <span className="text-white font-medium min-w-[2rem] text-center">
                    {userCard?.quantityFoil || 0}
                  </span>
                  
                  <button
                    onClick={() => {
                      const newQuantityFoil = (userCard?.quantityFoil || 0) + 1;
                      onUpdateQuantity?.(card.id, userCard?.quantity || 0, newQuantityFoil);
                    }}
                    className="btn-icon-sm bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => onAddToCollection?.(card.id, 1, false)}
                className="btn-primary px-4 py-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal d'image pleine taille */}
      {showFullImage && getImageUrl() && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFullImage(false)}
        >
          <motion.img
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.5 }}
            src={imageUris.large ?? getImageUrl() ?? undefined}
            alt={card.nameFr || card.name}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </motion.div>
  );
};

export default CardDisplay;
