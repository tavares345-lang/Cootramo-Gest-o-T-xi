import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride, Sector, Driver, PaymentMethod } from '../types';
import { 
  FileText, 
  Printer, 
  Calendar, 
  TrendingUp, 
  CreditCard, 
  Car,
  ArrowDownRight,
  MapPin,
  Clock,
  ChevronLeft
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';

export default function MonthlyAnalysis({ onBack }: { onBack?: () => void }) {
  const { profile } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth] = useState(new Date());

  useEffect(() => {
    if (!profile || profile.role !== 'ADMINISTRADOR') return;

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const q = query(
      collection(db, 'rides'),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<=', Timestamp.fromDate(end)),
      orderBy('createdAt', 'desc')
    );

    const unsubRides = onSnapshot(q, (snapshot) => {
      setRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride)));
      setLoading(false);
    });

    const unsubSectors = onSnapshot(collection(db, 'sectors'), (snapshot) => {
      setSectors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector)));
    });

    return () => {
      unsubRides();
      unsubSectors();
    };
  }, [profile, currentMonth]);

  const LOGO_URL = "https://storage.googleapis.com/static-content-dev-ais-studio/clzzlitvlpv7rxhba/258673167423/attachments/97960383-722d-427f-9477-80922437651a.png";

  const totalSold = rides.reduce((acc, ride) => acc + ride.value, 0);
  const totalNet = rides.reduce((acc, ride) => acc + ride.netValue, 0);
  const totalFees = rides.reduce((acc, ride) => acc + ride.feeAmount, 0);
  const totalRides = rides.length;

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const dailyData = daysInMonth.map(day => {
    const dayRides = rides.filter(r => isSameDay(r.createdAt.toDate(), day));
    return {
      date: day,
      value: dayRides.reduce((acc, r) => acc + r.value, 0),
      count: dayRides.length,
      net: dayRides.reduce((acc, r) => acc + r.netValue, 0)
    };
  }).reverse();

  const handlePrint = () => {
    window.focus();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Logo for Display and Print */}
      <div className="text-center mb-8">
        <h1 className="text-xl font-black text-neutral-900 leading-tight">COOTRAMO – MG</h1>
        <p className="text-sm font-bold text-neutral-600">CNPJ: 04.994.250/0001-45</p>
        <p className="text-xs text-neutral-500 leading-tight">Rua Silvia Maria Rocha Baggio, 500</p>
        <p className="text-xs text-neutral-500 leading-tight">Dist. Ind. Genesco Aparecido de Oliveira</p>
        <p className="text-xs text-neutral-500 leading-tight font-bold">Lagoa Santa – MG</p>
        <p className="text-sm font-black text-emerald-600 uppercase tracking-wider mt-1">Aeroporto de Confins</p>
      </div>

      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-400 hover:text-neutral-900 font-bold uppercase tracking-wider text-xs transition-colors print:hidden"
      >
        <ChevronLeft size={16} />
        Voltar ao Painel
      </button>

      {/* Header & Print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Análise de Vendas Mensal</h2>
            <p className="text-sm text-neutral-400 font-medium uppercase tracking-wider">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </p>
          </div>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-100"
        >
          <Printer size={18} />
          Imprimir Relatório
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4">
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Faturamento Bruto</p>
          <p className="text-2xl font-black text-neutral-900">R$ {totalSold.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-bold">
            <TrendingUp size={14} />
            Total do Mês
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Líquido Motoristas</p>
          <p className="text-2xl font-black text-blue-600">R$ {totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-bold">
            <CreditCard size={14} />
            Repasse Total
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total Retido</p>
          <p className="text-2xl font-black text-red-500">R$ {totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-red-500 font-bold">
            <ArrowDownRight size={14} />
            Taxas e Retenções
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total de Corridas</p>
          <p className="text-2xl font-black text-amber-600">{totalRides}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 font-bold">
            <Car size={14} />
            Volume Mensal
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
          <h3 className="font-bold text-neutral-900">Detalhamento Diário</h3>
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Valores em R$</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-100">
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Qtd Corridas</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Bruto</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Líquido</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Taxas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {dailyData.filter(d => d.count > 0).map((day, i) => (
                <tr key={i} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500">
                        <Calendar size={16} />
                      </div>
                      <span className="font-bold text-neutral-900">{format(day.date, 'dd/MM/yyyy')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600">{day.count}</td>
                  <td className="px-6 py-4 text-sm font-bold text-neutral-900">R$ {day.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600">R$ {day.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-sm font-bold text-red-500">R$ {(day.value - day.net).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 20mm;
            size: A4;
          }
          body {
            background: white;
            color: black;
          }
          .print\\:hidden {
            display: none !important;
          }
          .bg-white {
            background: white !important;
            border: none !important;
            box-shadow: none !important;
          }
          .rounded-3xl {
            border-radius: 0 !important;
          }
          .shadow-sm {
            box-shadow: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border-bottom: 1px solid #eee !important;
            padding: 10px !important;
          }
          .text-emerald-600 { color: #059669 !important; }
          .text-blue-600 { color: #2563eb !important; }
          .text-red-500 { color: #ef4444 !important; }
          .text-amber-600 { color: #d97706 !important; }
        }
      `}</style>
    </div>
  );
}
