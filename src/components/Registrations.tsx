import React, { useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from '../firebase';
import { Driver, Employee, Sector, PaymentMethod, Destination } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  Users, 
  Car, 
  MapPin, 
  CreditCard, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  MoreVertical, 
  Navigation, 
  Upload, 
  DollarSign,
  AlertTriangle,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  normalizeUsername, 
  getInternalEmail, 
  getAuthErrorMessage, 
  generateUniqueUsername,
  FIREBASE_CONSOLE_AUTH_URL 
} from '../lib/auth-helpers';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useAuth } from '../contexts/AuthContext';

type Tab = 'drivers' | 'employees' | 'sectors' | 'payments' | 'destinations';

export default function Registrations() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('drivers');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showAuthNotAllowedModal, setShowAuthNotAllowedModal] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState<{ data: any; username: string } | null>(null);
  const [savingWithoutAuth, setSavingWithoutAuth] = useState(false);
  const [authConflictEmployee, setAuthConflictEmployee] = useState<{
    data: any;
    username: string;
    suggestedUsername: string;
  } | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [formName, setFormName] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile) return;

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers');
    });
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'employees');
    });
    const unsubSectors = onSnapshot(collection(db, 'sectors'), (snapshot) => {
      setSectors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sectors');
    });
    const unsubMethods = onSnapshot(collection(db, 'paymentMethods'), (snapshot) => {
      setPaymentMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'paymentMethods');
    });
    const unsubDestinations = onSnapshot(collection(db, 'destinations'), (snapshot) => {
      setDestinations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Destination)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'destinations');
    });

    return () => {
      unsubDrivers();
      unsubEmployees();
      unsubSectors();
      unsubMethods();
      unsubDestinations();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    // Convert numeric values
    if (activeTab === 'paymentMethods' && data.feePercentage) {
      data.feePercentage = parseFloat(data.feePercentage as string) as any;
    }
    if (activeTab === 'paymentMethods' && data.fixedFee) {
      data.fixedFee = parseFloat(data.fixedFee as string) as any;
    }
    if (activeTab === 'destinations' && data.value) {
      data.value = parseFloat(data.value as string) as any;
    }

    try {
      if (activeTab === 'employees' && !editingItem && data.name && data.password) {
        if ((data.password as string).length < 6) {
          alert('A senha deve ter pelo menos 6 caracteres.');
          return;
        }

        // Determine username (either custom or normalized from name)
        const customField = (data.customUsername as string)?.trim();
        const username = customField ? normalizeUsername(customField) : normalizeUsername(data.name as string);
        const internalEmail = getInternalEmail(username);
        
        console.log('Registering employee:', { username, internalEmail });
        
        // Use a unique name for the secondary app to avoid conflicts
        const appName = `Secondary-${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, appName);
        try {
          const secondaryAuth = getAuth(secondaryApp);
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, data.password as string);
          const newUser = userCredential.user;
          
          // Create user profile in 'users' collection
          await setDoc(doc(db, 'users', newUser.uid), {
            uid: newUser.uid,
            name: data.name,
            username: username,
            email: internalEmail,
            role: data.role,
            active: true
          });
          
          // Remove password and customUsername from data before saving to Firestore
          const { password, customUsername, ...employeeData } = data;
          
          // Add to 'employees' collection
          await addDoc(collection(db, 'employees'), {
            ...employeeData,
            username: username,
            uid: newUser.uid,
            active: true
          });
        } catch (authError: any) {
          console.error('Auth creation error:', authError);
          if (authError.code === 'auth/operation-not-allowed') {
            setPendingEmployee({ data, username });
            setShowAuthNotAllowedModal(true);
            return;
          }
          if (authError.code === 'auth/email-already-in-use') {
            // Authentication conflict: username/email is already registered
            const suggested = generateUniqueUsername(username, employees.map(e => e.username || ''));
            setAuthConflictEmployee({
              data,
              username,
              suggestedUsername: suggested
            });
            return;
          }
          alert(getAuthErrorMessage(authError.code));
          return;
        } finally {
          await deleteApp(secondaryApp);
        }
      } else if (editingItem) {
        const { password, customUsername: custUser, ...updateData } = data;
        const docRef = doc(db, activeTab, editingItem.id);

        // If it's an employee and a password was given, but employee has no Auth UID yet
        if (activeTab === 'employees' && !editingItem.uid && password) {
          if ((password as string).length < 6) {
            alert('A senha deve ter pelo menos 6 caracteres.');
            return;
          }
          const empUsername = custUser ? normalizeUsername(custUser as string) : (editingItem.username || normalizeUsername(data.name as string));
          const internalEmail = getInternalEmail(empUsername);
          const appName = `Secondary-${Date.now()}`;
          const secondaryApp = initializeApp(firebaseConfig, appName);
          try {
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, password as string);
            const newUser = userCredential.user;

            await setDoc(doc(db, 'users', newUser.uid), {
              uid: newUser.uid,
              name: data.name,
              username: empUsername,
              email: internalEmail,
              role: data.role,
              active: true
            });

            updateData.uid = newUser.uid;
            updateData.username = empUsername;
          } catch (authErr: any) {
            if (authErr.code === 'auth/operation-not-allowed') {
              setPendingEmployee({ data: { ...data, password }, username: empUsername });
              setShowAuthNotAllowedModal(true);
              return;
            }
            if (authErr.code === 'auth/email-already-in-use') {
              const suggested = generateUniqueUsername(empUsername, employees.map(e => e.username || ''));
              setAuthConflictEmployee({
                data: { ...data, password },
                username: empUsername,
                suggestedUsername: suggested
              });
              return;
            }
            alert(getAuthErrorMessage(authErr.code));
            return;
          } finally {
            await deleteApp(secondaryApp);
          }
        }

        // Keep users collection profile in sync if role or name changed
        if (activeTab === 'employees' && editingItem.uid) {
          try {
            await updateDoc(doc(db, 'users', editingItem.uid), {
              name: data.name,
              role: data.role
            });
          } catch (e) {
            console.warn('Could not update user document:', e);
          }
        }

        await updateDoc(docRef, updateData);
      } else {
        const { password, customUsername, ...createData } = data;
        await addDoc(collection(db, activeTab), { ...createData, active: true });
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      console.error('Save error:', error);
      if (error?.code === 'auth/operation-not-allowed') {
        const username = normalizeUsername(data?.name as string || '');
        setPendingEmployee({ data, username });
        setShowAuthNotAllowedModal(true);
        return;
      }
      if (error?.code?.startsWith('auth/')) {
        alert(getAuthErrorMessage(error.code));
        return;
      }
      alert('Erro ao salvar no banco de dados: ' + (error.message || 'Ocorreu um erro inesperado.'));
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, `${activeTab}/${editingItem?.id || ''}`);
    }
  };

  const handleResolveConflictWithSuggested = async () => {
    if (!authConflictEmployee) return;
    setResolvingConflict(true);
    try {
      const suggestedUsername = authConflictEmployee.suggestedUsername;
      const suggestedEmail = getInternalEmail(suggestedUsername);
      const appName = `Secondary-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, appName);
      try {
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          suggestedEmail, 
          authConflictEmployee.data.password as string
        );
        const newUser = userCredential.user;

        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          name: authConflictEmployee.data.name,
          username: suggestedUsername,
          email: suggestedEmail,
          role: authConflictEmployee.data.role,
          active: true
        });

        const { password, customUsername, ...employeeData } = authConflictEmployee.data;
        await addDoc(collection(db, 'employees'), {
          ...employeeData,
          username: suggestedUsername,
          uid: newUser.uid,
          active: true
        });

        setAuthConflictEmployee(null);
        setIsModalOpen(false);
        setEditingItem(null);
        alert(`Conflito resolvido! Funcionário cadastrado com o usuário @${suggestedUsername}.`);
      } finally {
        await deleteApp(secondaryApp);
      }
    } catch (err: any) {
      alert(getAuthErrorMessage(err.code));
    } finally {
      setResolvingConflict(false);
    }
  };

  const handleSaveConflictWithoutAuth = async () => {
    if (!authConflictEmployee) return;
    setSavingWithoutAuth(true);
    try {
      const { password, customUsername, ...employeeData } = authConflictEmployee.data;
      await addDoc(collection(db, 'employees'), {
        ...employeeData,
        username: authConflictEmployee.username,
        active: true
      });
      setAuthConflictEmployee(null);
      setIsModalOpen(false);
      setEditingItem(null);
      alert('Funcionário salvo na lista com sucesso.');
    } catch (err: any) {
      console.error('Error saving employee without auth:', err);
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    } finally {
      setSavingWithoutAuth(false);
    }
  };

  const handleSaveEmployeeWithoutAuth = async () => {
    if (!pendingEmployee) return;
    setSavingWithoutAuth(true);
    try {
      const { password, ...employeeData } = pendingEmployee.data;
      await addDoc(collection(db, 'employees'), {
        ...employeeData,
        username: pendingEmployee.username,
        active: true
      });
      setShowAuthNotAllowedModal(false);
      setPendingEmployee(null);
      setIsModalOpen(false);
      setEditingItem(null);
      alert('Funcionário salvo na lista com sucesso! Assim que você ativar o provedor "E-mail/senha" no Firebase Console, o acesso com senha poderá ser liberado.');
    } catch (err: any) {
      console.error('Error saving employee without auth:', err);
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    } finally {
      setSavingWithoutAuth(false);
    }
  };

  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setIsImporting(false);
          return;
        }

        // Split by lines and handle both \n and \r\n
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length === 0) {
          setIsImporting(false);
          return;
        }

        // Detect separator (comma or semicolon)
        const firstLine = lines[0];
        const separator = firstLine.includes(';') ? ';' : ',';

        // Regex to split by separator while ignoring separators inside quotes
        const splitLine = (line: string) => {
          const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
          return line.split(regex).map(cell => cell.trim().replace(/^"|"$/g, ''));
        };

        const rows = lines.map(splitLine);
        
        // Skip header if exists
        const firstCell = rows[0][0].toLowerCase();
        const hasHeader = firstCell.includes('nome') || firstCell.includes('destino');
        const startIdx = hasHeader ? 1 : 0;

        let importCount = 0;
        let batch = writeBatch(db);
        let batchCount = 0;

        for (let i = startIdx; i < rows.length; i++) {
          const row = rows[i];
          const name = row[0]?.trim();
          const region = row[1]?.trim() || '';
          const rawValue = row[2]?.trim() || '0';

          if (name) {
            // Clean value: remove R$, spaces
            let cleanValue = rawValue
              .replace('R$', '')
              .replace(/\s/g, '');
            
            // Handle Brazilian vs US format
            // If both . and , are present, remove the first one and replace the second with .
            // If only , is present, replace it with .
            // If only . is present, keep it.
            const hasComma = cleanValue.includes(',');
            const hasDot = cleanValue.includes('.');

            if (hasComma && hasDot) {
              const commaIdx = cleanValue.indexOf(',');
              const dotIdx = cleanValue.indexOf('.');
              if (commaIdx > dotIdx) {
                // Brazilian format: 1.234,56
                cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
              } else {
                // US format: 1,234.56
                cleanValue = cleanValue.replace(/,/g, '');
              }
            } else if (hasComma) {
              cleanValue = cleanValue.replace(',', '.');
            }
            
            const value = parseFloat(cleanValue) || 0;

            const docRef = doc(collection(db, 'destinations'));
            batch.set(docRef, {
              name,
              region,
              value,
              active: true
            });

            importCount++;
            batchCount++;

            // Firestore batch limit is 500
            if (batchCount === 500) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }
        }

        // Commit remaining items
        if (batchCount > 0) {
          await batch.commit();
        }

        alert(`Importação concluída! ${importCount} destinos foram adicionados.`);
        // Reset input
        e.target.value = '';
      } catch (error) {
        console.error('Erro ao importar:', error);
        alert('Erro ao importar arquivo. Verifique se o formato está correto (CSV com colunas: Destino, Região, Valor).');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const toggleStatus = async (item: any) => {
    const docRef = doc(db, activeTab, item.id);
    await updateDoc(docRef, { active: !item.active });
  };

  const handleDelete = async () => {
    if (itemToDelete) {
      try {
        if (activeTab === 'employees') {
          const emp = employees.find(e => e.id === itemToDelete);
          if (emp?.uid) {
            try {
              await updateDoc(doc(db, 'users', emp.uid), { active: false });
            } catch (e) {
              console.warn('Could not deactivate user profile:', e);
            }
          }
        }
        await deleteDoc(doc(db, activeTab, itemToDelete));
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setCustomUsername('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setCustomUsername(item.username || '');
    setIsModalOpen(true);
  };

  const tabs = [
    { id: 'drivers', label: 'Motoristas', icon: Car },
    { id: 'employees', label: 'Funcionários', icon: Users },
    { id: 'sectors', label: 'Setores', icon: MapPin },
    { id: 'paymentMethods', label: 'Formas de Pagamento', icon: CreditCard },
    { id: 'destinations', label: 'Destinos', icon: Navigation },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-neutral-200/50 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-white text-emerald-600 shadow-sm" 
                : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Header */}
      <div className="flex items-center justify-between">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'destinations' && (
            <label className={cn(
              "flex items-center gap-2 px-6 py-2.5 bg-white border border-neutral-200 text-neutral-700 rounded-xl font-bold hover:bg-neutral-50 transition-all cursor-pointer",
              isImporting && "opacity-50 cursor-not-allowed"
            )}>
              <Upload size={18} className={isImporting ? "animate-bounce" : ""} />
              {isImporting ? 'Importando...' : 'Importar CSV'}
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" disabled={isImporting} />
            </label>
          )}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Plus size={18} />
            Novo Registro
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-100">
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Nome / Identificação</th>
                {activeTab === 'drivers' && (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Unidade</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Placa</th>
                  </>
                )}
                {activeTab === 'employees' && <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Cargo</th>}
                {activeTab === 'paymentMethods' && (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Taxa (%)</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Taxa Fixa (R$)</th>
                  </>
                )}
                {activeTab === 'destinations' && (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Região</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Valor</th>
                  </>
                )}
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {activeTab === 'drivers' && drivers.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500">
                        <Car size={20} />
                      </div>
                      <span className="font-bold text-neutral-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600">{item.unitNumber}</td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600">{item.licensePlate}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleStatus(item)} className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      item.active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {item.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {item.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(item)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
                      <button onClick={() => confirmDelete(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Similar rows for other tabs... simplified for brevity */}
              {activeTab === 'sectors' && sectors.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500">
                        <MapPin size={20} />
                      </div>
                      <span className="font-bold text-neutral-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">-</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(item)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
                      <button onClick={() => confirmDelete(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 'paymentMethods' && paymentMethods.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500">
                        <CreditCard size={20} />
                      </div>
                      <span className="font-bold text-neutral-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600">{item.feePercentage}%</td>
                  <td className="px-6 py-4 text-sm font-bold text-red-500">R$ {item.fixedFee?.toFixed(2) || '0.00'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleStatus(item)} className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      item.active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {item.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {item.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(item)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
                      <button onClick={() => confirmDelete(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 'employees' && employees.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500">
                        <Users size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-neutral-900">{item.name}</span>
                        {item.username && <span className="text-[10px] text-neutral-400">@{item.username}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600">{item.role}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleStatus(item)} className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      item.active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {item.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {item.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(item)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
                      <button onClick={() => confirmDelete(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 'destinations' && destinations.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500">
                        <Navigation size={20} />
                      </div>
                      <span className="font-bold text-neutral-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600">{item.region}</td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600">R$ {item.value.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleStatus(item)} className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      item.active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {item.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {item.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(item)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
                      <button onClick={() => confirmDelete(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
              <h3 className="text-xl font-bold text-neutral-900 mb-6">
                {editingItem ? 'Editar' : 'Novo'} {tabs.find(t => t.id === activeTab)?.label.slice(0, -1)}
              </h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Nome</label>
                  <input 
                    name="name" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                </div>
                {activeTab === 'drivers' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Nº Unidade</label>
                      <input name="unitNumber" defaultValue={editingItem?.unitNumber} required className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Placa</label>
                      <input name="licensePlate" defaultValue={editingItem?.licensePlate} required className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </>
                )}
                {activeTab === 'employees' && (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Usuário de Acesso (Login)</label>
                        <span className="text-[11px] text-emerald-600 font-medium">
                          Padrão: @{normalizeUsername(formName) || 'usuario'}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm">@</span>
                        <input 
                          name="customUsername" 
                          value={customUsername}
                          onChange={(e) => setCustomUsername(e.target.value)}
                          placeholder={normalizeUsername(formName) || 'usuario'} 
                          className="w-full pl-9 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm" 
                        />
                      </div>
                      <p className="text-[11px] text-neutral-400 ml-1">
                        Este será o usuário usado na tela de login. Deixe em branco para usar o gerado pelo nome.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Senha {editingItem ? '(Deixe em branco para não alterar)' : 'Inicial'}</label>
                      <input 
                        name="password" 
                        type="password" 
                        required={!editingItem && !editingItem?.uid} 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Cargo</label>
                      <select name="role" defaultValue={editingItem?.role || 'VENDEDOR'} required className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 appearance-none">
                        <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                        <option value="VENDEDOR">VENDEDOR</option>
                        <option value="GERENTE">GERENTE</option>
                      </select>
                    </div>
                  </>
                )}
                {activeTab === 'paymentMethods' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Taxa (%)</label>
                      <input name="feePercentage" type="number" step="0.1" defaultValue={editingItem?.feePercentage} required className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Taxa Fixa (R$)</label>
                      <input name="fixedFee" type="number" step="0.01" defaultValue={editingItem?.fixedFee} required className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                )}
                {activeTab === 'destinations' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Região</label>
                      <input name="region" defaultValue={editingItem?.region} required className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Valor (R$)</label>
                      <input name="value" type="number" step="0.01" defaultValue={editingItem?.value} required className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </>
                )}
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200">Cancelar</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsDeleteModalOpen(false)} 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Confirmar Exclusão</h3>
              <p className="text-neutral-500 mb-8">Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsDeleteModalOpen(false)} 
                  className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-100"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Provider Not Allowed Info Modal */}
      <AnimatePresence>
        {showAuthNotAllowedModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowAuthNotAllowedModal(false)} 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 text-left"
            >
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-5">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">
                Ativação de Senhas Necessária no Firebase
              </h3>
              <p className="text-neutral-600 text-sm mb-4 leading-relaxed">
                Para cadastrar funcionários e permitir que eles acessem com usuário e senha, o provedor <strong>E-mail/senha</strong> precisa estar ativado no Firebase Authentication.
              </p>

              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 mb-6 space-y-2.5 text-xs text-neutral-700">
                <div className="font-semibold text-neutral-900 mb-1">Como ativar no Firebase Console (leva menos de 1 minuto):</div>
                <div className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 bg-neutral-200 text-neutral-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <span>Clique no botão verde abaixo para abrir o Console do Firebase na seção de autenticação.</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 bg-neutral-200 text-neutral-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <span>Na lista de provedores, clique em <strong>E-mail/senha</strong> (Email/Password).</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 bg-neutral-200 text-neutral-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <span>Ative a primeira opção (<strong>Ativar / Enable</strong>) e clique em <strong>Salvar (Save)</strong>.</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href={FIREBASE_CONSOLE_AUTH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-colors"
                >
                  <ExternalLink size={16} />
                  Abrir Firebase Console (Sign-in method)
                </a>

                {pendingEmployee && (
                  <button
                    type="button"
                    disabled={savingWithoutAuth}
                    onClick={handleSaveEmployeeWithoutAuth}
                    className="w-full px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-medium text-sm transition-colors"
                  >
                    {savingWithoutAuth ? 'Salvando...' : 'Salvar funcionário na lista mesmo assim (sem login imediato)'}
                  </button>
                )}

                <button 
                  type="button" 
                  onClick={() => setShowAuthNotAllowedModal(false)} 
                  className="w-full px-5 py-2.5 text-neutral-500 hover:text-neutral-700 rounded-xl font-medium text-xs transition-colors text-center"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Conflict Modal */}
      <AnimatePresence>
        {authConflictEmployee && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setAuthConflictEmployee(null)} 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 text-left"
            >
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-5">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">
                Conflito de Autenticação Identificado
              </h3>
              <p className="text-neutral-600 text-sm mb-4 leading-relaxed">
                O usuário <strong className="font-mono text-emerald-700">@{authConflictEmployee.username}</strong> já está cadastrado no sistema ou associado a outro registro de login.
              </p>

              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 mb-6 space-y-2 text-xs text-neutral-700">
                <div className="font-semibold text-neutral-900">Como você deseja resolver?</div>
                <p>
                  Você pode usar a sugestão automática gerada pelo sistema para evitar conflitos, salvar o funcionário apenas no cadastro sem login imediato, ou fechar para alterar o usuário de acesso manualmente.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={resolvingConflict}
                  onClick={handleResolveConflictWithSuggested}
                  className="w-full px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-colors"
                >
                  <CheckCircle2 size={16} />
                  {resolvingConflict ? 'Resolvendo...' : `Usar o usuário sugerido: @${authConflictEmployee.suggestedUsername}`}
                </button>

                <button
                  type="button"
                  disabled={savingWithoutAuth}
                  onClick={handleSaveConflictWithoutAuth}
                  className="w-full px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-medium text-sm transition-colors"
                >
                  {savingWithoutAuth ? 'Salvando...' : 'Salvar funcionário na lista sem login por enquanto'}
                </button>

                <button 
                  type="button" 
                  onClick={() => setAuthConflictEmployee(null)} 
                  className="w-full px-5 py-2.5 text-neutral-500 hover:text-neutral-700 rounded-xl font-medium text-xs transition-colors text-center"
                >
                  Fechar e alterar usuário manualmente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
