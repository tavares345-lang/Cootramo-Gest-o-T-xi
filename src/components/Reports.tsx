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
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useAuth } from '../contexts/AuthContext';

export default function Reports() {
  const { profile } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [sellers, setSellers] = useState<UserProfile[]>([]);
  const [dateRange, setDateRange] = useState({ start: subDays(new Date(), 7), end: new Date() });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    let q = query(
      collection(db, 'rides'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay(dateRange.start))),
      where('createdAt', '<=', Timestamp.fromDate(endOfDay(dateRange.end))),
      orderBy('createdAt', 'desc')
    );

    if (profile?.role !== 'ADMINISTRADOR' && profile?.sectorId) {
      q = query(q, where('sectorId', '==', profile.sectorId));
    }

    const unsubRides = onSnapshot(q, (snapshot) => {
      setRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides');
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

    setLoading(false);
    return () => {
      unsubRides();
      unsubSectors();
      unsubDrivers();
      unsubMethods();
      unsubSellers();
    };
  }, [dateRange, profile]);

  const totalSold = rides.reduce((acc, ride) => acc + ride.value, 0);
  const totalNet = rides.reduce((acc, ride) => acc + ride.netValue, 0);
  const totalFees = rides.reduce((acc, ride) => acc + ride.feeAmount, 0);
  const totalRides = rides.length;

  const salesByDay = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map(day => ({
    date: format(day, 'dd/MM'),
    value: rides.filter(ride => format(ride.createdAt.toDate(), 'dd/MM') === format(day, 'dd/MM')).reduce((acc, ride) => acc + ride.value, 0)
  }));

  const salesBySector = sectors.map(sector => ({
    name: sector.name,
    value: rides.filter(ride => ride.sectorId === sector.id).reduce((acc, ride) => acc + ride.value, 0)
  })).filter(s => s.value > 0);

  const salesByMethod = paymentMethods.map(method => ({
    name: method.name,
    value: rides.filter(ride => ride.paymentMethodId === method.id).reduce((acc, ride) => acc + ride.value, 0)
  })).filter(s => s.value > 0);

  const salesBySeller = sellers.map(seller => ({
    name: seller.name,
    value: rides.filter(ride => ride.sellerId === seller.uid).reduce((acc, ride) => acc + ride.value, 0)
  })).filter(s => s.value > 0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8">
      {/* Filters & Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600">
            <Calendar size={18} />
            {format(dateRange.start, 'dd/MM/yyyy')} - {format(dateRange.end, 'dd/MM/yyyy')}
          </div>
          <button className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 transition-all">
            <Filter size={20} />
          </button>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-100">
          <Download size={18} />
          Exportar PDF
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total Bruto</p>
          <p className="text-2xl font-black text-neutral-900">R$ {totalSold.toFixed(2)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-bold">
            <TrendingUp size={14} />
            Período Selecionado
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total Líquido</p>
          <p className="text-2xl font-black text-blue-600">R$ {totalNet.toFixed(2)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-bold">
            <CreditCard size={14} />
            Líquido Motoristas
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total Retido</p>
          <p className="text-2xl font-black text-red-500">R$ {totalFees.toFixed(2)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-red-500 font-bold">
            <ArrowDownRight size={14} />
            Taxas e Retenções
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Total Corridas</p>
          <p className="text-2xl font-black text-amber-600">{totalRides}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 font-bold">
            <Car size={14} />
            {totalRides > 0 ? (totalSold / totalRides).toFixed(2) : 0} Ticket Médio
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
