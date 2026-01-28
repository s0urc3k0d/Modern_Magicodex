import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, Database, RefreshCw, 
  AlertTriangle, CheckCircle, XCircle, Clock,
  BarChart3, TrendingUp, Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';

import { adminService } from '../services/admin';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'sync' | 'performance'>('overview');
  const [setCode, setSetCode] = useState('dmu');
  const [forceSync, setForceSync] = useState(false);
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: () => adminService.getStats() });
  const { data: usersData, isLoading: usersLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => adminService.getUsers(), enabled: activeTab === 'users' });
  const { data: syncLogs, isLoading: syncLoading } = useQuery({ queryKey: ['admin-sync-logs'], queryFn: () => adminService.getSyncLogs(), enabled: activeTab === 'sync' });
  const { data: performance, isLoading: performanceLoading } = useQuery({ queryKey: ['admin-performance'], queryFn: () => adminService.getPerformanceMetrics(), enabled: activeTab === 'performance' });
  const { data: systemHealth } = useQuery({ queryKey: ['admin-health'], queryFn: () => adminService.getSystemHealth(), refetchInterval: 30000 });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onSuccess: () => { toast.success('Utilisateur supprimé !'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const cleanDatabaseMutation = useMutation({
    mutationFn: () => adminService.cleanDatabase(),
  onSuccess: (data: any) => { toast.success(`Base nettoyée ! ${data.deleted.cards} cartes / ${data.deleted.sets} sets`); queryClient.invalidateQueries({ queryKey: ['admin-stats'] }); },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erreur nettoyage'),
  });

  // Double confirmation modal state for destructive actions
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const projectName = 'MAGICODEX';

  const getHealthColor = (status: string) => {
    switch (status) { case 'healthy': return 'text-green-500'; case 'warning': return 'text-yellow-500'; case 'error': return 'text-red-500'; default: return 'text-gray-500'; }
  };
  const getHealthIcon = (status: string) => {
    switch (status) { case 'healthy': return <CheckCircle className="w-5 h-5" />; case 'warning': return <AlertTriangle className="w-5 h-5" />; case 'error': return <XCircle className="w-5 h-5" />; default: return <Clock className="w-5 h-5" />; }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Administration</h1>
          <p className="text-gray-400">Gestion et monitoring de Magicodex</p>
        </div>
        {systemHealth && (
          <div className={`flex items-center gap-2 ${getHealthColor(systemHealth.status)}`}>
            {getHealthIcon(systemHealth.status)}
            <span className="font-medium">Système {systemHealth.status === 'healthy' ? 'en bonne santé' : 'en erreur'}</span>
          </div>
        )}
      </div>

      <div className="card p-1 inline-flex">
        <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'overview' ? 'bg-mtg-primary text-mtg-black' : 'text-gray-400 hover:text-white'}`}><BarChart3 className="w-4 h-4" />Vue d'ensemble</button>
        <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'bg-mtg-primary text-mtg-black' : 'text-gray-400 hover:text-white'}`}><Users className="w-4 h-4" />Utilisateurs</button>
        <button onClick={() => setActiveTab('sync')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'sync' ? 'bg-mtg-primary text-mtg-black' : 'text-gray-400 hover:text-white'}`}><Database className="w-4 h-4" />Synchronisation</button>
        <button onClick={() => setActiveTab('performance')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'performance' ? 'bg-mtg-primary text-mtg-black' : 'text-gray-400 hover:text-white'}`}><TrendingUp className="w-4 h-4" />Performance</button>
      </div>

      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {statsLoading ? (<div className="flex justify-center py-8"><LoadingSpinner /></div>) : stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-6 text-center"><div className="text-3xl font-bold text-mtg-primary mb-2">{stats.overview?.totalUsers || 0}</div><div className="text-sm text-gray-400">Utilisateurs</div></div>
              <div className="card p-6 text-center"><div className="text-3xl font-bold text-mtg-secondary mb-2">{stats.overview?.totalSets || 0}</div><div className="text-sm text-gray-400">Extensions</div></div>
              <div className="card p-6 text-center"><div className="text-3xl font-bold text-mtg-accent mb-2">{stats.overview?.totalCards?.toLocaleString() || 0}</div><div className="text-sm text-gray-400">Cartes</div></div>
              <div className="card p-6 text-center"><div className="text-3xl font-bold text-mtg-green mb-2">{stats.overview?.totalDecks || 0}</div><div className="text-sm text-gray-400">Decks</div></div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-6"><div className="flex items-center gap-3 mb-4"><BarChart3 className="w-6 h-6 text-mtg-primary" /><h3 className="text-lg font-semibold text-white">Statistiques</h3></div><p className="text-gray-400 text-sm mb-4">Consulter les métriques détaillées du système</p><button onClick={() => setActiveTab('performance')} className="btn-primary w-full">Voir les statistiques</button></div>
            <div className="card p-6"><div className="flex items-center gap-3 mb-4"><Database className="w-6 h-6 text-mtg-accent" /><h3 className="text-lg font-semibold text-white">Synchronisation</h3></div><p className="text-gray-400 text-sm mb-4">Gérer la synchronisation avec Scryfall (nouvelle interface)</p><button onClick={() => setActiveTab('sync')} className="btn-primary w-full">Gérer la sync</button></div>
            <div className="card p-6"><div className="flex items-center gap-3 mb-4"><Users className="w-6 h-6 text-mtg-secondary" /><h3 className="text-lg font-semibold text-white">Utilisateurs</h3></div><p className="text-gray-400 text-sm mb-4">Gérer les comptes utilisateurs et les permissions</p><button onClick={() => setActiveTab('users')} className="btn-secondary w-full">Gérer les utilisateurs</button></div>
          </div>
        </motion.div>
      )}

      {activeTab === 'users' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Gestion des utilisateurs</h3>
            {usersLoading ? (<div className="flex justify-center py-8"><LoadingSpinner /></div>) : usersData?.users?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700"><th className="text-left py-3 px-4 text-gray-400">Utilisateur</th><th className="text-left py-3 px-4 text-gray-400">Email</th><th className="text-left py-3 px-4 text-gray-400">Admin</th><th className="text-left py-3 px-4 text-gray-400">Créé le</th><th className="text-left py-3 px-4 text-gray-400">Actions</th></tr>
                  </thead>
                  <tbody>
                    {usersData.users.map((user: any) => (
                      <tr key={user.id} className="border-b border-gray-800 hover:bg-mtg-surface/50">
                        <td className="py-3 px-4 text-white">{user.username}</td>
                        <td className="py-3 px-4 text-gray-400">{user.email}</td>
                        <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs ${user.isAdmin ? 'bg-mtg-primary text-mtg-black' : 'bg-gray-700 text-gray-300'}`}>{user.isAdmin ? 'Oui' : 'Non'}</span></td>
                        <td className="py-3 px-4 text-gray-400">{new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 px-4"><button onClick={() => deleteUserMutation.mutate(user.id)} disabled={deleteUserMutation.isPending} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (<div className="text-center py-8 text-gray-400">Aucun utilisateur trouvé</div>)}
          </div>
        </motion.div>
      )}

      {activeTab === 'sync' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4"><RefreshCw className="w-6 h-6 text-mtg-accent" /><h3 className="text-lg font-semibold text-white">Synchronisation Scryfall</h3></div>
            <p className="text-gray-300 text-sm mb-6">Synchronisation complète: sets, cartes et traductions françaises.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-mtg-background p-4 rounded-lg border border-gray-600"><h4 className="font-semibold text-white mb-2">🧪 Test</h4><p className="text-xs text-gray-400 mb-3">Test avec un petit set (DMU)</p><button onClick={() => { adminService.syncHybridCards('dmu', true).then(() => toast.success('Test démarré !')).catch(() => toast.error('Erreur test')); }} className="btn-primary w-full text-sm">Test DMU</button></div>
              <div className="bg-mtg-background p-4 rounded-lg border border-gray-600"><h4 className="font-semibold text-white mb-2">📦 Extensions</h4><p className="text-xs text-gray-400 mb-3">Synchroniser tous les sets</p><button onClick={() => { adminService.syncHybridSets(false).then(() => toast.success('Sync sets démarrée !')).catch(() => toast.error('Erreur sync sets')); }} className="btn-primary w-full text-sm">Sync Sets</button></div>
              <div className="bg-mtg-background p-4 rounded-lg border border-gray-600"><h4 className="font-semibold text-white mb-2">🃏 Cartes</h4><p className="text-xs text-gray-400 mb-3">Toutes les cartes + français (tous sets)</p><button onClick={() => { adminService.syncHybridFull(false).then(() => toast.success('Sync cartes démarrée !')).catch(() => toast.error('Erreur sync cartes')); }} className="btn-primary w-full text-sm">Sync Cartes</button></div>
              <div className="bg-mtg-background p-4 rounded-lg border border-gray-600"><h4 className="font-semibold text-white mb-2">⚡ Complète</h4><p className="text-xs text-gray-400 mb-3">Sets + cartes + traductions</p><button onClick={() => { adminService.syncHybridFull(false).then(() => toast.success('Synchronisation complète démarrée !')).catch(() => toast.error('Erreur sync complète')); }} className="btn-primary w-full text-sm">Sync Complète</button></div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-mtg-background p-4 rounded-lg border border-gray-600 md:col-span-2">
                <h4 className="font-semibold text-white mb-2">Set unique (EN+FR)</h4>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Code d'extension (ex: dmu)</label>
                    <input value={setCode} onChange={(e) => setSetCode(e.target.value)} placeholder="dmu" className="input w-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="forceSync" checked={forceSync} onChange={(e) => setForceSync(e.target.checked)} className="w-4 h-4" />
                    <label htmlFor="forceSync" className="text-xs text-gray-400">Force</label>
                  </div>
                  <button onClick={() => { if (!setCode) return toast.error('Entrez un code de set'); adminService.syncHybridCards(setCode, forceSync).then(() => toast.success(`Sync ${setCode.toUpperCase()} démarrée !`)).catch(() => toast.error('Erreur sync set')); }} className="btn-primary">Sync set</button>
                </div>
              </div>
              <div className="bg-mtg-background p-4 rounded-lg border border-gray-600">
                <h4 className="font-semibold text-white mb-2">Δ Extras</h4>
                <p className="text-xs text-gray-400 mb-3">Importer uniquement les cartes extras manquantes (variants/promo). Laisser vide pour tous les sets.</p>
                <div className="flex gap-2 items-end mb-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Set (optionnel)</label>
                    <input value={setCode} onChange={(e) => setSetCode(e.target.value)} placeholder="ex: woe" className="input w-full" />
                  </div>
                </div>
                <button onClick={() => {
                  adminService.deltaExtras(setCode || undefined)
                    .then((res) => {
                      const created = res?.summary?.created ?? 0;
                      toast.success(`Delta extras terminé (+${created})`);
                      queryClient.invalidateQueries({ queryKey: ['admin-sync-logs'] });
                    })
                    .catch((e) => {
                      console.error(e);
                      toast.error('Erreur delta extras');
                    });
                }} className="btn-secondary w-full text-sm">Lancer delta extras</button>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4"><Trash2 className="w-6 h-6 text-red-500" /><h3 className="text-lg font-semibold text-white">Nettoyage de la base</h3></div>
            <p className="text-gray-400 text-sm mb-4">Supprime cartes et sets pour tester la synchronisation.</p>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={cleanDatabaseMutation.isPending}
              className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {cleanDatabaseMutation.isPending ? 'Nettoyage...' : 'Nettoyer la base'}
            </button>

            {/* Confirmation Modal */}
            {confirmOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
                <div className="w-full max-w-md rounded-lg bg-mtg-background border border-gray-700 shadow-xl">
                  <div className="p-5 border-b border-gray-700">
                    <h4 className="text-lg font-semibold text-white">Confirmer le nettoyage</h4>
                    <p className="text-sm text-gray-300 mt-1">
                      Cette action va <span className="text-red-400 font-semibold">supprimer TOUTES</span> les cartes et extensions.
                      Pour confirmer, tapez <span className="font-mono text-mtg-primary">{projectName}</span> ci-dessous.
                    </p>
                  </div>
                  <div className="p-5 space-y-3">
                    <input
                      autoFocus
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                      placeholder={projectName}
                      className="input w-full font-mono"
                    />
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Action irréversible</span>
                      <span>{confirmText === projectName ? '✔️' : '❌'}</span>
                    </div>
                  </div>
                  <div className="px-5 py-4 border-t border-gray-700 flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setConfirmOpen(false); setConfirmText(''); }}
                      className="px-3 py-1.5 rounded border border-gray-600 text-gray-200 hover:bg-gray-700"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => { cleanDatabaseMutation.mutate(); setConfirmOpen(false); setConfirmText(''); }}
                      disabled={confirmText !== projectName || cleanDatabaseMutation.isPending}
                      className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Logs de synchronisation</h3>
            {syncLoading ? (<div className="flex justify-center py-8"><LoadingSpinner /></div>) : syncLogs?.syncs?.length > 0 ? (
              <div className="space-y-3">
                {syncLogs.syncs.map((log: any) => (
                  <div key={log.id} className="p-4 bg-mtg-background rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{log.syncType}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${log.status === 'SUCCESS' ? 'bg-green-600 text-white' : log.status === 'FAILED' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'}`}>{log.status}</span>
                      </div>
                      <div className="text-sm text-gray-400">{log.lastSync ? new Date(log.lastSync).toLocaleString('fr-FR') : 'N/A'}</div>
                    </div>
                    {log.error && <div className="text-sm text-red-400 mt-2">Erreur: {log.error}</div>}
                  </div>
                ))}
              </div>
            ) : (<div className="text-center py-8 text-gray-400">Aucun log de synchronisation</div>)}
          </div>
        </motion.div>
      )}

      {activeTab === 'performance' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {performanceLoading ? (<div className="flex justify-center py-8"><LoadingSpinner /></div>) : performance && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Moyennes</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><span className="text-gray-400">Decks par utilisateur</span><span className="text-white font-medium">{performance.averages?.decksPerUser?.toFixed(1) || '0'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Cartes par utilisateur</span><span className="text-white font-medium">{performance.averages?.cardsPerUser?.toFixed(1) || '0'}</span></div>
                </div>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Utilisateurs les plus actifs</h3>
                <div className="space-y-2">
                  {performance.topUsers?.mostActiveUsers?.slice(0, 5).map((user: any, index: number) => (
                    <div key={user.username} className="flex justify-between items-center"><span className="text-gray-400">#{index + 1} {user.username}</span><span className="text-white font-medium">{user._count?.decks || 0} decks</span></div>
                  )) || <div className="text-gray-400">Aucune donnée</div>}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AdminPage;
