import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, AlertCircle, Eye, EyeOff, KeyRound, Shield, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithCode } = useAuth();
  const { t } = useTranslation();
  
  // Mode: 'code' pour opérateurs (par défaut), 'admin' pour username/password
  const [mode, setMode] = useState('code');
  
  // Code login state (6 chiffres)
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const codeInputRefs = useRef([]);
  
  // Admin login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  // Focus sur le premier input quand on passe en mode code
  useEffect(() => {
    if (mode === 'code' && codeInputRefs.current[0]) {
      codeInputRefs.current[0].focus();
    }
  }, [mode]);

  // Gestion de la saisie du code
  const handleCodeChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    
    const newDigits = [...codeDigits];
    newDigits[index] = value;
    setCodeDigits(newDigits);
    setError('');
    
    // Auto-focus sur le suivant
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit quand 6 chiffres sont entrés
    if (value && index === 5) {
      const fullCode = newDigits.join('');
      if (fullCode.length === 6) {
        handleCodeSubmit(fullCode);
      }
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodeSubmit = async (code) => {
    setError('');
    setLoading(true);

    const result = await loginWithCode(code);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error);
      setCodeDigits(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    }
    
    setLoading(false);
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const switchToAdmin = () => {
    setMode('admin');
    setError('');
    setCodeDigits(['', '', '', '', '', '']);
  };

  const switchToCode = () => {
    setMode('code');
    setError('');
    setUsername('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-logitrack">
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <img 
                src="/logo.png" 
                alt="Logi-Track" 
                className="h-20 w-auto drop-shadow-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden w-20 h-20 rounded-2xl bg-white/10 backdrop-blur items-center justify-center">
                <Shield className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Logi-Track</h1>
            <p className="text-primary-200 text-lg">
              {t('login.suivi_production')}
            </p>
            <p className="text-primary-300/70 text-sm mt-1">{t('login.tubes_spirale')}</p>
          </div>

          {/* Formulaire */}
          <div className="card animate-slideUp">
            {mode === 'code' ? (
              /* Login par code opérateur */
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 mb-4">
                    <KeyRound className="w-7 h-7 text-primary-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">{t('login.connexion_operateur')}</h2>
                  <p className="text-gray-500 mt-1">{t('login.entrez_code')}</p>
                </div>

                {/* Code inputs */}
                <div className="flex justify-center gap-2 mb-6">
                  {codeDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => codeInputRefs.current[index] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      disabled={loading}
                      className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                        ${error ? 'border-danger-300 bg-danger-50' : 'border-gray-300'}
                        ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    />
                  ))}
                </div>

                {/* Erreur */}
                {error && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-600">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                )}

                {/* Loading */}
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-primary-600 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">{t('login.verification')}</span>
                  </div>
                )}

                {/* Switch to admin */}
                <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                  <button
                   onClick={switchToAdmin}
                    className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    {t('login.connexion_admin')}
                  </button>
                </div>
              </>
            ) : (
              /* Login admin */
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 mb-4">
                    <Shield className="w-7 h-7 text-primary-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">{t('login.connexion_admin_titre')}</h2>
                  <p className="text-gray-500 mt-1">{t('login.acces_superviseur')}</p>
                </div>

                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('login.nom_utilisateur')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="input-field pl-10"
                        placeholder={t('login.votre_identifiant')}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('login.mot_de_passe')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field pl-10 pr-10"
                        placeholder="••••••••"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Erreur */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-xl text-danger-600">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('login.connexion_en_cours')}
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        {t('login.se_connecter')}
                      </>
                    )}
                  </button>
                </form>

                {/* Switch to code */}
                <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                  <button
                    onClick={switchToCode}
                    className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                    {t('login.connexion_par_code')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-primary-200 text-sm">
          {t('footer.credit')}{' '}
          <span className="font-semibold text-white">Azizi Mounir</span> – Février 2026
        </p>
      </footer>
    </div>
  );
}
