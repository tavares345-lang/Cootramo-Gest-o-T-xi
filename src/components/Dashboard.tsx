import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride, Sector, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  TrendingUp, 
  Users, 
  Car, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  MapPin
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard({ onNavigate }: { onNavigate?: (page: any) => void }) {
  const { profile } = useAuth();
  const [todayRides, setTodayRides] = useState<Ride[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const today = startOfDay(new Date());
    const endToday = endOfDay(new Date());

    let qToday = query(
      collection(db, 'rides'),
      where('createdAt', '>=', Timestamp.fromDate(today)),
      where('createdAt', '<=', Timestamp.fromDate(endToday))
    );

    let qRecent = query(
      collection(db, 'rides'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    if (profile?.role !== 'ADMINISTRADOR' && profile?.sectorId) {
      qToday = query(qToday, where('sectorId', '==', profile.sectorId));
      qRecent = query(qRecent, where('sectorId', '==', profile.sectorId));
    }

    const unsubToday = onSnapshot(qToday, (snapshot) => {
      setTodayRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides-today');
    });

    const unsubRecent = onSnapshot(qRecent, (snapshot) => {
      setRecentRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides-recent');
    });

    const unsubSectors = onSnapshot(collection(db, 'sectors'), (snapshot) => {
      setSectors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sectors');
    });

    setLoading(false);
    return () => {
      unsubToday();
      unsubRecent();
      unsubSectors();
    };
  }, [profile]);

  const totalSoldToday = todayRides.reduce((acc, ride) => acc + ride.value, 0);
  const totalNetToday = todayRides.reduce((acc, ride) => acc + ride.netValue, 0);
  const totalRidesToday = todayRides.length;

  const stats = [
    { label: 'Vendas Hoje', value: `R$ ${totalSoldToday.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Líquido Motoristas', value: `R$ ${totalNetToday.toFixed(2)}`, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Corridas Realizadas', value: totalRidesToday.toString(), icon: Car, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Ticket Médio', value: `R$ ${(totalRidesToday ? totalSoldToday / totalRidesToday : 0).toFixed(2)}`, icon: ArrowUpRight, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Admin Actions */}
      {profile?.role === 'ADMINISTRADOR' && (
        <div className="bg-emerald-600 p-8 rounded-3xl text-white shadow-lg shadow-emerald-200 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Painel de Administração</h2>
            <p className="text-emerald-50 opacity-90 max-w-md">
              Acompanhe o desempenho global da cooperativa e gere relatórios detalhados para tomada de decisão.
            </p>
          </div>
          <button 
            onClick={() => onNavigate?.('analysis')}
            className="relative z-10 flex items-center gap-3 px-8 py-4 bg-white text-emerald-600 rounded-2xl font-bold hover:bg-emerald-50 transition-all shadow-xl"
          >
            <TrendingUp size={20} />
            Analisar vendas do mês
          </button>
          <TrendingUp size={180} className="absolute -right-12 -bottom-12 text-white/10 rotate-12" />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                <stat.icon size={24} />
              </div>
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-neutral-900">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Recent Activity */}
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <h3 className="text-lg font-bold text-neutral-900 mb-6">Últimas Corridas</h3>
          <div className="space-y-6">
            {recentRides.length > 0 ? (
              recentRides.map((ride) => (
                <div key={ride.id} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-neutral-50 transition-colors border border-transparent hover:border-neutral-100">
                  <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500 shrink-0">
                    <Car size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-neutral-900 truncate">
                        {ride.passengerName || 'Passageiro'}
                      </p>
                      <span className="text-sm font-bold text-emerald-600">R$ {ride.value.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-neutral-400 mb-2">
                      <MapPin size={12} />
                      <span className="truncate">{ride.origin} → {ride.destination}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-medium uppercase tracking-wider">
                      <Clock size={10} />
                      {format(ride.createdAt.toDate(), "HH:mm '•' dd/MM", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-neutral-400">
                <Clock size={48} className="mb-4 opacity-20" />
                <p className="text-sm">Nenhuma corrida registrada hoje</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
