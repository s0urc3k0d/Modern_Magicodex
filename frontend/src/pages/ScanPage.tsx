import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import Tesseract from 'tesseract.js';
import { cardsService, collectionService } from '../services/collection';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const ScanPage = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string>('');
  const [found, setFound] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [camError, setCamError] = useState<string | null>(null);
  const [isSecure, setIsSecure] = useState<boolean>(true);

  useEffect(() => {
    // Some browsers restrict camera to secure contexts (HTTPS) except localhost
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setIsSecure(window.isSecureContext || isLocalhost);
  }, []);

  const enumerateCameras = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter(d => d.kind === 'videoinput');
      setDevices(vids);
      if (!deviceId && vids[0]?.deviceId) setDeviceId(vids[0].deviceId);
    } catch (e) {
      // ignore
    }
  };

  const requestCamera = async () => {
    setCamError(null);
    try {
      // Trigger permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // Immediately stop tracks; ZXing will manage its own stream
      stream.getTracks().forEach(t => t.stop());
      await enumerateCameras();
      toast.success('Caméra autorisée');
    } catch (e: any) {
      setCamError(e?.name === 'NotAllowedError' ? 'Permission refusée' : 'Impossible d\'accéder à la caméra');
      toast.error('Caméra non accessible');
    }
  };

  const startScanning = async () => {
    setResult('');
    setFound(null);
    if (!deviceId) {
      toast.error('Aucune caméra sélectionnée');
      return;
    }
    const reader = new BrowserMultiFormatReader();
    setScanning(true);
    try {
      await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (res) => {
        if (res) {
          setResult(res.getText());
          setScanning(false);
        }
      });
    } catch (e) {
      setScanning(false);
      setCamError('Échec du démarrage du scanner');
    }
  };

  useEffect(() => {
    const go = async () => {
      if (!result) return;
      setIsLoading(true);
      try {
        // Heuristic: try numeric/UPC mapping later; for now, search by code as text
        const { cards } = await cardsService.getCardsFts(result, 10);
        if (cards?.length) {
          setFound(cards[0]);
        } else {
          toast('Aucune carte trouvée');
        }
      } catch (e) {
        toast.error('Recherche échouée');
      } finally {
        setIsLoading(false);
      }
    };
    go();
  }, [result]);

  const addFirst = async () => {
    if (!found) return;
    try {
      await collectionService.addCard(found.id, 1, false);
      toast.success('Carte ajoutée');
    } catch {
      toast.error("Ajout échoué");
    }
  };

  const runOCR = async () => {
    if (!videoRef.current) return;
    try {
      setOcrRunning(true);
      // Capture frame to canvas (downscale to speed up OCR)
      const video = videoRef.current;
      const width = Math.min(640, video.videoWidth || 640);
      const height = Math.round((video.videoHeight || 360) * (width / (video.videoWidth || 640)));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unsupported');
      ctx.drawImage(video, 0, 0, width, height);
      // 1) Bas de carte: essayer d'extraire collector number et métadonnées
      const bottomH = Math.round(height * 0.28);
      const bottomCanvas = document.createElement('canvas');
      bottomCanvas.width = width; bottomCanvas.height = bottomH;
      const bctx = bottomCanvas.getContext('2d');
      if (!bctx) throw new Error('Canvas unsupported');
      const bottomImg = ctx.getImageData(0, height - bottomH, width, bottomH);
      bctx.putImageData(bottomImg, 0, 0);
      const bottomUrl = bottomCanvas.toDataURL('image/png');
      const bottomRes = await Tesseract.recognize(bottomUrl, 'eng');
      const bottomText = (bottomRes?.data?.text || '').replace(/\s+/g, ' ').trim();
      // Tentative de pattern: set code (3-5 lettres) et collector number (\d+[a-z]?)
      // On va surtout chercher un numéro de collection
      const collectorMatch = bottomText.match(/\b(\d{1,4}[a-z]?)\b/i);
      // Rareté heuristique: lettres comme C,U,R,M ou mots
      const rarity = /mythic|mythique|\bM\b/i.test(bottomText) ? 'mythic'
        : /rare|\bR\b/i.test(bottomText) ? 'rare'
        : /uncommon|\bU\b/i.test(bottomText) ? 'uncommon'
        : /common|\bC\b/i.test(bottomText) ? 'common'
        : undefined;
      // Lang heuristique (FR/EN etc.) si présent
      const lang = /\bFR\b|Français/i.test(bottomText) ? 'fr'
        : /\bEN\b|English/i.test(bottomText) ? 'en'
        : undefined;
      // Année du set si présent (4 chiffres récents)
      const yearMatch = bottomText.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

      if (collectorMatch) {
        setIsLoading(true);
        const collector = collectorMatch[1];
        const { cards } = await cardsService.identifyByBottom(collector, { year, rarity, lang });
        if (cards?.length) {
          setFound(cards[0]);
          toast.success('Carte reconnue par numéro');
          return;
        }
      }

      // 2) Si bas de carte insuffisant, fallback sur le haut (nom)
      const topH = Math.round(height * 0.30);
      const topCanvas = document.createElement('canvas');
      topCanvas.width = width; topCanvas.height = topH;
      const tctx = topCanvas.getContext('2d');
      if (!tctx) throw new Error('Canvas unsupported');
      const topImg = ctx.getImageData(0, 0, width, topH);
      tctx.putImageData(topImg, 0, 0);
      const topUrl = topCanvas.toDataURL('image/png');
      const { data } = await Tesseract.recognize(topUrl, 'eng');
      const text = (data?.text || '').replace(/\s+/g, ' ').trim();
      if (!text) {
        toast('OCR: aucun texte détecté');
        return;
      }
      const lines = (data.text || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
      const candidates = lines.filter(l => l.length <= 40).sort((a,b) => a.length - b.length);
      const query = (candidates[0] || text).replace(/[^\w'\-\s]/g, ' ').trim();
      setIsLoading(true);
      const { cards } = await cardsService.getCardsFts(query, 10);
      if (cards?.length) {
        setFound(cards[0]);
        toast.success('Carte reconnue');
      } else {
        toast('Aucun résultat pour: ' + query);
      }
    } catch (e) {
      toast.error('OCR échoué');
    } finally {
      setIsLoading(false);
      setOcrRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Scanner code‑barres</h1>
        <p className="text-gray-400">Scannez un code‑barres pour rechercher une carte</p>
      </div>

      <div className="card p-4">
        {/* Camera controls */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-300 mb-1">Caméra</label>
            <select value={deviceId} onChange={(e)=>setDeviceId(e.target.value)} className="input w-full">
              <option value="">Sélectionner…</option>
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Caméra ${d.deviceId.slice(0,6)}`}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={requestCamera} className="btn-outline">Autoriser caméra</button>
            <button onClick={enumerateCameras} className="btn-outline">Lister</button>
            <button onClick={startScanning} className="btn-primary">Démarrer scan</button>
          </div>
        </div>
        
        {!isSecure && (
          <div className="mb-3 text-yellow-400 text-sm">Astuce: utilisez HTTPS ou localhost pour accéder à la caméra.</div>
        )}
        
        {camError && (
          <div className="mb-3 text-red-400 text-sm">{camError}</div>
        )}

        <div className="aspect-video bg-black rounded overflow-hidden mb-3">
          <video ref={videoRef} className="w-full h-full object-cover" muted autoPlay playsInline />
        </div>
        {scanning ? (
          <div className="text-gray-400">Scanning…</div>
        ) : result ? (
          <div className="text-gray-300 break-all">Code: {result}</div>
        ) : (
          <div className="text-gray-400">Caméra inactive</div>
        )}
        <div className="mt-3">
          <button disabled={ocrRunning} onClick={runOCR} className="btn-outline">
            {ocrRunning ? 'OCR…' : 'Reconnaître par image (OCR)'}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-xl text-white font-semibold mb-2">Résultat</h2>
        {isLoading ? (
          <div className="py-6"><LoadingSpinner/></div>
        ) : found ? (
          <div className="flex items-center gap-3">
            <img src={(found.imageUris?.small || found.imageUris?.normal || '')} alt="" className="w-16 h-22 object-cover rounded" />
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">{found.nameFr || found.name}</div>
              <div className="text-gray-400 text-sm">{found.set?.code?.toUpperCase()} #{found.collectorNumber}</div>
            </div>
            <button onClick={addFirst} className="btn-primary">Ajouter</button>
          </div>
        ) : (
          <div className="text-gray-400">Aucun résultat</div>
        )}
      </div>
    </div>
  );
};

export default ScanPage;