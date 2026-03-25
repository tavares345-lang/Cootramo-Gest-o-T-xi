import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Voucher, Ride, Driver } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  Ticket, 
  Search, 
  Printer, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useAuth } from '../contexts/AuthContext';

export default function Vouchers() {
  const { profile } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [rides, setRides] = useState<Record<string, Ride>>({});
  const [drivers, setDrivers] = useState<Record<string, Driver>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled' | 'redeemed'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<{ voucher: Voucher; ride: Ride } | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [voucherToCancel, setVoucherToCancel] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'vouchers'), orderBy('createdAt', 'desc'));
    const unsubVouchers = onSnapshot(q, (snapshot) => {
      setVouchers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vouchers');
    });

    let qRides = query(collection(db, 'rides'));
    if (profile?.role !== 'ADMINISTRADOR' && profile?.sectorId) {
      qRides = query(qRides, where('sectorId', '==', profile.sectorId));
    }

    const unsubRides = onSnapshot(qRides, (snapshot) => {
      const ridesMap: Record<string, Ride> = {};
      snapshot.docs.forEach(doc => { ridesMap[doc.id] = { id: doc.id, ...doc.data() } as Ride; });
      setRides(ridesMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides');
    });

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      const driversMap: Record<string, Driver> = {};
      snapshot.docs.forEach(doc => { driversMap[doc.id] = { id: doc.id, ...doc.data() } as Driver; });
      setDrivers(driversMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers');
    });

    return () => {
      unsubVouchers();
      unsubRides();
      unsubDrivers();
    };
  }, [profile]);

  const filteredVouchers = vouchers.filter(v => {
    const ride = rides[v.rideId];
    // If not admin and we have a sector, only show vouchers for rides in that sector
    if (profile?.role !== 'ADMINISTRADOR' && profile?.sectorId) {
      if (!ride || ride.sectorId !== profile.sectorId) return false;
    }
    const matchesSearch = v.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const LOGO_URL = "https://storage.googleapis.com/static-content-dev-ais-studio/clzzlitvlpv7rxhba/258673167423/attachments/97960383-722d-427f-9477-80922437651a.png";

  const handlePrint = () => {
    window.focus();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleCancelVoucher = async () => {
    if (!voucherToCancel) return;
    try {
      await updateDoc(doc(db, 'vouchers', voucherToCancel), {
        status: 'cancelled'
      });
      setIsCancelModalOpen(false);
      setVoucherToCancel(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vouchers/${voucherToCancel}`);
    }
  };

  const confirmCancel = (id: string) => {
    setVoucherToCancel(id);
    setIsCancelModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Pesquisar por número do voucher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex gap-2 p-1 bg-neutral-200/50 rounded-2xl">
            <button 
              onClick={() => setStatusFilter('all')}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", statusFilter === 'all' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}
            >
              Todos
            </button>
            <button 
              onClick={() => setStatusFilter('active')}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", statusFilter === 'active' ? "bg-white text-blue-600 shadow-sm" : "text-neutral-500")}
            >
              Ativos
            </button>
            <button 
              onClick={() => setStatusFilter('redeemed')}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", statusFilter === 'redeemed' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500")}
            >
              Baixados
            </button>
            <button 
              onClick={() => setStatusFilter('cancelled')}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", statusFilter === 'cancelled' ? "bg-white text-red-600 shadow-sm" : "text-neutral-500")}
            >
              Cancelados
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-3 bg-white border border-neutral-200 rounded-2xl text-neutral-600 font-medium hover:bg-neutral-50 transition-all shadow-sm">
            <Calendar size={18} />
            Hoje
          </button>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-100">
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Voucher</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Passageiro</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredVouchers.map((voucher) => {
                const ride = rides[voucher.rideId];
                const driver = ride ? drivers[ride.driverId] : null;
                
                return (
                  <tr key={voucher.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                          <Ticket size={16} />
                        </div>
                        <span className="font-bold text-neutral-900">{voucher.voucherNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-900 font-medium">
                          {format(voucher.createdAt.toDate(), "dd/MM/yyyy")}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {format(voucher.createdAt.toDate(), "HH:mm")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-600 font-medium">
                        {ride?.passengerName || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-900 font-medium">{driver?.name || 'N/A'}</span>
                        <span className="text-xs text-neutral-400">{driver?.licensePlate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-neutral-900">
                        R$ {ride?.value.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        voucher.status === 'active' 
                          ? 'bg-blue-50 text-blue-600' 
                          : voucher.status === 'redeemed'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-red-50 text-red-600'
                      }`}>
                        {voucher.status === 'active' ? (
                          <><Clock size={12} /> Ativo</>
                        ) : voucher.status === 'redeemed' ? (
                          <><CheckCircle2 size={12} /> Baixado</>
                        ) : (
                          <><XCircle size={12} /> Cancelado</>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => ride && setSelectedVoucher({ voucher, ride })}
                          className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition-all"
                          title="Imprimir"
                        >
                          <Printer size={18} />
                        </button>
                        {voucher.status === 'active' && (
                          <button 
                            onClick={() => confirmCancel(voucher.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600 transition-all"
                            title="Cancelar Voucher"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="p-6 border-t border-neutral-100 flex items-center justify-between">
          <p className="text-sm text-neutral-400">Mostrando {filteredVouchers.length} vouchers</p>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-neutral-200 rounded-lg text-neutral-400 hover:bg-neutral-50 disabled:opacity-50" disabled>
              <ChevronLeft size={18} />
            </button>
            <button className="p-2 border border-neutral-200 rounded-lg text-neutral-400 hover:bg-neutral-50 disabled:opacity-50" disabled>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Voucher Modal for Reprint */}
      <AnimatePresence>
        {selectedVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVoucher(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 flex flex-col items-center max-h-[80vh] overflow-y-auto">
                <div id="voucher-print" className="w-full space-y-8">
                  {/* VIA BALCÃO */}
                  <div className="w-full max-w-sm mx-auto bg-neutral-50 p-6 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center text-center space-y-3 print:shadow-none print:bg-white print:border-neutral-300 print:p-2">
                    <div className="w-full mb-4 text-center">
                      <h1 className="text-sm font-black text-neutral-900 leading-tight">COOTRAMO – MG</h1>
                      <p className="text-[10px] font-bold text-neutral-600">CNPJ: 04.994.250/0001-45</p>
                      <p className="text-[9px] text-neutral-500 leading-tight">Rua Silvia Maria Rocha Baggio, 500</p>
                      <p className="text-[9px] text-neutral-500 leading-tight">Dist. Ind. Genesco Aparecido de Oliveira</p>
                      <p className="text-[9px] text-neutral-500 leading-tight font-bold">Lagoa Santa – MG</p>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-1">Aeroporto de Confins</p>
                    </div>
                    <div className="w-full flex justify-between items-center border-b border-neutral-200 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Via Balcão</span>
                      <span className="text-xs font-bold text-neutral-900">#{selectedVoucher.voucher.voucherNumber}</span>
                    </div>
                    <div className="w-full text-left space-y-1">
                      <p className="text-[10px] text-neutral-400 uppercase font-bold">Destino</p>
                      <p className="text-sm font-bold text-neutral-900 truncate">{selectedVoucher.ride.destination}</p>
                    </div>
                    <div className="w-full pt-2 border-t border-neutral-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-neutral-400">VALOR</span>
                      <span className="text-lg font-black text-neutral-900">R$ {selectedVoucher.ride.value.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* VIA COOPERADO */}
                  <div className="w-full max-w-sm mx-auto bg-neutral-50 p-6 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center text-center space-y-3 print:shadow-none print:bg-white print:border-neutral-300 print:p-2">
                    <div className="w-full mb-4 text-center">
                      <h1 className="text-sm font-black text-neutral-900 leading-tight">COOTRAMO – MG</h1>
                      <p className="text-[10px] font-bold text-neutral-600">CNPJ: 04.994.250/0001-45</p>
                      <p className="text-[9px] text-neutral-500 leading-tight">Rua Silvia Maria Rocha Baggio, 500</p>
                      <p className="text-[9px] text-neutral-500 leading-tight">Dist. Ind. Genesco Aparecido de Oliveira</p>
                      <p className="text-[9px] text-neutral-500 leading-tight font-bold">Lagoa Santa – MG</p>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-1">Aeroporto de Confins</p>
                    </div>
                    <div className="w-full flex justify-between items-center border-b border-neutral-200 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Via Cooperado</span>
                      <span className="text-xs font-bold text-neutral-900">#{selectedVoucher.voucher.voucherNumber}</span>
                    </div>
                    <div className="w-full space-y-2 text-left text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Motorista:</span>
                        <span className="font-bold">
                          {(() => {
                            const d = drivers[selectedVoucher.ride.driverId];
                            return d ? `U: ${d.unitNumber} - ${d.name}` : 'N/A';
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Passageiro:</span>
                        <span className="font-bold">{selectedVoucher.ride.passengerName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Destino:</span>
                        <span className="font-bold truncate max-w-[180px]">{selectedVoucher.ride.destination}</span>
                      </div>
                    </div>
                    <div className="w-full pt-3 border-t border-neutral-200 space-y-1 text-xs">
                      <div className="flex justify-between text-neutral-500">
                        <span>Valor Bruto:</span>
                        <span>R$ {selectedVoucher.ride.value.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-red-500">
                        <span>Desconto/Taxas:</span>
                        <span>- R$ {selectedVoucher.ride.feeAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-black text-emerald-600 text-sm pt-1 border-t border-neutral-100">
                        <span>LÍQUIDO:</span>
                        <span>R$ {selectedVoucher.ride.netValue.toFixed(2)}</span>
                      </div>
                    </div>
                    <p className="text-[8px] text-neutral-400 italic pt-2">
                      {format(selectedVoucher.ride.createdAt.toDate(), "dd/MM/yyyy HH:mm:ss")}
                    </p>
                  </div>

                  {/* VIA CLIENTE */}
                  <div className="w-full max-w-sm mx-auto bg-neutral-50 p-6 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center text-center space-y-4 print:shadow-none print:bg-white print:border-neutral-300 print:p-2">
                    <div className="w-full mb-4 text-center">
                      <h1 className="text-sm font-black text-neutral-900 leading-tight">COOTRAMO – MG</h1>
                      <p className="text-[10px] font-bold text-neutral-600">CNPJ: 04.994.250/0001-45</p>
                      <p className="text-[9px] text-neutral-500 leading-tight">Rua Silvia Maria Rocha Baggio, 500</p>
                      <p className="text-[9px] text-neutral-500 leading-tight">Dist. Ind. Genesco Aparecido de Oliveira</p>
                      <p className="text-[9px] text-neutral-500 leading-tight font-bold">Lagoa Santa – MG</p>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-1">Aeroporto de Confins</p>
                    </div>
                    <div className="w-full flex justify-between items-center border-b border-neutral-200 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Via Cliente</span>
                      <span className="text-xs font-bold text-neutral-900">#{selectedVoucher.voucher.voucherNumber}</span>
                    </div>
                    
                    <div className="w-full text-center py-2">
                      <p className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Destino</p>
                      <p className="text-lg font-black text-neutral-900 leading-tight">{selectedVoucher.ride.destination}</p>
                    </div>

                    <div className="py-2">
                      <QRCodeSVG value={selectedVoucher.voucher.voucherNumber} size={80} level="H" />
                    </div>

                    <div className="w-full pt-4 border-t border-neutral-200">
                      <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-1">Valor da Corrida</p>
                      <p className="text-4xl font-black text-emerald-600">R$ {selectedVoucher.ride.value.toFixed(2)}</p>
                    </div>

                    <p className="text-[9px] text-neutral-500 font-bold">
                      Horário da Venda: {format(selectedVoucher.ride.createdAt.toDate(), "HH:mm:ss")} - {format(selectedVoucher.ride.createdAt.toDate(), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-8">
                  <button
                    onClick={handlePrint}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                  >
                    <Printer size={18} />
                    Imprimir
                  </button>
                  <button
                    onClick={() => setSelectedVoucher(null)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCancelModalOpen(false)} 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-6">
                <XCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Cancelar Voucher</h3>
              <p className="text-neutral-500 mb-8">Tem certeza que deseja cancelar este voucher? Esta ação não pode ser desfeita e o status será alterado para cancelado.</p>
              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsCancelModalOpen(false)} 
                  className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleCancelVoucher}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-100"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            margin: 0;
            padding: 0;
            width: 80mm;
          }
          body * {
            visibility: hidden;
          }
          #voucher-print, #voucher-print * {
            visibility: visible;
          }
          #voucher-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            border: none;
            background: white;
            display: flex;
            flex-direction: column;
            gap: 10mm;
            padding: 5mm;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:border-neutral-300 {
            border-color: #d4d4d4 !important;
            border-style: solid !important;
            border-width: 1px !important;
          }
          .print\\:p-2 {
            padding: 2mm !important;
          }
        }
      `}</style>
    </div>
  );
}
