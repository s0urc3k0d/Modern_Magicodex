import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectionService } from '../services/collection';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Link } from 'react-router-dom';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

type GroupBy = 'set' | 'color' | 'rarity' | 'type';

const colorsPalette = ['#E49B0F', '#D3202A', '#8B5CF6', '#10B981', '#F59E0B', '#6B7280', '#0EA5E9', '#22D3EE'];

const CollectionStatsPage = () => {
  const [groupBy, setGroupBy] = useState<GroupBy>('set');
  const [scope, setScope] = useState<'all' | 'standard' | 'extras'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['collection-stats', groupBy, scope],
    queryFn: () => collectionService.getCollectionStats(groupBy, scope === 'all' ? undefined : scope === 'extras'),
  });

  const general = data?.general || { uniqueCards: 0, totalCards: 0, totalFoils: 0, totalValue: 0 };
  const grouped = Array.isArray(data?.grouped) ? data!.grouped : [];

  const labels = grouped.map((g: any) => {
    if (groupBy === 'set') return g.set?.code?.toUpperCase() || 'SET';
    if (groupBy === 'rarity') return (g.rarity || 'Unknown').toUpperCase();
    if (groupBy === 'color') return g.color || 'Colorless';
    if (groupBy === 'type') return g.type || 'Other';
    return 'Item';
  });
  const values = grouped.map((g: any) => (g.totalCards || 0) + (g.totalFoils || 0));

  const pieData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((_: string, i: number) => colorsPalette[i % colorsPalette.length]),
      borderWidth: 0,
    }]
  };

  const barData = {
    labels,
    datasets: [{
      label: 'Cartes (totales)',
      data: values,
      backgroundColor: '#E49B0F',
      borderColor: '#B8860B',
      borderWidth: 1,
    }]
  };

  // CSV export
  const csvRows = useMemo(() => {
    const headCommon = ['group', 'uniqueCards', 'totalNormal', 'totalFoil'];
    const head = groupBy === 'set' ? [...headCommon, 'setCode', 'setName', 'completion'] : headCommon;
    const rows = [head.join(',')];
    for (const g of grouped as any[]) {
      const unique = g.uniqueCards || 0;
      const total = g.totalCards || 0;
      const foils = g.totalFoils || 0;
      let groupLabel = '';
      if (groupBy === 'set') groupLabel = `${g.set?.nameFr || g.set?.name || 'Extension'}`;
      if (groupBy === 'color') groupLabel = g.color || 'Colorless';
      if (groupBy === 'rarity') groupLabel = (g.rarity || 'Unknown').toUpperCase();
      if (groupBy === 'type') groupLabel = g.type || 'Other';
      if (groupBy === 'set') {
        const denom = typeof g.totalInScope === 'number' && g.totalInScope > 0 ? g.totalInScope : (g.set?.cardCount || 1);
        const completion = Math.round(((unique) / denom) * 100);
        rows.push([
          JSON.stringify(groupLabel), unique, total, foils,
          (g.set?.code || 'SET').toUpperCase(), JSON.stringify(g.set?.nameFr || g.set?.name || ''), `${completion}%`
        ].join(','));
      } else {
        rows.push([JSON.stringify(groupLabel), unique, total, foils].join(','));
      }
    }
    return rows;
  }, [groupBy, grouped]);

  const downloadCSV = () => {
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-stats-${groupBy}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Statistiques de la collection</h1>
          <p className="text-gray-400">Analyse par extension, couleur, rareté et type</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadCSV} className="btn-outline">Exporter CSV</button>
          <Link to="/collection" className="btn-outline">Voir ma collection</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-mtg-primary mb-1">{general.uniqueCards.toLocaleString('fr-FR')}</div>
          <div className="text-sm text-gray-400">Cartes uniques</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-mtg-secondary mb-1">{(general.totalCards + general.totalFoils).toLocaleString('fr-FR')}</div>
          <div className="text-sm text-gray-400">Cartes totales</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-mtg-accent mb-1">€ {general.totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-sm text-gray-400">Valeur estimée</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-mtg-green mb-1">{grouped.length}</div>
          <div className="text-sm text-gray-400">Groupes</div>
        </div>
      </div>

      {/* Grouping selector */}
      <div className="card p-4 flex items-center gap-3">
        <span className="text-gray-400 text-sm">Grouper par:</span>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="bg-mtg-background border border-gray-700 text-white text-sm rounded px-2 py-1"
        >
          <option value="set">Extension</option>
          <option value="color">Couleur</option>
          <option value="rarity">Rareté</option>
          <option value="type">Type</option>
        </select>
        <span className="text-gray-400 text-sm ml-4">Portée:</span>
        <div className="inline-flex bg-mtg-background border border-gray-700 rounded overflow-hidden">
          {([
            { key: 'all', label: 'Toutes' },
            { key: 'standard', label: 'Standard' },
            { key: 'extras', label: 'Extras' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setScope(key)}
              className={`px-3 py-1 text-sm ${scope === key ? 'bg-mtg-primary text-black' : 'text-gray-300 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Répartition</h3>
          <div className="h-64">
            {isLoading ? (
              <div className="text-gray-400">Chargement…</div>
            ) : (
              <Pie 
                data={pieData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: '#fff' } } }
                }}
              />
            )}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Volumes</h3>
          <div className="h-64">
            {isLoading ? (
              <div className="text-gray-400">Chargement…</div>
            ) : (
              <Bar 
                data={barData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: '#fff' } } },
                  scales: {
                    x: { ticks: { color: '#fff' }, grid: { color: '#374151' } },
                    y: { ticks: { color: '#fff' }, grid: { color: '#374151' } }
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Detailed table */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Détails</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="py-2 pr-4">Groupe</th>
                <th className="py-2 pr-4">Cartes uniques</th>
                <th className="py-2 pr-4">Total normal</th>
                <th className="py-2 pr-4">Total foil</th>
                {groupBy === 'set' && <th className="py-2 pr-4">Complétion</th>}
              </tr>
            </thead>
            <tbody>
              {grouped.map((g: any) => {
                const unique = g.uniqueCards || 0;
                const total = g.totalCards || 0;
                const foils = g.totalFoils || 0;
                let groupLabel = '';
                if (groupBy === 'set') groupLabel = `${g.set?.nameFr || g.set?.name || 'Extension'} (${(g.set?.code || 'SET').toUpperCase()})`;
                if (groupBy === 'color') groupLabel = g.color || 'Colorless';
                if (groupBy === 'rarity') groupLabel = (g.rarity || 'Unknown').toUpperCase();
                if (groupBy === 'type') groupLabel = g.type || 'Other';
                const denom = typeof g.totalInScope === 'number' && g.totalInScope > 0 ? g.totalInScope : (g.set?.cardCount || 1);
                const completion = groupBy === 'set' ? Math.round(((unique) / denom) * 100) : undefined;
                return (
                  <tr key={groupLabel} className="border-t border-gray-700 text-white">
                    <td className="py-2 pr-4">{groupLabel}</td>
                    <td className="py-2 pr-4">{unique}</td>
                    <td className="py-2 pr-4">{total}</td>
                    <td className="py-2 pr-4">{foils}</td>
                    {groupBy === 'set' && (
                      <td className="py-2 pr-4">{completion}%</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CollectionStatsPage;
