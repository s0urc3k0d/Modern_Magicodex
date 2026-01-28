import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Search, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-mtg-surface border-b border-gray-700 px-6 py-4 ml-64">
      <div className="flex items-center justify-between">
        {/* Search bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher des cartes..."
              className="input pl-10 w-full"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button 
              className="relative p-2 text-gray-400 hover:text-white transition-colors"
              onClick={() => setIsNotificationMenuOpen(!isNotificationMenuOpen)}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-mtg-secondary rounded-full"></span>
            </button>

            {/* Notifications dropdown */}
            {isNotificationMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-mtg-surface border border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-lg font-semibold text-white">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {/* Placeholder notifications */}
                  <div className="p-4 border-b border-gray-700 hover:bg-mtg-background transition-colors">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-mtg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm text-white">Synchronisation terminée</p>
                        <p className="text-xs text-gray-400 mt-1">Il y a 2 heures</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-b border-gray-700 hover:bg-mtg-background transition-colors">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-mtg-green rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm text-white">Nouveau deck créé avec succès</p>
                        <p className="text-xs text-gray-400 mt-1">Il y a 1 jour</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-400">Aucune nouvelle notification</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-mtg-background transition-colors"
            >
              <div className="text-right">
                <p className="text-sm font-medium text-white">
                  {user?.username}
                </p>
                {user?.isAdmin && (
                  <p className="text-xs text-mtg-primary">
                    Administrateur
                  </p>
                )}
              </div>
              <div className="w-8 h-8 bg-mtg-primary rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-mtg-black" />
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* Dropdown menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-mtg-surface border border-gray-700 rounded-lg shadow-lg z-50">
                <Link
                  to="/profile"
                  className="flex items-center px-4 py-3 text-sm text-white hover:bg-mtg-background transition-colors"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <User className="w-4 h-4 mr-3" />
                  Mon profil
                </Link>
                <hr className="border-gray-700" />
                <button
                  onClick={() => {
                    logout();
                    setIsUserMenuOpen(false);
                  }}
                  className="flex items-center w-full px-4 py-3 text-sm text-white hover:bg-mtg-background transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
