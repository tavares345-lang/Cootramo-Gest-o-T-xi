import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Ride, Voucher } from '../types';
import { 
  saveSaleOffline, 
  getPendingSales, 
  getPendingSalesCount, 
  updatePendingSale, 
  markSaleAsSynced, 
  deletePendingSale,
  OfflineSaleRecord,
  OfflineRideData,
  OfflineVoucherData
} from '../lib/offline-storage';

interface RecordSaleParams {
  passengerName?: string;
  origin: string;
  destination: string;
  value: number;
  paymentMethodId: string;
  feeAmount: number;
  netValue: number;
  sellerId: string;
  sectorId: string;
  driverId?: string;
}

interface OfflineSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  pendingSales: OfflineSaleRecord[];
  lastSyncTime: Date | null;
  syncError: string | null;
  syncPendingSales: () => Promise<{ success: number; failed: number }>;
  recordSaleWithOfflineFallback: (params: RecordSaleParams) => Promise<{
    ride: Ride;
    voucher: Voucher;
    isOffline: boolean;
    localId: string;
  }>;
  refreshPending: () => Promise<void>;
  deleteOfflineSale: (localId: string) => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  pendingSales: [],
  lastSyncTime: null,
  syncError: null,
  syncPendingSales: async () => ({ success: 0, failed: 0 }),
  recordSaleWithOfflineFallback: async () => { throw new Error('Not implemented'); },
  refreshPending: async () => {},
  deleteOfflineSale: async () => {}
});

export const useOfflineSync = () => useContext(OfflineSyncContext);

