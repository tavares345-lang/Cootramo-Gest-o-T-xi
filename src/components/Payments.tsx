import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, addDoc, serverTimestamp, orderBy, limit, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride, Driver, Voucher, Settlement } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  CreditCard, 
  Search, 
  CheckCircle2, 
  Clock, 
  Filter, 
  ChevronRight,
  DollarSign,
  User,
  Ticket,
  XCircle,
  CheckCircle,
  Printer,
  Plus,
  FileText,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useAuth } from '../contexts/AuthContext';

export default function Payments() {
  const { profile } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [voucherSearch, setVoucherSearch] = useState('');
  const [foundVoucher, setFoundVoucher] = useState<(Voucher & { ride?: Ride, driver?: Driver }) | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('pending');
  const [activeTab, setActiveTab] = useState<'management' | 'reports'>('management');
  
  // Report Filters
  const [reportStartDate, setReportStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportDriverId, setReportDriverId] = useState<string | 'all'>('all');
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementDriverId, setSettlementDriverId] = useState('');
  const [settlementVoucherSearch, setSettlementVoucherSearch] = useState('');
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([]);
  const [isPrintingSettlement, setIsPrintingSettlement] = useState<Settlement | null>(null);

  useEffect(() => {
    if (!profile) return;

    let qRides = query(collection(db, 'rides'));
    if (profile?.role !== 'ADMINISTRADOR' && profile?.sectorId) {
      qRides = query(qRides, where('sectorId', '==', profile.sectorId));
    }

    const unsubRides = onSnapshot(qRides, (snapshot) => {
      setRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides');
    });
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers');
    });
    const unsubVouchers = onSnapshot(collection(db, 'vouchers'), (snapshot) => {
      setVouchers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vouchers');
    });
    const unsubSettlements = onSnapshot(query(collection(db, 'settlements'), orderBy('createdAt', 'desc')), (snapshot) => {
      setSettlements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settlements');
    });

    return () => {
      unsubRides();
      unsubDrivers();
      unsubVouchers();
      unsubSettlements();
    };
  }, [profile]);

  const handleVoucherSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const voucher = vouchers.find(v => v.voucherNumber === voucherSearch);
    if (voucher) {
      const ride = rides.find(r => r.id === voucher.rideId);
      const driver = drivers.find(d => d.id === ride?.driverId);
      setFoundVoucher({ ...voucher, ride, driver });
    } else {
      setFoundVoucher(null);
      // Optional: show toast "Voucher não encontrado"
    }
  };

  const handleRedeemVoucher = async () => {
    if (!foundVoucher) return;
    try {
      await updateDoc(doc(db, 'vouchers', foundVoucher.id), { status: 'redeemed' });
      setFoundVoucher(null);
      setVoucherSearch('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vouchers/${foundVoucher.id}`);
    }
  };

  const filteredRides = rides.filter(ride => {
    const driver = drivers.find(d => d.id === ride.driverId);
    const matchesSearch = driver?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         driver?.licensePlate.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDriver = selectedDriverId === 'all' || ride.driverId === selectedDriverId;
    const matchesStatus = statusFilter === 'all' || ride.status === statusFilter;
    return matchesSearch && matchesDriver && matchesStatus;
  });

  const handleMarkAsPaid = async (rideId: string) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), { status: 'paid' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rides/${rideId}`);
    }
  };

  const handlePayAll = async (driverId: string) => {
    const pendingRides = rides.filter(r => r.driverId === driverId && r.status === 'pending');
    if (pendingRides.length === 0) return;

    if (window.confirm(`Deseja marcar ${pendingRides.length} corridas como pagas para este motorista?`)) {
      const batch = writeBatch(db);
      pendingRides.forEach(ride => {
        batch.update(doc(db, 'rides', ride.id), { status: 'paid' });
      });
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-pay-all');
      }
    }
  };

  const handleSettlementVoucherSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSearch = settlementVoucherSearch.trim().toUpperCase();
    if (!cleanSearch) return;

    const voucher = vouchers.find(v => v.voucherNumber.toUpperCase() === cleanSearch);
    if (!voucher) {
      alert('Voucher não encontrado!');
      return;
    }
    if (voucher.status !== 'active') {
      const statusMap: Record<string, string> = {
        'redeemed': 'Baixado',
        'paid': 'Pago',
        'cancelled': 'Cancelado'
      };
      alert(`Este voucher está com status: ${statusMap[voucher.status] || voucher.status}`);
      return;
    }

    const ride = rides.find(r => r.id === voucher.rideId);
    if (!ride) {
      alert('Corrida associada não encontrada!');
      return;
    }

    if (!settlementDriverId) {
      setSettlementDriverId(ride.driverId);
      setSelectedVoucherIds([voucher.id]);
    } else if (settlementDriverId === ride.driverId) {
      if (!selectedVoucherIds.includes(voucher.id)) {
        setSelectedVoucherIds([...selectedVoucherIds, voucher.id]);
      } else {
        alert('Voucher já selecionado!');
      }
    } else {
      if (window.confirm('Este voucher pertence a outro motorista. Deseja mudar o motorista selecionado? (Isso limpará a seleção atual)')) {
        setSettlementDriverId(ride.driverId);
        setSelectedVoucherIds([voucher.id]);
      }
    }
    setSettlementVoucherSearch('');
  };

  const handleCreateSettlement = async () => {
    if (!settlementDriverId || selectedVoucherIds.length === 0) return;

    const totalAmount = selectedVoucherIds.reduce((acc, vId) => {
      const voucher = vouchers.find(v => v.id === vId);
      const ride = rides.find(r => r.id === voucher?.rideId);
      return acc + (ride?.netValue || 0);
    }, 0);

    const settlementNumber = `SET-${Date.now().toString().slice(-6)}`;

    try {
      const batch = writeBatch(db);
      
      const settlementRef = doc(collection(db, 'settlements'));
      batch.set(settlementRef, {
        settlementNumber,
        driverId: settlementDriverId,
        voucherIds: selectedVoucherIds,
        totalAmount,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Mark vouchers as redeemed when added to a settlement
      selectedVoucherIds.forEach(vId => {
        batch.update(doc(db, 'vouchers', vId), { status: 'redeemed' });
      });

      await batch.commit();
      
      setIsSettlementModalOpen(false);
      setSettlementDriverId('');
      setSelectedVoucherIds([]);
      setSettlementVoucherSearch('');
      alert(`Lançamento ${settlementNumber} criado com sucesso!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'settlements');
    }
  };

  const handlePaySettlement = async (settlement: Settlement) => {
    if (window.confirm(`Confirmar pagamento do lançamento ${settlement.settlementNumber}?`)) {
      try {
        const batch = writeBatch(db);
        
        // Update settlement status
        batch.update(doc(db, 'settlements', settlement.id), { 
          status: 'paid',
          paidAt: serverTimestamp()
        });

        // Update all associated rides to 'paid'
        settlement.voucherIds.forEach(vId => {
          const voucher = vouchers.find(v => v.id === vId);
          if (voucher?.rideId) {
            batch.update(doc(db, 'rides', voucher.rideId), { status: 'paid' });
          }
        });

        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settlements/${settlement.id}/pay`);
      }
    }
  };

  const handlePrintSettlement = (settlement: Settlement) => {
    setIsPrintingSettlement(settlement);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const LOGO_TEXT = (
    <div className="text-center mb-4">
      <h1 className="text-sm font-black text-neutral-900 leading-tight">COOTRAMO – MG</h1>
      <p className="text-[10px] font-bold text-neutral-600">CNPJ: 04.994.250/0001-45</p>
      <p className="text-[9px] text-neutral-500 leading-tight">Rua Silvia Maria Rocha Baggio, 500</p>
      <p className="text-[9px] text-neutral-500 leading-tight">Dist. Ind. Genesco Aparecido de Oliveira</p>
      <p className="text-[9px] text-neutral-500 leading-tight font-bold">Lagoa Santa – MG</p>
      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-1">Aeroporto de Confins</p>
    </div>
  );

  const SettlementPrint = ({ settlement, copy }: { settlement: Settlement, copy: string }) => {
    const driver = drivers.find(d => d.id === settlement.driverId);
    const settlementVouchers = settlement.voucherIds.map(vId => {
      const v = vouchers.find(voc => voc.id === vId);
      const r = rides.find(rid => rid.id === v?.rideId);
      return { v, r };
    });

    return (
      <div className="w-full p-8 bg-white text-neutral-900 border-2 border-dashed border-neutral-300 rounded-3xl mb-8">
        {LOGO_TEXT}
        <div className="flex justify-between items-center border-b-2 border-neutral-900 pb-2 mb-4">
          <span className="text-xs font-black uppercase tracking-widest">{copy}</span>
          <span className="text-sm font-black">Nº {settlement.settlementNumber}</span>
        </div>
        
        <div className="mb-6">
          <p className="text-[10px] text-neutral-400 font-bold uppercase">Motorista / Unidade</p>
          <p className="text-lg font-black">{driver?.unitNumber} - {driver?.name}</p>
          <p className="text-xs text-neutral-500">{driver?.licensePlate}</p>
        </div>

        <div className="space-y-2 mb-6">
          <p className="text-[10px] text-neutral-400 font-bold uppercase border-b border-neutral-100 pb-1">Vouchers Lançados</p>
          {settlementVouchers.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs py-1 border-b border-neutral-50">
              <span>#{item.v?.voucherNumber} - {item.r?.destination}</span>
              <span className="font-bold">R$ {item.r?.netValue.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t-2 border-neutral-900">
          <span className="text-sm font-black">TOTAL A RECEBER</span>
          <span className="text-2xl font-black text-emerald-600">R$ {settlement.totalAmount.toFixed(2)}</span>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="border-t border-neutral-400 pt-2">
              <p className="text-[10px] uppercase font-bold">Assinatura Cooperado</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-neutral-400 pt-2">
              <p className="text-[10px] uppercase font-bold">Responsável Cootramo</p>
            </div>
          </div>
        </div>
        
        <p className="text-[8px] text-neutral-400 italic text-center mt-8">
          Gerado em: {format(settlement.createdAt?.toDate() || new Date(), "dd/MM/yyyy HH:mm:ss")}
        </p>
      </div>
    );
  };

  // Group by driver for the summary view
  const driverSummaries = drivers.map(driver => {
    const driverRides = rides.filter(r => r.driverId === driver.id);
    const pendingAmount = driverRides.filter(r => r.status === 'pending').reduce((acc, r) => acc + r.netValue, 0);
    const paidAmount = driverRides.filter(r => r.status === 'paid').reduce((acc, r) => acc + r.netValue, 0);
    return { ...driver, pendingAmount, paidAmount };
  }).filter(d => d.pendingAmount > 0 || d.paidAmount > 0);

  const reportData = settlements
    .filter(s => s.status === 'paid' && s.paidAt)
    .filter(s => {
      const paidDate = s.paidAt?.toDate();
      if (!paidDate) return false;
      const start = new Date(reportStartDate + 'T00:00:00');
      const end = new Date(reportEndDate + 'T23:59:59');
      const matchesDate = paidDate >= start && paidDate <= end;
      const matchesDriver = reportDriverId === 'all' || s.driverId === reportDriverId;
      return matchesDate && matchesDriver;
    })
    .map(s => {
      const driver = drivers.find(d => d.id === s.driverId);
      return {
        ...s,
        driverName: driver?.name,
        unitNumber: driver?.unitNumber,
        paidDate: s.paidAt?.toDate()
      };
    });

  const totalPaidInReport = reportData.reduce((acc, s) => acc + s.totalAmount, 0);

  return (
    <div className="space-y-8">
      {/* Print Overlay */}
      {isPrintingSettlement && (
        <div className="hidden print:block fixed inset-0 z-[100] bg-white overflow-y-auto p-0 m-0">
          <div className="max-w-[800px] mx-auto">
            <SettlementPrint settlement={isPrintingSettlement} copy="Via Cooperado" />
            <div className="my-16 border-t-2 border-dashed border-neutral-300" />
            <SettlementPrint settlement={isPrintingSettlement} copy="Via Controle" />
          </div>
        </div>
      )}

      {/* Baixa de Voucher Section */}
      <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Ticket size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-neutral-900">Financeiro</h2>
              <p className="text-sm text-neutral-500">Gestão de vouchers e pagamentos</p>
            </div>
          </div>
          <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
            <button 
              onClick={() => setActiveTab('management')}
              className={cn("px-6 py-2 rounded-lg text-xs font-bold transition-all", activeTab === 'management' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500")}
            >
              Gestão
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={cn("px-6 py-2 rounded-lg text-xs font-bold transition-all", activeTab === 'reports' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500")}
            >
              Relatórios
            </button>
          </div>
        </div>

        {activeTab === 'management' ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-lg font-bold text-neutral-900">Baixa de Voucher</h3>
            </div>

            <form onSubmit={handleVoucherSearch} className="flex gap-4 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
                <input
                  type="text"
                  placeholder="Digite o número do voucher..."
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
              <button 
                type="submit"
                className="px-8 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-100"
              >
                Buscar
              </button>
            </form>

            <AnimatePresence>
              {foundVoucher && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-8 p-6 bg-neutral-50 rounded-3xl border border-neutral-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-2">Motorista</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-neutral-400 border border-neutral-200">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-900">{foundVoucher.driver?.name}</p>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{foundVoucher.driver?.licensePlate}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-2">Detalhes da Corrida</p>
                      <p className="text-sm font-bold text-neutral-900">{foundVoucher.ride?.destination}</p>
                      <p className="text-lg font-black text-emerald-600">R$ {foundVoucher.ride?.value.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col justify-center gap-3">
                      <div className={cn(
                        "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider",
                        foundVoucher.status === 'active' ? "bg-blue-50 text-blue-600" : 
                        foundVoucher.status === 'redeemed' ? "bg-emerald-50 text-emerald-600" : 
                        "bg-red-50 text-red-600"
                      )}>
                        {foundVoucher.status === 'active' ? <Clock size={14} /> : 
                         foundVoucher.status === 'redeemed' ? <CheckCircle size={14} /> : 
                         <XCircle size={14} />}
                        {foundVoucher.status === 'active' ? 'Ativo' : 
                         foundVoucher.status === 'redeemed' ? 'Baixado' : 
                         'Cancelado'}
                      </div>
                      {foundVoucher.status === 'active' && (
                        <button 
                          onClick={handleRedeemVoucher}
                          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          Dar Baixa
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Início</label>
                <input 
                  type="date" 
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Fim</label>
                <input 
                  type="date" 
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Unidade</label>
                <select 
                  value={reportDriverId}
                  onChange={(e) => setReportDriverId(e.target.value)}
                  className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Todas as Unidades</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.unitNumber} - {d.name}</option>
                  ))}
                </select>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl flex flex-col justify-center">
                <p className="text-[10px] font-bold text-emerald-600 uppercase">Total Pago</p>
                <p className="text-xl font-black text-emerald-700">R$ {totalPaidInReport.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100">
                    <th className="px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase">Data Pagto</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase">Unidade</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase">Lançamento</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {reportData.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-3 text-sm text-neutral-600">
                        {s.paidDate ? format(s.paidDate, 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-6 py-3 text-sm font-bold text-neutral-900">
                        {s.unitNumber} - {s.driverName}
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-500">
                        {s.settlementNumber}
                      </td>
                      <td className="px-6 py-3 text-sm font-black text-emerald-600 text-right">
                        R$ {s.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-neutral-400 italic text-sm">
                        Nenhum pagamento encontrado para o período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <DollarSign size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-neutral-900">Pagamento de Motoristas</h2>
            <p className="text-sm text-neutral-500">Controle de repasses e saldos</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <button 
            onClick={() => {
              setIsSettlementModalOpen(true);
              setSettlementVoucherSearch('');
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Plus size={20} />
            Novo Lançamento
          </button>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Pesquisar motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2 p-1 bg-neutral-200/50 rounded-xl">
            <button 
              onClick={() => setStatusFilter('pending')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", statusFilter === 'pending' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500")}
            >
              Pendentes
            </button>
            <button 
              onClick={() => setStatusFilter('paid')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", statusFilter === 'paid' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500")}
            >
              Pagos
            </button>
          </div>
        </div>
      </div>

      {/* Settlements List */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="text-neutral-400" size={20} />
            <h3 className="font-bold text-neutral-900">Lançamentos Recentes</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-100">
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Nº Lançamento</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Vouchers</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {settlements.filter(s => statusFilter === 'all' || s.status === statusFilter).map((settlement) => {
                const driver = drivers.find(d => d.id === settlement.driverId);
                return (
                  <tr key={settlement.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-neutral-900">{settlement.settlementNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900">{driver?.unitNumber} - {driver?.name}</span>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{driver?.licensePlate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-600">{settlement.voucherIds.length} vouchers</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-emerald-600">R$ {settlement.totalAmount.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        settlement.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {settlement.status === 'paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {settlement.status === 'paid' ? 'Pago' : 'Pendente'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handlePrintSettlement(settlement)}
                        className="p-2 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 rounded-lg transition-all"
                        title="Imprimir"
                      >
                        <Printer size={18} />
                      </button>
                      {settlement.status === 'pending' && (
                        <button 
                          onClick={() => handlePaySettlement(settlement)}
                          className="p-2 hover:bg-emerald-50 text-neutral-400 hover:text-emerald-600 rounded-lg transition-all"
                          title="Marcar como Pago"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement Modal */}
      <AnimatePresence>
        {isSettlementModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => {
                setIsSettlementModalOpen(false);
                setSettlementVoucherSearch('');
              }} 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 flex flex-col max-h-[90vh]"
            >
              <h3 className="text-xl font-bold text-neutral-900 mb-6">Novo Lançamento de Vouchers</h3>
              
              <div className="space-y-6 overflow-y-auto pr-2">
                <form onSubmit={handleSettlementVoucherSearch} className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Buscar por Número do Voucher</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Digite o número do voucher..."
                      value={settlementVoucherSearch}
                      onChange={(e) => setSettlementVoucherSearch(e.target.value)}
                      className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button 
                      type="submit"
                      className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center gap-2"
                    >
                      <Search size={18} />
                      Buscar
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Motorista / Unidade</label>
                  <select 
                    value={settlementDriverId}
                    onChange={(e) => {
                      setSettlementDriverId(e.target.value);
                      setSelectedVoucherIds([]);
                    }}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Selecione o motorista...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.unitNumber} - {d.name}</option>
                    ))}
                  </select>
                </div>

                {settlementDriverId && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Vouchers Disponíveis</label>
                      <button 
                        onClick={() => {
                          const available = vouchers.filter(v => {
                            const ride = rides.find(r => r.id === v.rideId);
                            return ride?.driverId === settlementDriverId && v.status === 'active';
                          });
                          setSelectedVoucherIds(available.map(v => v.id));
                        }}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                      >
                        Selecionar Todos
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {vouchers.filter(v => {
                        const ride = rides.find(r => r.id === v.rideId);
                        return ride?.driverId === settlementDriverId && v.status === 'active';
                      }).map(v => {
                        const ride = rides.find(r => r.id === v.rideId);
                        return (
                          <label key={v.id} className={cn(
                            "flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all",
                            selectedVoucherIds.includes(v.id) ? "border-emerald-500 bg-emerald-50" : "border-neutral-100 bg-white hover:border-neutral-200"
                          )}>
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                checked={selectedVoucherIds.includes(v.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedVoucherIds([...selectedVoucherIds, v.id]);
                                  } else {
                                    setSelectedVoucherIds(selectedVoucherIds.filter(id => id !== v.id));
                                  }
                                }}
                                className="w-5 h-5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <p className="text-sm font-bold text-neutral-900">Voucher #{v.voucherNumber}</p>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase">{ride?.destination}</p>
                              </div>
                            </div>
                            <span className="text-sm font-black text-neutral-900">R$ {ride?.netValue.toFixed(2)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase">Total Selecionado</p>
                  <p className="text-2xl font-black text-emerald-600">
                    R$ {selectedVoucherIds.reduce((acc, vId) => {
                      const v = vouchers.find(voc => voc.id === vId);
                      const r = rides.find(rid => rid.id === v?.rideId);
                      return acc + (r?.netValue || 0);
                    }, 0).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setIsSettlementModalOpen(false);
                      setSettlementVoucherSearch('');
                    }}
                    className="px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleCreateSettlement}
                    disabled={!settlementDriverId || selectedVoucherIds.length === 0}
                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:opacity-50"
                  >
                    Criar Lançamento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Driver Summaries */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-bold text-neutral-900 px-2">Resumo por Motorista</h3>
          <div className="space-y-3">
            {driverSummaries.map((summary) => (
              <div key={summary.id} className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{summary.name}</p>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{summary.licensePlate}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handlePayAll(summary.id)}
                    disabled={summary.pendingAmount === 0}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 disabled:opacity-30 transition-colors"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-50">
                  <div>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1">Pendente</p>
                    <p className="text-lg font-black text-amber-500">R$ {summary.pendingAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1">Pago</p>
                    <p className="text-lg font-black text-emerald-600">R$ {summary.paidAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-neutral-900 px-2">Detalhamento de Corridas</h3>
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/50 border-b border-neutral-100">
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Motorista</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Destino</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Líquido</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredRides.map((ride) => {
                    const driver = drivers.find(d => d.id === ride.driverId);
                    return (
                      <tr key={ride.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-neutral-900">{driver?.name}</span>
                            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{driver?.licensePlate}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-neutral-600 truncate max-w-[150px] block">{ride.destination}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-black text-neutral-900">R$ {ride.netValue.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            ride.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {ride.status === 'paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            {ride.status === 'paid' ? 'Pago' : 'Pendente'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {ride.status === 'pending' && (
                            <button 
                              onClick={() => handleMarkAsPaid(ride.id)}
                              className="p-2 hover:bg-emerald-50 text-neutral-400 hover:text-emerald-600 rounded-lg transition-all"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
