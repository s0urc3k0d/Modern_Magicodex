import { Link } from 'react-router-dom';
import { Library, Layers, Plus, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { collectionService } from '../services/collection';
import { decksService } from '../services/decks';
import ManaSymbol from '../components/ManaSymbol';

const HomePage = () => {
  const { data: stats } = useQuery({
    queryKey: ['home', 'collection-stats'],
    queryFn: () => collectionService.getCollectionStats('set'),
  });

  const { data: decks } = useQuery({
    queryKey: ['home', 'recent-decks'],
    queryFn: () => decksService.getDecks(),
  });

  const recentDecks = (decks || []).slice(0, 3);
  const totalCards = (stats?.general?.totalCards || 0) + (stats?.general?.totalFoils || 0);
  const foils = stats?.general?.totalFoils || 0;
  const totalValue = stats?.general?.totalValue || 0;
  const completedSets = Array.isArray(stats?.grouped)
    ? stats.grouped.filter((g: any) => {
        const total = g.set?.cardCount || 0;
        const owned = g.uniqueCards || 0;
        return total > 0 && owned >= total;
      }).length
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Bienvenue dans <span className="gradient-text">Magicodex</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Gérez votre collection Magic: The Gathering et créez des decks avec une interface moderne et intuitive.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          to="/collection"
          className="card-hover p-6 text-center group"
        >
          <div className="w-12 h-12 bg-mtg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-mtg-primary/30 transition-colors">
            <Library className="w-6 h-6 text-mtg-primary" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Ma Collection
          </h3>
          <p className="text-gray-400 text-sm">
            Explorez et gérez vos cartes
          </p>
        </Link>

        <Link
          to="/decks"
          className="card-hover p-6 text-center group"
        >
          <div className="w-12 h-12 bg-mtg-secondary/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-mtg-secondary/30 transition-colors">
            <Layers className="w-6 h-6 text-mtg-secondary" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Mes Decks
          </h3>
          <p className="text-gray-400 text-sm">
            Consultez vos decks construits
          </p>
        </Link>

        <Link
          to="/decks/builder"
          className="card-hover p-6 text-center group"
        >
          <div className="w-12 h-12 bg-mtg-accent/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-mtg-accent/30 transition-colors">
            <Plus className="w-6 h-6 text-mtg-accent" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Nouveau Deck
          </h3>
          <p className="text-gray-400 text-sm">
            Créez un nouveau deck
          </p>
        </Link>

  <Link to="/collection/stats" className="card-hover p-6 text-center group">
          <div className="w-12 h-12 bg-mtg-green/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-mtg-green/30 transition-colors">
            <BarChart3 className="w-6 h-6 text-mtg-green" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Statistiques
          </h3>
          <p className="text-gray-400 text-sm">
            Analysez votre collection
          </p>
  </Link>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Collection stats */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-6">
            Aperçu de la Collection
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-mtg-background rounded-lg">
              <span className="text-gray-400">Total de cartes</span>
              <span className="text-white font-semibold">{totalCards.toLocaleString('fr-FR')}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-mtg-background rounded-lg">
              <span className="text-gray-400">Cartes foil</span>
              <span className="text-white font-semibold">{foils.toLocaleString('fr-FR')}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-mtg-background rounded-lg">
              <span className="text-gray-400">Valeur estimée</span>
              <span className="text-white font-semibold">€ {totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-mtg-background rounded-lg">
              <span className="text-gray-400">Extensions complètes</span>
              <span className="text-white font-semibold">{completedSets}</span>
            </div>
          </div>
        </div>

        {/* Recent decks */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-6">
            Decks Récents
          </h2>
          <div className="space-y-4">
            {recentDecks.length === 0 ? (
              <div className="text-gray-400 text-sm">Aucun deck récent</div>
            ) : (
              recentDecks.map((deck: any) => (
                <Link
                  key={deck.id}
                  to={`/decks/view/${deck.id}`}
                  className="flex items-center justify-between p-3 bg-mtg-background rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <h3 className="text-white font-medium">{deck.name}</h3>
                    <p className="text-gray-400 text-sm">
                      {deck.format}
                      {deck.archetype ? ` • ${deck.archetype}` : ''}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    {(deck.colors || []).map((c: string) => (
                      <ManaSymbol key={deck.id + c} symbol={c} size="sm" />
                    ))}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Featured content */}
      <div className="card p-8 text-center bg-gradient-to-r from-mtg-primary/10 to-mtg-secondary/10 border-mtg-primary/20">
        <h2 className="text-2xl font-bold text-white mb-4">
          Nouveau sur Magicodex ?
        </h2>
        <p className="text-gray-300 mb-6">
          Découvrez toutes les fonctionnalités pour gérer votre collection et créer des decks optimaux.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/collection"
            className="btn-primary"
          >
            Commencer avec ma collection
          </Link>
          <Link
            to="/decks/builder"
            className="btn-outline"
          >
            Créer mon premier deck
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
