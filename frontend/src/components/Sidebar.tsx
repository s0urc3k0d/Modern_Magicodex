import { Link, useLocation } from 'react-router-dom';
import { 
  Home,
  Library,
  Layers,
  User,
  Crown,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navigation = [
    { name: 'Accueil', href: '/', icon: Home },
    { name: 'Collection', href: '/collection', icon: Library },
  { name: 'Manquantes', href: '/collection/missing', icon: Sparkles },
  { name: 'Statistiques', href: '/collection/stats', icon: BookOpen },
  { name: 'Wishlist & Trade', href: '/lists', icon: BookOpen },
  // Le scanner est expérimental: afficher uniquement pour les admins
  ...(user?.isAdmin ? [{ name: 'Scanner', href: '/scan', icon: Sparkles }] : [] as any),
    { name: 'Decks', href: '/decks', icon: Layers },
    { name: 'Profil', href: '/profile', icon: User },
  ];

  if (user?.isAdmin) {
    navigation.push({ name: 'Administration', href: '/admin', icon: Crown });
  }

  const isCurrentPath = (href: string) => {
    if (href === '/') return location.pathname === '/';
    // Avoid marking /collection as active when on nested routes like /collection/missing
    if (href === '/collection') return location.pathname === '/collection';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-mtg-surface border-r border-gray-700">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center px-6 py-5 border-b border-gray-700">
          <div className="flex items-center">
            {/* Logo avec couleurs MTG officielles */}
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-mtg-primary to-mtg-secondary rounded-xl flex items-center justify-center shadow-lg">
                <BookOpen className="w-5 h-5 text-mtg-black" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-mtg-primary" />
            </div>
            {/* Titre avec la charte graphique MTG */}
            <div className="ml-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-mtg-primary to-mtg-secondary bg-clip-text text-transparent tracking-wide">
                Magicodex
              </h1>
              <p className="text-xs text-gray-400 font-medium tracking-wider uppercase">
                Collection Manager
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = isCurrentPath(item.href);
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-mtg-primary text-mtg-black' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-mtg-primary rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-mtg-black" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">
                {user?.username}
              </p>
              <p className="text-xs text-gray-400">
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
