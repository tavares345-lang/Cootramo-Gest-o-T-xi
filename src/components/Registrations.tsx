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
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

        // Create Auth user using secondary app to avoid logging out current admin
        // We use a dummy email domain internally to support simple name-based login
        // We normalize the name to create a valid internal email
        const username = (data.name as string)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, ".")
          .replace(/\.+/g, ".")
          .replace(/^\.|\.$/g, "");
        const internalEmail = `${username}@taxi.app`;
        
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
          
          // Remove password from data before saving to Firestore
          const { password, ...employeeData } = data;
          
          // Add to 'employees' collection
          await addDoc(collection(db, 'employees'), {
            ...employeeData,
            username: username,
            uid: newUser.uid,
            active: true
          });
        } finally {
          await deleteApp(secondaryApp);
        }
      } else if (editingItem) {
        const docRef = doc(db, activeTab, editingItem.id);
        await updateDoc(docRef, data);
      } else {
        await addDoc(collection(db, activeTab), { ...data, active: true });
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      console.error('Save error:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Este nome de usuário já está em uso. Tente adicionar um sobrenome ou número.');
      } else if (error.code === 'auth/weak-password') {
        alert('A senha é muito fraca. Use pelo menos 6 caracteres.');
      } else {
        alert('Erro ao salvar: ' + (error.message || 'Ocorreu um erro inesperado.'));
      }
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, `${activeTab}/${editingItem?.id || ''}`);
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
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
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
                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
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
                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
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
                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
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
                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
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
                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900"><Edit2 size={16} /></button>
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
                  <input name="name" defaultValue={editingItem?.name} required className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
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
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Senha {editingItem ? '(Deixe em branco para não alterar)' : 'Inicial'}</label>
                      <input name="password" type="password" required={!editingItem} className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
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
    </div>
  );
}
