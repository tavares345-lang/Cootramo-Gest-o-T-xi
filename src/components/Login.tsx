import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Car, Lock, LogIn, MapPin, AlertTriangle, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { Sector } from '../types';
import { getInternalEmail, getAuthErrorMessage, FIREBASE_CONSOLE_AUTH_URL } from '../lib/auth-helpers';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [error, setError] = useState('');
  const [isAuthNotAllowed, setIsAuthNotAllowed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'sectors'), (snapshot) => {
      let sectorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
      
      // Auto-seed sectors if none exist
      const defaultSectors = [
        'Administração',
        'Balcão terminal 1',
        'Balcão terminal 2',
        'Balcão externo'
      ];

      if (snapshot.empty) {
        defaultSectors.forEach(async (name) => {
          await addDoc(collection(db, 'sectors'), { name });
        });
      } else {
        // Ensure "Administração" exists even if not empty
        const hasAdmin = sectorsData.some(s => s.name === 'Administração');
        if (!hasAdmin) {
          addDoc(collection(db, 'sectors'), { name: 'Administração' });
        }
      }

      // Sort sectors to put "Administração" first
      sectorsData.sort((a, b) => {
        if (a.name === 'Administração') return -1;
        if (b.name === 'Administração') return 1;
        return a.name.localeCompare(b.name);
      });

      setSectors(sectorsData);
      
      if (sectorsData.length > 0 && !selectedSectorId) {
        const adminSector = sectorsData.find(s => s.name === 'Administração');
        setSelectedSectorId(adminSector ? adminSector.id : sectorsData[0].id);
      }
    });
    return () => unsubscribe();
  }, [selectedSectorId]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectorId) {
      setError('Por favor, selecione um setor de trabalho.');
      return;
    }
    setLoading(true);
    setError('');
    setIsAuthNotAllowed(false);
    try {
      // Store sector in session for AuthContext to pick up if it's a new user
      sessionStorage.setItem('pendingSectorId', selectedSectorId);

      // Support simple name-based login by normalizing the input name
      const loginIdentifier = getInternalEmail(username);

      const userCredential = await signInWithEmailAndPassword(auth, loginIdentifier, password);
      const user = userCredential.user;
      
      // Check user document for role and sector
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const selectedSector = sectors.find(s => s.id === selectedSectorId);
      
      let finalSectorId = selectedSectorId;

      // If user selected "Administração" but is not an admin, smoothly redirect them to their counter
      if (selectedSector?.name === 'Administração' && userData?.role !== 'ADMINISTRADOR' && user.email !== 'tavares345@gmail.com') {
        const counterSector = sectors.find(s => s.name !== 'Administração') || sectors[0];
        if (counterSector) {
          finalSectorId = counterSector.id;
        }
      }

      // Update sector in user profile if it exists
      if (userDoc.exists()) {
        await updateDoc(doc(db, 'users', user.uid), {
          sectorId: finalSectorId
        });
        sessionStorage.removeItem('pendingSectorId');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const isTryingAdmin = username.toLowerCase().includes('tavares') || username.toLowerCase() === 'admin' || username.includes('tavares345');

      if (err.code === 'auth/operation-not-allowed') {
        setIsAuthNotAllowed(true);
        setError('O provedor de login por "E-mail/senha" está desativado no Firebase Console.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('Conflito de autenticação: Esta conta foi criada com outro método. Se você costuma acessar com o Google, clique no botão Google abaixo.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        if (isTryingAdmin) {
          setError('Credenciais incorretas. Como administrador (tavares345@gmail.com), você pode entrar diretamente com o botão "Google" abaixo.');
        } else {
          setError('Usuário ou senha incorretos. Verifique suas credenciais ou fale com o administrador.');
        }
      } else {
        setError(getAuthErrorMessage(err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!selectedSectorId) {
      setError('Por favor, selecione um setor de trabalho.');
      return;
    }
    setLoading(true);
    setError('');
    setIsAuthNotAllowed(false);
    try {
      const provider = new GoogleAuthProvider();
      // Store sector in session for AuthContext to pick up if it's a new user
      sessionStorage.setItem('pendingSectorId', selectedSectorId);
      
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Update sector in user profile if it exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        await updateDoc(doc(db, 'users', user.uid), {
          sectorId: selectedSectorId
        });
        sessionStorage.removeItem('pendingSectorId');
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('Conflito de autenticação: Já existe uma conta cadastrada com este e-mail usando senha. Entre usando seu usuário e senha no formulário acima.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelado: A janela do Google foi fechada.');
      } else {
        setError(getAuthErrorMessage(err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-neutral-200/50 p-8 md:p-12"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-200">
            <Car size={32} />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Táxi Gestão Pro</h1>
          <p className="text-neutral-500 text-sm mt-1 text-center">
            Acesse o sistema de gestão da cooperativa
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
              {error}
            </div>
            {isAuthNotAllowed && (
              <div className="mt-3 pt-3 border-t border-red-200/60 text-xs text-neutral-600 space-y-2">
                <p>
                  Para habilitar o login de funcionários com usuário e senha, ative o provedor <strong>E-mail/senha</strong> no console do Firebase:
                </p>
                <a
                  href={FIREBASE_CONSOLE_AUTH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  <ExternalLink size={14} />
                  Ativar no Firebase Console
                </a>
                <p className="text-[11px] text-neutral-500">
                  Como administrador, você também pode entrar diretamente clicando no botão <strong>Google</strong> abaixo.
                </p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5 ml-1">Setor de Trabalho</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <select
                required
                value={selectedSectorId}
                onChange={(e) => setSelectedSectorId(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none appearance-none"
              >
                <option value="" disabled>Selecione o setor</option>
                {sectors.map(sector => (
                  <option key={sector.id} value={sector.id}>{sector.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5 ml-1">Usuário</label>
            <div className="relative">
              <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                placeholder="Seu usuário"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                Entrar
              </>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-neutral-400 font-medium">Ou continue com</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Google
        </button>

        <p className="mt-8 text-center text-xs text-neutral-400">
          Problemas com acesso? Contate o administrador.
        </p>
      </motion.div>
    </div>
  );
}
