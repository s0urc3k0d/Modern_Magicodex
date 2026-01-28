import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ShoppingCart, AlertTriangle, Sparkles } from 'lucide-react';
import type { Card, UserCard } from '../types';
import { CARDMARKET_CONDITIONS, LANGUAGES } from '../services/sales';

interface AddToSaleModalProps {
  card: Card;
  userCard: UserCard;
  forSaleQuantity?: { quantity: number; quantityFoil: number };
  onClose: () => void;
  onConfirm: (data: {
    cardId: string;
    quantity: number;
    quantityFoil: number;
    condition: string;
    language: string;
    askingPrice?: number;
    askingPriceFoil?: number;
  }) => void;
}

const AddToSaleModal = ({
  card,
  userCard,
  forSaleQuantity = { quantity: 0, quantityFoil: 0 },
  onClose,
  onConfirm,
}: AddToSaleModalProps) => {
  // Quantités disponibles (possédées - déjà en vente)
  const availableRegular = Math.max(0, userCard.quantity - forSaleQuantity.quantity);
  const availableFoil = Math.max(0, userCard.quantityFoil - forSaleQuantity.quantityFoil);

  const [quantity, setQuantity] = useState(1);
  const [quantityFoil, setQuantityFoil] = useState(0);
  const [condition, setCondition] = useState('NM');
  const [language, setLanguage] = useState('fr');
  const [askingPrice, setAskingPrice] = useState('');
  const [askingPriceFoil, setAskingPriceFoil] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  // Vérifier si on vend tout
  const willSellAll = (quantity >= availableRegular && availableRegular > 0) || 
                      (quantityFoil >= availableFoil && availableFoil > 0);

  const handleQuantityChange = (value: number, isFoil: boolean) => {
    if (isFoil) {
      const newValue = Math.max(0, Math.min(value, availableFoil));
      setQuantityFoil(newValue);
    } else {
      const newValue = Math.max(0, Math.min(value, availableRegular));
      setQuantity(newValue);
    }
  };

  const handleConfirm = () => {
    // Vérifier si on vend tout et afficher avertissement
    if (willSellAll && !showWarning) {
      setShowWarning(true);
      return;
    }

    onConfirm({
      cardId: card.id,
      quantity,
      quantityFoil,
      condition,
      language,
      askingPrice: askingPrice ? parseFloat(askingPrice) : undefined,
      askingPriceFoil: askingPriceFoil ? parseFloat(askingPriceFoil) : undefined,
    });
    onClose();
  };

  const priceEur = (card as any).priceEur;
  const priceEurFoil = (card as any).priceEurFoil;

  const canSubmit = (quantity > 0 || quantityFoil > 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-mtg-surface rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-700"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-mtg-primary" />
              Mettre en vente
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Carte preview */}
          <div className="flex gap-4 mb-6 p-4 bg-mtg-background rounded-lg">
            {(card as any).imageUris?.small && (
              <img 
                src={(card as any).imageUris.small} 
                alt={card.name}
                className="w-16 h-auto rounded"
              />
            )}
            <div className="flex-1">
              <h3 className="font-bold text-white">{(card as any).nameFr || card.name}</h3>
              <p className="text-sm text-gray-400">
                {card.set.code.toUpperCase()} #{card.collectorNumber}
              </p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-400">
                  En collection: <span className="text-white font-medium">{userCard.quantity}</span>
                  {userCard.quantityFoil > 0 && (
                    <span className="text-mtg-gold ml-1">
                      + {userCard.quantityFoil} <Sparkles className="w-3 h-3 inline" />
                    </span>
                  )}
                </span>
              </div>
              {forSaleQuantity.quantity + forSaleQuantity.quantityFoil > 0 && (
                <p className="text-sm text-orange-400 mt-1">
                  Déjà en vente: {forSaleQuantity.quantity}
                  {forSaleQuantity.quantityFoil > 0 && ` + ${forSaleQuantity.quantityFoil} foil`}
                </p>
              )}
            </div>
          </div>

          {/* Avertissement si on vend tout */}
          {showWarning && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-orange-900/50 border border-orange-600 rounded-lg flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-orange-200 font-medium">Attention !</p>
                <p className="text-orange-300 text-sm">
                  Vous êtes sur le point de mettre en vente tous vos exemplaires. 
                  Cliquez à nouveau pour confirmer.
                </p>
              </div>
            </motion.div>
          )}

          {/* Formulaire */}
          <div className="space-y-4">
            {/* Quantité normale */}
            {availableRegular > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Quantité à vendre ({availableRegular} disponible{availableRegular > 1 ? 's' : ''})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max={availableRegular}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value), false)}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    max={availableRegular}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0, false)}
                    className="input w-20 text-center"
                  />
                </div>
                {priceEur && (
                  <p className="text-xs text-gray-500 mt-1">
                    Prix marché: {priceEur.toFixed(2)}€ × {quantity} = {(priceEur * quantity).toFixed(2)}€
                  </p>
                )}
              </div>
            )}

            {/* Quantité foil */}
            {availableFoil > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-mtg-gold" />
                  Quantité foil à vendre ({availableFoil} disponible{availableFoil > 1 ? 's' : ''})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max={availableFoil}
                    value={quantityFoil}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value), true)}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    max={availableFoil}
                    value={quantityFoil}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0, true)}
                    className="input w-20 text-center"
                  />
                </div>
                {priceEurFoil && (
                  <p className="text-xs text-gray-500 mt-1">
                    Prix marché foil: {priceEurFoil.toFixed(2)}€ × {quantityFoil} = {(priceEurFoil * quantityFoil).toFixed(2)}€
                  </p>
                )}
              </div>
            )}

            {availableRegular === 0 && availableFoil === 0 && (
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-gray-400">
                  Tous vos exemplaires sont déjà en vente.
                </p>
              </div>
            )}

            {/* Condition */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                État
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="input w-full"
              >
                {CARDMARKET_CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.short} - {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Langue */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Langue
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input w-full"
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Prix demandé */}
            <div className="grid grid-cols-2 gap-4">
              {quantity > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Prix unitaire (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                    placeholder={priceEur ? priceEur.toFixed(2) : '0.00'}
                    className="input w-full"
                  />
                </div>
              )}
              {quantityFoil > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-mtg-gold" />
                    Prix foil (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={askingPriceFoil}
                    onChange={(e) => setAskingPriceFoil(e.target.value)}
                    placeholder={priceEurFoil ? priceEurFoil.toFixed(2) : '0.00'}
                    className="input w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-outline flex-1">
              Annuler
            </button>
            <button 
              onClick={handleConfirm} 
              disabled={!canSubmit}
              className={`btn-primary flex-1 ${showWarning ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
            >
              {showWarning ? 'Confirmer la vente' : 'Mettre en vente'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AddToSaleModal;