const FIRESTORE_WRITE_TIMEOUT_MS = 3500; // 3.5 seconds max wait before saving offline

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingSales, setPendingSales] = useState<OfflineSaleRecord[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isSyncingRef = useRef(false);

  // Refresh pending list from IndexedDB
  const refreshPending = useCallback(async () => {
    try {
      const pending = await getPendingSales();
      setPendingSales(pending);
      setPendingCount(pending.length);
    } catch (err) {
      console.warn('Erro ao carregar vendas pendentes do IndexedDB:', err);
    }
  }, []);

  // Quick online check using navigator and heartbeat
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    try {
      // Lightweight probe with 2.5s abort timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/health', { method: 'GET', signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      const online = res.ok;
      setIsOnline(online);
      return online;
    } catch {
      // If /api/health couldn't be reached, fallback to navigator.onLine
      const fallback = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(fallback);
      return fallback;
    }
  }, []);

  // Synchronize all pending sales in IndexedDB to Firestore
  const syncPendingSales = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (isSyncingRef.current) {
      return { success: 0, failed: 0 };
    }

    const online = await checkConnectivity();
    if (!online) {
      setSyncError('Sem conexão com a internet. As vendas continuarão salvas com segurança no dispositivo.');
      return { success: 0, failed: 0 };
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    let success = 0;
    let failed = 0;

    try {
      const items = await getPendingSales();
      if (items.length === 0) {
        setPendingCount(0);
        setPendingSales([]);
        return { success: 0, failed: 0 };
      }

      for (const item of items) {
        try {
          // Update status to 'syncing'
          item.syncStatus = 'syncing';
          item.syncAttempts = (item.syncAttempts || 0) + 1;
          await updatePendingSale(item);

          // Prepare clean ride payload for Firestore
          const ridePayload: any = {
            origin: item.rideData.origin,
            destination: item.rideData.destination,
            value: Number(item.rideData.value),
            paymentMethodId: item.rideData.paymentMethodId,
            feeAmount: Number(item.rideData.feeAmount || 0),
            netValue: Number(item.rideData.netValue || item.rideData.value),
            sellerId: item.rideData.sellerId,
            sectorId: item.rideData.sectorId,
            status: item.rideData.status || 'pending',
            createdAt: Timestamp.fromMillis(item.rideData.createdAtMillis || item.localCreatedAt),
          };

          if (item.rideData.driverId) {
            ridePayload.driverId = item.rideData.driverId;
          }
          if (item.rideData.passengerName?.trim()) {
            ridePayload.passengerName = item.rideData.passengerName.trim();
          }

          // Push Ride to Firestore
          const rideRef = await addDoc(collection(db, 'rides'), ridePayload);

          // Prepare Voucher payload
          const voucherPayload: any = {
            rideId: rideRef.id,
            voucherNumber: item.voucherData.voucherNumber,
            status: item.voucherData.status || 'active',
            createdAt: Timestamp.fromMillis(item.voucherData.createdAtMillis || item.localCreatedAt),
          };

          // Push Voucher to Firestore
          const voucherRef = await addDoc(collection(db, 'vouchers'), voucherPayload);

          // Mark as synced and move to local archive store
          await markSaleAsSynced(item.localId, rideRef.id, voucherRef.id);
          success++;
        } catch (itemError: any) {
          console.error(`Erro ao sincronizar venda offline ${item.localId}:`, itemError);
          item.syncStatus = 'failed';
          item.lastError = itemError?.message || 'Falha na comunicação com o Firestore';
          await updatePendingSale(item);
          failed++;
        }
      }

      if (success > 0) {
        setLastSyncTime(new Date());
      }
    } catch (err: any) {
      console.error('Erro geral no processo de sincronização offline:', err);
      setSyncError(err?.message || 'Erro durante a sincronização.');
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      await refreshPending();
    }

    return { success, failed };
  }, [checkConnectivity, refreshPending]);

  // Primary sale recorder: saves to IndexedDB immediately, then syncs to Firestore if online
  const recordSaleWithOfflineFallback = useCallback(async (params: RecordSaleParams): Promise<{
    ride: Ride;
    voucher: Voucher;
    isOffline: boolean;
    localId: string;
  }> => {
    const now = Date.now();
    const createdAtMillis = now;
    const voucherNumber = `V-${now.toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const offlineRideData: OfflineRideData = {
      passengerName: params.passengerName?.trim() || undefined,
      origin: params.origin,
      destination: params.destination,
      value: params.value,
      paymentMethodId: params.paymentMethodId,
      feeAmount: params.feeAmount,
      netValue: params.netValue,
      sellerId: params.sellerId || profile?.uid || 'offline_seller',
      sectorId: params.sectorId || profile?.sectorId || 'offline_sector',
      driverId: params.driverId || undefined,
      status: 'pending',
      createdAtMillis,
    };

    const offlineVoucherData: OfflineVoucherData = {
      voucherNumber,
      status: 'active',
      createdAtMillis,
    };

    // 1. Immediately persist to IndexedDB so the sale is 100% safe locally
    const record = await saveSaleOffline(offlineRideData, offlineVoucherData);
    await refreshPending();

    // 2. Check if currently online
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!online) {
      console.info('Dispositivo offline: venda gravada no IndexedDB com sucesso.', record.localId);
      const localRide: Ride = {
        id: record.localId,
        ...offlineRideData,
        createdAt: Timestamp.fromMillis(createdAtMillis)
      };
      const localVoucher: Voucher = {
        id: `v_${record.localId}`,
        rideId: record.localId,
        voucherNumber,
        status: 'active',
        createdAt: Timestamp.fromMillis(createdAtMillis)
      };

      return {
        ride: localRide,
        voucher: localVoucher,
        isOffline: true,
        localId: record.localId
      };
    }

    // 3. Online: attempt immediate Firestore sync with safety timeout
    try {
      const firestoreWritePromise = async () => {
        const cleanRide: any = {
          origin: offlineRideData.origin,
          destination: offlineRideData.destination,
          value: offlineRideData.value,
          paymentMethodId: offlineRideData.paymentMethodId,
          feeAmount: offlineRideData.feeAmount,
          netValue: offlineRideData.netValue,
          sellerId: offlineRideData.sellerId,
          sectorId: offlineRideData.sectorId,
          status: 'pending',
          createdAt: Timestamp.fromMillis(createdAtMillis),
        };
        if (offlineRideData.driverId) cleanRide.driverId = offlineRideData.driverId;
        if (offlineRideData.passengerName) cleanRide.passengerName = offlineRideData.passengerName;

        const rideRef = await addDoc(collection(db, 'rides'), cleanRide);

        const cleanVoucher = {
          rideId: rideRef.id,
          voucherNumber,
          status: 'active',
          createdAt: Timestamp.fromMillis(createdAtMillis),
        };

        const voucherRef = await addDoc(collection(db, 'vouchers'), cleanVoucher);

        return {
          rideDocId: rideRef.id,
          voucherDocId: voucherRef.id,
          ride: { id: rideRef.id, ...cleanRide } as Ride,
          voucher: { id: voucherRef.id, ...cleanVoucher } as Voucher
        };
      };

      // Race against timeout to avoid blocking attendant if network stalls
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout de rede com o Firestore')), FIRESTORE_WRITE_TIMEOUT_MS);
      });

      const result = await Promise.race([firestoreWritePromise(), timeoutPromise]);

      // Successfully saved to Firestore! Update IndexedDB status
      await markSaleAsSynced(record.localId, result.rideDocId, result.voucherDocId);
      await refreshPending();

      return {
        ride: result.ride,
        voucher: result.voucher,
        isOffline: false,
        localId: record.localId
      };
    } catch (networkError) {
      console.warn('Falha ou lentidão na sincronização direta com o Firestore. Mantendo no IndexedDB para sincronizar depois:', networkError);
      // Fallback: keep in IndexedDB as pending, attendant can print voucher immediately!
      const fallbackRide: Ride = {
        id: record.localId,
        ...offlineRideData,
        createdAt: Timestamp.fromMillis(createdAtMillis)
      };
      const fallbackVoucher: Voucher = {
        id: `v_${record.localId}`,
        rideId: record.localId,
        voucherNumber,
        status: 'active',
        createdAt: Timestamp.fromMillis(createdAtMillis)
      };

      return {
        ride: fallbackRide,
        voucher: fallbackVoucher,
        isOffline: true,
        localId: record.localId
      };
    }
  }, [profile, refreshPending]);

  const deleteOfflineSale = useCallback(async (localId: string) => {
    await deletePendingSale(localId);
    await refreshPending();
  }, [refreshPending]);

  // Handle window online/offline events & periodic sync
  useEffect(() => {
    const handleOnline = () => {
      console.log('Dispositivo conectou à internet.');
      setIsOnline(true);
      // Auto-sync when connection returns!
      syncPendingSales();
    };

    const handleOffline = () => {
      console.log('Dispositivo desconectou da internet. Modo offline ativado.');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load
    refreshPending();
    checkConnectivity();

    // Periodic heartbeat and auto-sync check every 25 seconds
    const intervalId = setInterval(() => {
      checkConnectivity().then((online) => {
        if (online) {
          getPendingSalesCount().then(count => {
            if (count > 0 && !isSyncingRef.current) {
              syncPendingSales();
            }
          });
        }
      });
    }, 25000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [checkConnectivity, refreshPending, syncPendingSales]);

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        pendingSales,
        lastSyncTime,
        syncError,
        syncPendingSales,
        recordSaleWithOfflineFallback,
        refreshPending,
        deleteOfflineSale,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};
