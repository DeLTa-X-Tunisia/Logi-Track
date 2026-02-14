import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/I18nContext';
import { 
  Cylinder, 
  Eye, 
  Flame, 
  Scan, 
  Scissors, 
  Droplet,
  CheckCircle,
  Award,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowRight,
  Activity,
  Package,
  Beaker,
  BarChart3,
  CircleDot,
  Zap,
  Ruler,
  SearchCheck,
  Gauge,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';

// Mapping icônes par code d'étape (12 étapes API 5L)
const ETAPE_ICONS = {
  FORMAGE:      Cylinder,      // Formage du tube
  POINTAGE:     Zap,           // Pointage GMAW (éclair = soudure rapide)
  CV_POINTAGE:  Eye,           // Contrôle visuel pointage
  SAW_ID_OD:    Flame,         // Soudage SAW
  CV_CORDON:    SearchCheck,   // Contrôle visuel cordon
  COUPE:        Scissors,      // Coupe
  CND:          Scan,          // CND Xray/UT
  CV_APRES_CND: Eye,           // Contrôle visuel après CND
  HYDROTEST:    Gauge,         // Test hydraulique (manomètre/pression)
  CV_FUITE:     Droplet,       // Contrôle fuite/déformation
  CHANFREIN:    Ruler,         // Chanfrein (mesure/finition)
  CV_CHANFREIN: CheckCircle,   // Contrôle final chanfrein
};

const ETAPE_COLORS = {
  FORMAGE:      { bg: 'bg-blue-600',    bgLight: 'bg-blue-50',    text: 'text-blue-600' },
  POINTAGE:     { bg: 'bg-orange-500',  bgLight: 'bg-orange-50',  text: 'text-orange-600' },
  CV_POINTAGE:  { bg: 'bg-purple-500',  bgLight: 'bg-purple-50',  text: 'text-purple-600' },
  SAW_ID_OD:    { bg: 'bg-amber-500',   bgLight: 'bg-amber-50',   text: 'text-amber-600' },
  CV_CORDON:    { bg: 'bg-violet-500',  bgLight: 'bg-violet-50',  text: 'text-violet-600' },
  COUPE:        { bg: 'bg-green-600',   bgLight: 'bg-green-50',   text: 'text-green-600' },
  CND:          { bg: 'bg-red-500',     bgLight: 'bg-red-50',     text: 'text-red-600' },
  CV_APRES_CND: { bg: 'bg-rose-500',    bgLight: 'bg-rose-50',    text: 'text-rose-600' },
  HYDROTEST:    { bg: 'bg-cyan-600',    bgLight: 'bg-cyan-50',    text: 'text-cyan-600' },
  CV_FUITE:     { bg: 'bg-teal-500',    bgLight: 'bg-teal-50',    text: 'text-teal-600' },
  CHANFREIN:    { bg: 'bg-lime-600',    bgLight: 'bg-lime-50',    text: 'text-lime-600' },
  CV_CHANFREIN: { bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-600' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, direction } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      const response = await api.get('/dashboard/stats');
      setData(response.data);
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
      setError(t('dashboard.erreur_chargement'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-12 h-12 text-danger-500" />
        <p className="text-gray-600">{error}</p>
        <button onClick={loadData} className="btn-primary">{t('dashboard.reessayer')}</button>
      </div>
    );
  }

  const tubes = data?.tubes || {};
  const etapes = data?.etapes || [];
  const coulees = data?.coulees || {};
  const bobines = data?.bobines || {};
  const activite = data?.activite_recente || [];

  const tauxRebut = (tubes.termines + tubes.rebuts) > 0
    ? ((tubes.rebuts / (tubes.termines + tubes.rebuts)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.titre')}</h1>
          <p className="text-gray-500 mt-1">{t('dashboard.vue_ensemble')}</p>
        </div>
        <button 
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-success-50 text-success-600 rounded-xl hover:bg-success-100 transition-colors"
        >
          <Activity className="w-5 h-5" />
          <span className="font-medium">{t('dashboard.actualiser')}</span>
        </button>
      </div>

      {/* Stats Cards principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title={t('dashboard.tubes_en_cours')}
          value={tubes.en_cours}
          icon={Clock}
          color="primary"
          trend={`${tubes.production_jour} ${t('dashboard.crees_aujourdhui')}`}
        />
        <StatCard
          title={t('dashboard.tubes_termines')}
          value={tubes.termines}
          icon={CheckCircle}
          color="success"
          trend={`${tubes.termines_jour} ${t('dashboard.aujourdhui')}`}
        />
        <StatCard
          title={t('dashboard.certifie_api', 'Certifié API')}
          value={tubes.certifie_api || 0}
          icon={ShieldCheck}
          color="warning"
          trend={`${tubes.total > 0 ? ((tubes.certifie_api / tubes.total) * 100).toFixed(0) : 0}% ${t('dashboard.du_total', 'du total')}`}
        />
        <StatCard
          title={t('dashboard.certifie_hydraulique', 'Certifié Hydraulique')}
          value={tubes.certifie_hydraulique || 0}
          icon={Award}
          color="info"
          trend={`${tubes.total > 0 ? ((tubes.certifie_hydraulique / tubes.total) * 100).toFixed(0) : 0}% ${t('dashboard.du_total', 'du total')}`}
        />
        <StatCard
          title={t('dashboard.rebuts')}
          value={tubes.rebuts}
          icon={AlertTriangle}
          color="danger"
          trend={`${tauxRebut}% ${t('dashboard.taux_rebut')}`}
        />
        <StatCard
          title={t('dashboard.total_tubes')}
          value={tubes.total}
          icon={TrendingUp}
          color="accent"
          trend={`${tubes.reparation} ${t('dashboard.en_reparation')}`}
        />
      </div>

      {/* Étapes de production */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.pipeline')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {etapes.map((etape, index) => {
            const Icon = ETAPE_ICONS[etape.code] || Cylinder;
            const colors = ETAPE_COLORS[etape.code] || ETAPE_COLORS.FORMAGE;
            return (
              <div key={etape.id || index} className="group relative">
                <div className={`flex flex-col items-center p-4 rounded-xl ${colors.bgLight} transition-all duration-200 hover:shadow-md`}>
                  <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                    {t(`etape.${etape.code}`, etape.nom)}
                  </span>
                  <span className={`text-lg font-bold mt-1 ${etape.tubes_count > 0 ? colors.text : 'text-gray-400'}`}>
                    {etape.tubes_count}
                  </span>
                </div>
                {index < etapes.length - 1 && (
                  <ArrowRight className={`hidden lg:block absolute top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-300 z-10 ${direction === 'rtl' ? '-left-3 rotate-180' : '-right-3'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bobines & Coulées + Activité */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Résumé Bobines */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.bobines')}</h2>
            <button onClick={() => navigate('/bobines')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              {t('dashboard.voir_tout')}
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-500" />
                <span className="text-sm text-gray-600">{t('dashboard.en_stock')}</span>
              </div>
              <span className="font-bold text-gray-900">{bobines.en_stock}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Cylinder className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">{t('dashboard.en_cours_utilisation')}</span>
              </div>
              <span className="font-bold text-gray-900">{bobines.en_cours}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">{t('dashboard.poids_total')}</span>
              </div>
              <span className="font-bold text-gray-900">{(bobines.poids_total / 1000).toFixed(1)}t</span>
            </div>
          </div>
        </div>

        {/* Résumé Coulées */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.coulees')}</h2>
            <button onClick={() => navigate('/coulees')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              {t('dashboard.voir_tout')}
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Beaker className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-gray-600">{t('dashboard.en_production')}</span>
              </div>
              <span className="font-bold text-orange-600">{coulees.en_production}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">{t('dashboard.en_preparation')}</span>
              </div>
              <span className="font-bold text-gray-900">{coulees.en_cours}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-600">{t('dashboard.pretes')}</span>
              </div>
              <span className="font-bold text-green-600">{coulees.pret}</span>
            </div>
          </div>
        </div>

        {/* Activité récente */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.activite_recente')}</h2>
          {activite.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('dashboard.aucune_activite')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activite.slice(0, 5).map((item) => {
                const Icon = ETAPE_ICONS[item.etape_code] || Activity;
                const colors = ETAPE_COLORS[item.etape_code] || { text: 'text-gray-500' };
                return (
                  <ActivityItem
                    key={item.id}
                    icon={Icon}
                    color={colors.text}
                    title={`${item.tube_numero} — ${t(`etape.${item.etape_code}`, item.etape_nom)}`}
                    subtitle={item.operateur_nom}
                    time={formatTimeAgo(item.date_debut, t)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }) {
  const colors = {
    primary: { bg: 'bg-primary-50', text: 'text-primary-600', icon: 'bg-primary-100' },
    success: { bg: 'bg-success-50', text: 'text-success-600', icon: 'bg-success-100' },
    danger: { bg: 'bg-danger-50', text: 'text-danger-600', icon: 'bg-danger-100' },
    accent: { bg: 'bg-accent-50', text: 'text-accent-600', icon: 'bg-accent-100' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'bg-amber-100' },
    info: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100' },
  };

  const colorConfig = colors[color] || colors.primary;

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          <p className={`text-xs mt-2 ${colorConfig.text}`}>{trend}</p>
        </div>
        <div className={`p-3 rounded-xl ${colorConfig.icon}`}>
          <Icon className={`w-6 h-6 ${colorConfig.text}`} />
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ icon: Icon, color, title, subtitle, time }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
      <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">{time}</span>
    </div>
  );
}

function formatTimeAgo(dateStr, t) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return t('dashboard.a_linstant');
  if (diffMin < 60) return t('dashboard.il_y_a_min').replace('{n}', diffMin);
  if (diffH < 24) return t('dashboard.il_y_a_h').replace('{n}', diffH);
  if (diffD < 7) return t('dashboard.il_y_a_j').replace('{n}', diffD);
  return date.toLocaleDateString();
}
