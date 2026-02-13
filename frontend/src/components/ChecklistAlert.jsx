import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { checklistPeriodiqueApi } from '../services/api';
import {
  AlertTriangle,
  Clock,
  CalendarDays,
  CalendarRange,
  Plus,
  BellOff,
  Volume2,
  X,
  Shield
} from 'lucide-react';

const TYPE_ROUTES = {
  'DEBUT_QUART': '/checklists/debut-quart',
  'HEBDOMADAIRE': '/checklists/hebdomadaire',
  'MENSUELLE': '/checklists/mensuelle',
};

const TYPE_ICONS = {
  'DEBUT_QUART': Clock,
  'HEBDOMADAIRE': CalendarDays,
  'MENSUELLE': CalendarRange,
};

const TYPE_COLORS = {
  'DEBUT_QUART': 'blue',
  'HEBDOMADAIRE': 'purple',
  'MENSUELLE': 'amber',
};

const SNOOZE_KEY = 'logitrack_checklist_snooze';
const POLL_INTERVAL = 60000; // 60 secondes
const SNOOZE_DURATION = 3600000; // 1 heure

function getSnoozeData() {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}');
  } catch { return {}; }
}

function setSnooze(typeCode) {
  const data = getSnoozeData();
  data[typeCode] = Date.now() + SNOOZE_DURATION;
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(data));
}

function isSnoozed(typeCode) {
  const data = getSnoozeData();
  return data[typeCode] && data[typeCode] > Date.now();
}

export default function ChecklistAlert() {
  const navigate = useNavigate();
  const [expiredTypes, setExpiredTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);

  // Générer un son d'alerte avec Web Audio API
  const playAlertSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      // Séquence de bips d'alerte
      const playBeep = (startTime, freq, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playBeep(now, 880, 0.15);
      playBeep(now + 0.2, 880, 0.15);
      playBeep(now + 0.5, 1100, 0.3);
    } catch (e) {
      console.warn('Audio alert failed:', e);
    }
  }, []);

  // Vérifier les expirations
  const checkExpiration = useCallback(async () => {
    try {
      const res = await checklistPeriodiqueApi.getTypes();
      const types = res.data;
      
      const expired = types.filter(t => !t.est_valide && !isSnoozed(t.code));
      
      if (expired.length > 0 && !dismissed) {
        setExpiredTypes(expired);
        setShowModal(true);
        playAlertSound();
      } else if (expired.length === 0) {
        setShowModal(false);
        setDismissed(false);
      }
    } catch (err) {
      // Silently fail — ne pas bloquer l'app
    }
  }, [dismissed, playAlertSound]);

  useEffect(() => {
    // Première vérification après 5 secondes (laisser l'app charger)
    const initialTimeout = setTimeout(checkExpiration, 5000);
    
    // Polling régulier
    const interval = setInterval(checkExpiration, POLL_INTERVAL);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkExpiration]);

  const handleSnooze = (typeCode) => {
    setSnooze(typeCode);
    const remaining = expiredTypes.filter(t => t.code !== typeCode);
    if (remaining.length === 0) {
      setShowModal(false);
      setDismissed(true);
    } else {
      setExpiredTypes(remaining);
    }
  };

  const handleSnoozeAll = () => {
    expiredTypes.forEach(t => setSnooze(t.code));
    setShowModal(false);
    setDismissed(true);
  };

  const handleCreate = (typeCode) => {
    setShowModal(false);
    setDismissed(true);
    navigate(TYPE_ROUTES[typeCode] || '/checklists/debut-quart');
  };

  const handleDismiss = () => {
    setShowModal(false);
    setDismissed(true);
  };

  if (!showModal || expiredTypes.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-800">Alerte Checklist</h2>
              <p className="text-sm text-red-600">
                {expiredTypes.length} checklist{expiredTypes.length > 1 ? 's' : ''} expirée{expiredTypes.length > 1 ? 's' : ''} ou non effectuée{expiredTypes.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
            <X className="w-5 h-5 text-red-400" />
          </button>
        </div>

        {/* Liste des types expirés */}
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {expiredTypes.map(t => {
            const IconComp = TYPE_ICONS[t.code] || Clock;
            const color = TYPE_COLORS[t.code] || 'blue';
            const bgColors = { blue: 'bg-blue-50', purple: 'bg-purple-50', amber: 'bg-amber-50' };
            const textColors = { blue: 'text-blue-600', purple: 'text-purple-600', amber: 'text-amber-600' };

            return (
              <div key={t.code} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${bgColors[color]}`}>
                    <IconComp className={`w-5 h-5 ${textColors[color]}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{t.nom}</p>
                    <p className="text-xs text-gray-500">
                      {t.derniere_session
                        ? `Dernière : ${new Date(t.derniere_session.date_validation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                        : 'Jamais effectuée'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSnooze(t.code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Rappeler dans 1 heure"
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    1h
                  </button>
                  <button
                    onClick={() => handleCreate(t.code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Créer
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleSnoozeAll}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <BellOff className="w-4 h-4" />
            Tout rappeler plus tard (1h)
          </button>
          <button
            onClick={() => { playAlertSound(); }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Tester le son"
          >
            <Volume2 className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
