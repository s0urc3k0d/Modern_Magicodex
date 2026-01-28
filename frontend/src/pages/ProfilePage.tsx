import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, KeyRound, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/auth';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changing, setChanging] = useState(false);

  const submitChangePassword = async () => {
    if (!pwdForm.currentPassword || !pwdForm.newPassword) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      toast.error('Le nouveau mot de passe doit faire au moins 6 caractères');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('La confirmation ne correspond pas');
      return;
    }
    try {
      setChanging(true);
      await authService.changePassword(pwdForm.currentPassword, pwdForm.newPassword);
      toast.success('Mot de passe mis à jour');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Échec du changement de mot de passe';
      toast.error(msg);
    } finally {
      setChanging(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Mon Profil</h1>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="btn-primary"
        >
          {isEditing ? 'Annuler' : 'Modifier'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card p-6 text-center">
            <div className="w-24 h-24 bg-mtg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-12 h-12 text-mtg-black" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {user.username}
            </h2>
            <p className="text-gray-400 mb-4">
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`
                : 'Nom non renseigné'
              }
            </p>
            {user.isAdmin && (
              <div className="inline-flex items-center px-3 py-1 bg-mtg-primary/20 text-mtg-primary rounded-full text-sm">
                <Shield className="w-4 h-4 mr-1" />
                Administrateur
              </div>
            )}
          </div>
        </div>

        {/* Profile Information */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Informations personnelles
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Prénom
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="input w-full"
                      defaultValue={user.firstName || ''}
                      placeholder="Votre prénom"
                    />
                  ) : (
                    <div className="input w-full bg-mtg-background text-gray-300">
                      {user.firstName || 'Non renseigné'}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Nom
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="input w-full"
                      defaultValue={user.lastName || ''}
                      placeholder="Votre nom"
                    />
                  ) : (
                    <div className="input w-full bg-mtg-background text-gray-300">
                      {user.lastName || 'Non renseigné'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </label>
                <div className="input w-full bg-mtg-background text-gray-300">
                  {user.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Nom d'utilisateur
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    className="input w-full"
                    defaultValue={user.username}
                    placeholder="Votre nom d'utilisateur"
                  />
                ) : (
                  <div className="input w-full bg-mtg-background text-gray-300">
                    {user.username}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Membre depuis
                </label>
                <div className="input w-full bg-mtg-background text-gray-300">
                  {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>

              {isEditing && (
                <div className="flex space-x-4 pt-4">
                  <button className="btn-primary">
                    Sauvegarder
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="btn-outline"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Change password */}
          <div className="card p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <KeyRound className="w-4 h-4 mr-2" /> Changer le mot de passe
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Mot de passe actuel</label>
                <div className="relative">
                  <input
                    type={showPwd.current ? 'text' : 'password'}
                    className="input w-full pr-10"
                    value={pwdForm.currentPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    onClick={() => setShowPwd({ ...showPwd, current: !showPwd.current })}
                  >
                    {showPwd.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showPwd.next ? 'text' : 'password'}
                    className="input w-full pr-10"
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    onClick={() => setShowPwd({ ...showPwd, next: !showPwd.next })}
                  >
                    {showPwd.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Confirmer</label>
                <div className="relative">
                  <input
                    type={showPwd.confirm ? 'text' : 'password'}
                    className="input w-full pr-10"
                    value={pwdForm.confirmPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    onClick={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })}
                  >
                    {showPwd.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button className="btn-primary" onClick={submitChangePassword} disabled={changing}>
                {changing ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-6">
          Mes statistiques
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-mtg-primary mb-1">0</div>
            <div className="text-sm text-gray-400">Cartes collectées</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-mtg-secondary mb-1">0</div>
            <div className="text-sm text-gray-400">Decks créés</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-mtg-accent mb-1">0</div>
            <div className="text-sm text-gray-400">Extensions complètes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-mtg-green mb-1">€0</div>
            <div className="text-sm text-gray-400">Valeur collection</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
