import React, { useState } from 'react';
import { useOfflineSync } from '../contexts/OfflineSyncContext';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Clock, 
  MapPin, 
  DollarSign, 
  Trash2,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function OfflineSyncManager() {
  const { 
    isOnline, 
    isSyncing, 
    pendingCount, 
    pendingSales, 
    lastSyncTime, 
    syncError, 
    syncPendingSales,
    deleteOfflineSale
  } = useOfflineSync();

  const [isOpen, setIsOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualSync = async () => {
    setSyncFeedback(null);
    const result = await syncPendingSales();
    if (result.success > 0) {
      setSyncFeedback(`${result.success} ${result.success === 1 ? 'venda sincronizada' : 'vendas sincronizadas'} com o servidor com sucesso!`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } else if (result.failed > 0) {
      setSyncFeedback(`Não foi possível sincronizar ${result.failed} venda(s). Verifique a conexão e tente novamente.`);
    }
  };

  return (
    <>
      {/* Header Connectivity & Sync Indicator */}
      <div className="flex items-center gap-2">
        {/* Network Status Badge */}
        <div 
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
            isOnline 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
          }`}
          title={isOnline ? 'Conexão com a internet ativa' : 'Sem internet: vendas serão salvas no IndexedDB local'}
        >
          {isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <Wifi size={13} className="text-emerald-600" />
              <span className="hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <WifiOff size={13} className="text-amber-600" />
              <span>Offline (IndexedDB)</span>
            </>
          )}
        </div>

        {/* Pending Offline Sales Counter Button */}
        {pendingCount > 0 && (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-bold shadow-sm transition-all animate-bounce"
            title="Clique para gerenciar as vendas salvas offline"
          >
            <HardDrive size={13} />
            <span>{pendingCount} offline</span>
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Quick Sync Button if online & pending */}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-full text-xs font-bold transition-all shadow-sm"
            title="Sincronizar vendas offline com o Firestore agora"
          >
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        )}
      </div>

      {/* Offline Sales Queue Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsOpen(false)} 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }} 
              className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">Vendas Gravadas no IndexedDB</h3>
                    <p className="text-xs text-neutral-500">
                      {pendingCount === 0 
                        ? 'Nenhuma venda aguardando sincronização no momento.' 
                        : `${pendingCount} ${pendingCount === 1 ? 'venda gravada localmente' : 'vendas gravadas localmente'} aguardando envio ao Firestore.`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Banner Info */}
              <div className="my-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle size={15} />
                  <span>Garantia de Continuidade de Vendas</span>
                </div>
                <p className="leading-relaxed text-amber-700">
                  Todas as vendas emitidas durante instabilidade de internet estão armazenadas no banco local do navegador. Os vouchers impressos já são válidos para os passageiros e motoristas.
                </p>
              </div>

              {/* Feedback messages */}
              {syncFeedback && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>{syncFeedback}</span>
                </div>
              )}

              {syncError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-600" />
                  <span>{syncError}</span>
                </div>
              )}

              {/* Items List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
                {pendingSales.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400">
                    <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                    <p className="font-semibold text-sm text-neutral-600">Tudo sincronizado!</p>
                    <p className="text-xs text-neutral-400 mt-1">Não há vendas pendentes no IndexedDB deste navegador.</p>
                  </div>
                ) : (
                  pendingSales.map((item) => (
                    <div 
                      key={item.localId}
                      className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                          #{item.voucherData.voucherNumber}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                            item.syncStatus === 'syncing' 
                              ? 'bg-blue-100 text-blue-700'
                              : item.syncStatus === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.syncStatus === 'syncing' ? 'Sincronizando...' : item.syncStatus === 'failed' ? 'Tentará novamente' : 'Pendente'}
                          </span>
                          <button
                            onClick={() => deleteOfflineSale(item.localId)}
                            title="Descartar esta venda do armazenamento local"
                            className="p-1 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-neutral-700">
                          <MapPin size={13} className="text-neutral-400 shrink-0" />
                          <span className="truncate font-medium">{item.rideData.destination}</span>
                        </div>
                        <div className="flex items-center gap-1.5 justify-end text-emerald-700 font-bold">
                          <DollarSign size={13} className="text-emerald-500 shrink-0" />
                          <span>R$ {Number(item.rideData.value).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-100">
                        <span>{item.rideData.passengerName ? `Passageiro: ${item.rideData.passengerName}` : 'Sem nome de passageiro'}</span>
                        <span>{format(new Date(item.localCreatedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 mt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-neutral-400 text-center sm:text-left">
                  {lastSyncTime ? (
                    <span>Última sincronização: {format(lastSyncTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  ) : (
                    <span>Sincronização automática ativa ao detectar sinal.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 text-xs font-semibold transition-colors"
                  >
                    Fechar
                  </button>

                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing || pendingCount === 0}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-colors"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Tudo Agora'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
