import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Sparkles } from 'lucide-react';
import type { Card } from '../types';
import { LANGUAGES } from '../services/sales';

interface AddToCollectionModalProps {
  card: Card;
  onClose: () => void;
  onConfirm: (data: {
    cardId: string;
    quantity: number;
    quantityFoil: number;
    language: string;
  }) => void;
}

const AddToCollectionModal = ({ card, onClose, onConfirm }: AddToCollectionModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const [quantityFoil, setQuantityFoil] = useState(0);
  const [language, setLanguage] = useState('fr'); // Français par défaut

  const handleSubmit = () => {
    if (quantity === 0 && quantityFoil === 0) return;
    
    onConfirm({
      cardId: card.id,
      quantity,
      quantityFoil,
      language,
    });
    onClose();
  };

  const canSubmit = quantity > 0 || quantityFoil > 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-mtg-surface rounded-lg max-w-md w-full border border-gray-700"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Ajouter à la collection</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Card preview */}
          <div className="flex gap-4 mb-6 p-4 bg-mtg-background rounded-lg">
            {card.imageUris?.small && (
              <img
                src={card.imageUris.small}
                alt={card.nameFr || card.name}
                className="w-16 h-auto rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white truncate">{card.nameFr || card.name}</h3>
              <p className="text-sm text-gray-400">
                {card.set.code.toUpperCase()} #{card.collectorNumber}
              </p>
              {card.priceEur && (
                <p className="text-sm text-mtg-gold mt-1">
                  Prix: {card.priceEur.toFixed(2)}€
                </p>
              )}
            </div>
          </div>

          {/* Langue */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Langue de la carte
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input w-full"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quantités */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Normal */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantité normale
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(0, quantity - 1))}
                  className="btn-icon-sm bg-red-600 hover:bg-red-700"
                  disabled={quantity <= 0}
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input w-16 text-center"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="btn-icon-sm bg-green-600 hover:bg-green-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Foil */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-mtg-gold" />
                Quantité foil
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantityFoil(Math.max(0, quantityFoil - 1))}
                  className="btn-icon-sm bg-red-600 hover:bg-red-700"
                  disabled={quantityFoil <= 0}
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={quantityFoil}
                  onChange={(e) => setQuantityFoil(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input w-16 text-center"
                />
                <button
                  onClick={() => setQuantityFoil(quantityFoil + 1)}
                  className="btn-icon-sm bg-green-600 hover:bg-green-700"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 px-4 py-2 bg-mtg-gold text-mtg-black font-bold rounded-lg hover:bg-mtg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AddToCollectionModal;
