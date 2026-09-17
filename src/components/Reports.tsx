import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride, Sector, Driver, PaymentMethod, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar, 
  TrendingUp, 
  Users, 
  CreditCard, 
  MapPin,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Car,
  UserCheck
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie
} from 'recharts';
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useAuth } from '../contexts/AuthContext';
import { ensureDefaultSeedData } from '../lib/seed-data';

export default function Reports() {
  const { profile } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [sellers, setSellers] = useState<UserProfile[]>([]);

  // Controlled date inputs for the selector
  const [startDateInput, setStartDateInput] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDateInput, setEndDateInput] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Active applied range that drives queries and report calculation
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: subDays(new Date(), 7),
    end: new Date()
  });
  const [isFiltering, setIsFiltering] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    ensureDefaultSeedData(profile.uid, profile.sectorId);

    let q = query(
      collection(db, 'rides'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay(appliedDateRange.start))),
      where('createdAt', '<=', Timestamp.fromDate(endOfDay(appliedDateRange.end))),
      orderBy('createdAt', 'desc')
    );

    if (profile?.role !== 'ADMINISTRADOR' && profile?.sectorId) {
      q = query(q, where('sectorId', '==', profile.sectorId));
    }

    const unsubRides = onSnapshot(q, (snapshot) => {
      setRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride)));
      setLoading(false);
      setIsFiltering(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides');
      setLoading(false);
      setIsFiltering(false);
    });

    const unsubSectors = onSnapshot(collection(db, 'sectors'), (snapshot) => {
      setSectors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sectors');
    });

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers');
    });

    const unsubMethods = onSnapshot(collection(db, 'paymentMethods'), (snapshot) => {
      setPaymentMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'paymentMethods');
    });

    const unsubSellers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setSellers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => {
      unsubRides();
      unsubSectors();
      unsubDrivers();
      unsubMethods();
      unsubSellers();
    };
  }, [appliedDateRange, profile]);

  // Filter trigger function connected to the 'Filtrar' action button
  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!startDateInput || !endDateInput) return;

    const [sY, sM, sD] = startDateInput.split('-').map(Number);
    const [eY, eM, eD] = endDateInput.split('-').map(Number);

    let start = startOfDay(new Date(sY, sM - 1, sD));
    let end = endOfDay(new Date(eY, eM - 1, eD));

    if (start > end) {
      // Invert if user picked inverted bounds
      const temp = start;
      start = startOfDay(new Date(eY, eM - 1, eD));
      end = endOfDay(new Date(sY, sM - 1, sD));
      setStartDateInput(format(start, 'yyyy-MM-dd'));
      setEndDateInput(format(end, 'yyyy-MM-dd'));
    }

    setIsFiltering(true);
    setAppliedDateRange({ start, end });
  };

  // Quick preset handler that updates inputs and applies filter
  const applyPreset = (preset: 'today' | '7d' | '30d' | 'thisMonth') => {
    const now = new Date();
    let start = subDays(now, 7);
    let end = now;

    if (preset === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (preset === '7d') {
      start = startOfDay(subDays(now, 7));
      end = endOfDay(now);
    } else if (preset === '30d') {
      start = startOfDay(subDays(now, 30));
      end = endOfDay(now);
    } else if (preset === 'thisMonth') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }

    setStartDateInput(format(start, 'yyyy-MM-dd'));
    setEndDateInput(format(end, 'yyyy-MM-dd'));
    setIsFiltering(true);
    setAppliedDateRange({ start, end });
  };

  const totalSold = rides.reduce((acc, ride) => acc + (ride.value || 0), 0);
  const totalNet = rides.reduce((acc, ride) => acc + (ride.netValue || 0), 0);
  const totalFees = rides.reduce((acc, ride) => acc + (ride.feeAmount || 0), 0);
  const totalRides = rides.length;

  let salesByDay: { date: string; value: number }[] = [];
  try {
    if (appliedDateRange.start <= appliedDateRange.end) {
      salesByDay = eachDayOfInterval({ start: appliedDateRange.start, end: appliedDateRange.end }).map(day => ({
        date: format(day, 'dd/MM'),
        value: rides.filter(ride => {
          const rDate = ride.createdAt?.toDate ? ride.createdAt.toDate() : (ride.createdAt ? new Date(ride.createdAt) : null);
          return rDate ? format(rDate, 'dd/MM') === format(day, 'dd/MM') : false;
        }).reduce((acc, ride) => acc + (ride.value || 0), 0)
      }));
    }
  } catch (err) {
    console.error("Erro ao calcular intervalo diário:", err);
  }

  const salesBySector = sectors.map(sector => ({
    name: sector.name,
    value: rides.filter(ride => ride.sectorId === sector.id).reduce((acc, ride) => acc + (ride.value || 0), 0)
  })).filter(s => s.value > 0);

  const salesByMethod = paymentMethods.map(method => ({
    name: method.name,
    value: rides.filter(ride => ride.paymentMethodId === method.id).reduce((acc, ride) => acc + (ride.value || 0), 0)
  })).filter(s => s.value > 0);

  const salesBySeller = sellers.map(seller => ({
    name: seller.name,
    value: rides.filter(ride => ride.sellerId === seller.uid).reduce((acc, ride) => acc + (ride.value || 0), 0)
  })).filter(s => s.value > 0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8">
      {/* Date Range Selector & Filter Action */}
      <div id="reports-filter-card" className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm print:hidden">
        <form onSubmit={handleFilter} className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-1">
              <div className="space-y-1.5 flex-1 sm:max-w-xs">
                <label htmlFor="report-start-date" className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Data Inicial
                </label>
                <input
                  id="report-start-date"
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                  required
                />
              </div>

              <div className="space-y-1.5 flex-1 sm:max-w-xs">
                <label htmlFor="report-end-date" className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Data Final
                </label>
                <input
                  id="report-end-date"
                  type="date"
                  value={endDateInput}
                  onChange={(e) => setEndDateInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                  required
                />
              </div>

              <div className="pt-2 sm:pt-0">
                <button
                  type="submit"
                  id="btn-apply-report-filter"
                  disabled={isFiltering}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-100 text-sm cursor-pointer disabled:opacity-60"
                >
                  <Filter size={16} />
                  {isFiltering ? 'Filtrando...' : 'Filtrar'}
                </button>
              </div>
            </div>

            {/* Quick presets & Export */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
                <button
                  type="button"
                  id="btn-preset-today"
                  onClick={() => applyPreset('today')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-white transition-all cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  id="btn-preset-7d"
                  onClick={() => applyPreset('7d')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-white transition-all cursor-pointer"
                >
                  7 Dias
                </button>
                <button
                  type="button"
                  id="btn-preset-30d"
                  onClick={() => applyPreset('30d')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-white transition-all cursor-pointer"
                >
                  30 Dias
                </button>
                <button
                  type="button"
                  id="btn-preset-this-month"
                  onClick={() => applyPreset('thisMonth')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-white transition-all cursor-pointer"
                >
                  Este Mês
                </button>
              </div>

              <button
                type="button"
                id="btn-export-pdf"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 active:bg-black transition-all shadow-md shadow-neutral-100 text-sm cursor-pointer"
              >
                <Download size={16} />
                Exportar PDF
              </button>
            </div>
          </div>

          {/* Current Active Range Info Bar */}
          <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-emerald-600" />
              <span>
                Período exibido: <strong className="text-neutral-800 font-bold">{format(appliedDateRange.start, 'dd/MM/yyyy')}</strong> até <strong className="text-neutral-800 font-bold">{format(appliedDateRange.end, 'dd/MM/yyyy')}</strong>
              </span>
              {isFiltering && (
                <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Atualizando...
                </span>
              )}
            </div>
            <span className="font-semibold text-neutral-600">
              {totalRides} {totalRides === 1 ? 'corrida no período' : 'corridas no período'}
            </span>
          </div>
        </form>
      </div>

      {/* Stats Grid - Summary Cards Kept Visible */}
      <div id="report-summary-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div id="card-total-bruto" className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Total Bruto</p>
            {isFiltering && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
          </div>
          <p className="text-2xl font-black text-neutral-900">R$ {totalSold.toFixed(2)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-bold">
            <TrendingUp size={14} />
            Período Selecionado
          </div>
        </div>
        <div id="card-total-liquido" className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm transition-all">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total Líquido</p>
          <p className="text-2xl font-black text-blue-600">R$ {totalNet.toFixed(2)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-bold">
            <CreditCard size={14} />
            Líquido Motoristas
          </div>
        </div>
        <div id="card-total-retido" className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm transition-all">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total Retido</p>
          <p className="text-2xl font-black text-red-500">R$ {totalFees.toFixed(2)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-red-500 font-bold">
            <ArrowDownRight size={14} />
            Taxas e Retenções
          </div>
        </div>
        <div id="card-total-corridas" className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm transition-all">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total Corridas</p>
          <p className="text-2xl font-black text-amber-600">{totalRides}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 font-bold">
            <Car size={14} />
            {totalRides > 0 ? (totalSold / totalRides).toFixed(2) : '0.00'} Ticket Médio
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Trend */}
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <h3 className="text-lg font-bold text-neutral-900 mb-8">Evolução de Vendas</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Seller */}
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <h3 className="text-lg font-bold text-neutral-900 mb-8">Vendas por Vendedor</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesBySeller}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {salesBySeller.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Sector */}
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <h3 className="text-lg font-bold text-neutral-900 mb-8">Vendas por Setor</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesBySector} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} width={100} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {salesBySector.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Payment Method */}
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <h3 className="text-lg font-bold text-neutral-900 mb-8">Formas de Pagamento</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByMethod}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {salesByMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {salesByMethod.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Drivers */}
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-neutral-900 mb-6">Top Motoristas (Volume)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drivers.map(driver => {
              const driverRides = rides.filter(r => r.driverId === driver.id);
              const volume = driverRides.reduce((acc, r) => acc + r.value, 0);
              return { ...driver, volume, count: driverRides.length };
            })
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 10)
            .map((driver, i) => (
              <div key={driver.id} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-neutral-400 font-bold text-xs border border-neutral-200">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{driver.name}</p>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{driver.licensePlate}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">R$ {driver.volume.toFixed(2)}</p>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{driver.count} corridas</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
