import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-mtg-background flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-mtg-primary mb-4">404</h1>
          <h2 className="text-3xl font-bold text-white mb-4">
            Page introuvable
          </h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            La page que vous recherchez n'existe pas ou a été déplacée. 
            Peut-être qu'elle s'est échappée dans une autre dimension ?
          </p>
        </div>

        <div className="space-y-4">
          <Link 
            to="/" 
            className="inline-flex items-center px-6 py-3 bg-mtg-primary text-mtg-black font-semibold rounded-lg hover:bg-opacity-90 transition-colors mr-4"
          >
            <Home className="w-5 h-5 mr-2" />
            Retour à l'accueil
          </Link>
          
          <Link 
            to="/collection" 
            className="inline-flex items-center px-6 py-3 bg-mtg-surface text-white font-semibold rounded-lg border border-gray-700 hover:bg-mtg-background transition-colors"
          >
            <Search className="w-5 h-5 mr-2" />
            Explorer la collection
          </Link>
        </div>

        <div className="mt-12 text-gray-500 text-sm">
          <p>Erreur 404 - Page non trouvée</p>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
