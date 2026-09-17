/**
 * IndexedDB Persistence Service for Taxi Gestão
 * Enables offline ride sales and automatic synchronization with Firestore when online.
 */

export interface OfflineRideData {
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
  status: 'pending' | 'paid';
  createdAtMillis: number;
}

export interface OfflineVoucherData {
  voucherNumber: string;
  status: 'active';
  createdAtMillis: number;
}

export interface OfflineSaleRecord {
  localId: string;
  rideData: OfflineRideData;
  voucherData: OfflineVoucherData;
  localCreatedAt: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  lastError?: string;
  syncedRideId?: string;
  syncedVoucherId?: string;
  syncedAt?: number;
}

const DB_NAME = 'TaxiGestaoOfflineDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB não suportado neste navegador.'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Pending sales store
      if (!db.objectStoreNames.contains('pending_sales')) {
        const salesStore = db.createObjectStore('pending_sales', { keyPath: 'localId' });
        salesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        salesStore.createIndex('localCreatedAt', 'localCreatedAt', { unique: false });
      }

      // Synced sales store (keeps recent local audit trail)
      if (!db.objectStoreNames.contains('synced_sales')) {
        const syncedStore = db.createObjectStore('synced_sales', { keyPath: 'localId' });
        syncedStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }

      // Catalog cache store (destinations, drivers, sectors, paymentMethods)
      if (!db.objectStoreNames.contains('catalog_cache')) {
        db.createObjectStore('catalog_cache', { keyPath: 'key' });
      }

      // Meta store
      if (!db.objectStoreNames.contains('offline_meta')) {
        db.createObjectStore('offline_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Saves a sale locally in IndexedDB with pending sync status.
 */
export async function saveSaleOffline(
  rideData: OfflineRideData, 
  voucherData: OfflineVoucherData,
  customLocalId?: string
): Promise<OfflineSaleRecord> {
  const db = await getDB();
  const localId = customLocalId || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  const record: OfflineSaleRecord = {
    localId,
    rideData,
    voucherData,
    localCreatedAt: Date.now(),
    syncStatus: 'pending',
    syncAttempts: 0
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_sales'], 'readwrite');
    const store = transaction.objectStore('pending_sales');
    const request = store.put(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets all pending or failed sales waiting to be synchronized with Firestore.
 */
export async function getPendingSales(): Promise<OfflineSaleRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_sales'], 'readonly');
    const store = transaction.objectStore('pending_sales');
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result || []) as OfflineSaleRecord[];
      // Return records that are not yet successfully synced
      const pending = records.filter(r => r.syncStatus === 'pending' || r.syncStatus === 'syncing' || r.syncStatus === 'failed');
      // Sort oldest first for chronological FIFO syncing
      pending.sort((a, b) => a.localCreatedAt - b.localCreatedAt);
      resolve(pending);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count of pending offline sales.
 */
export async function getPendingSalesCount(): Promise<number> {
  const sales = await getPendingSales();
  return sales.length;
}

/**
 * Updates an offline sale record's status in IndexedDB.
 */
export async function updatePendingSale(record: OfflineSaleRecord): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_sales'], 'readwrite');
    const store = transaction.objectStore('pending_sales');
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Moves a successfully synchronized sale from pending_sales to synced_sales.
 */
export async function markSaleAsSynced(
  localId: string, 
  syncedRideId: string, 
  syncedVoucherId: string
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_sales', 'synced_sales'], 'readwrite');
    const pendingStore = transaction.objectStore('pending_sales');
    const syncedStore = transaction.objectStore('synced_sales');

    const getReq = pendingStore.get(localId);

    getReq.onsuccess = () => {
      const record = getReq.result as OfflineSaleRecord | undefined;
      if (record) {
        record.syncStatus = 'synced';
        record.syncedRideId = syncedRideId;
        record.syncedVoucherId = syncedVoucherId;
        record.syncedAt = Date.now();
        
        // Put in synced store and remove from pending
        syncedStore.put(record);
        pendingStore.delete(localId);
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Removes an offline sale completely (e.g., if manually discarded).
 */
export async function deletePendingSale(localId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_sales'], 'readwrite');
    const store = transaction.objectStore('pending_sales');
    const request = store.delete(localId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets all locally recorded sales (both pending and recently synced) for offline view.
 */
export async function getAllLocalSales(): Promise<OfflineSaleRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_sales', 'synced_sales'], 'readonly');
    const pendingStore = transaction.objectStore('pending_sales');
    const syncedStore = transaction.objectStore('synced_sales');

    const pendingReq = pendingStore.getAll();
    const syncedReq = syncedStore.getAll();

    let pending: OfflineSaleRecord[] = [];
    let synced: OfflineSaleRecord[] = [];

    pendingReq.onsuccess = () => {
      pending = pendingReq.result || [];
    };

    syncedReq.onsuccess = () => {
      synced = syncedReq.result || [];
    };

    transaction.oncomplete = () => {
      const all = [...pending, ...synced];
      all.sort((a, b) => b.localCreatedAt - a.localCreatedAt);
      resolve(all);
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Caches reference data (destinations, drivers, payment methods, sectors) locally
 * so that ride calculation and creation works seamlessly even with zero connectivity.
 */
export async function cacheCatalogData<T>(key: 'destinations' | 'drivers' | 'paymentMethods' | 'sectors', data: T[]): Promise<void> {
  if (!data || !Array.isArray(data)) return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['catalog_cache'], 'readwrite');
      const store = transaction.objectStore('catalog_cache');
      const request = store.put({ key, data, updatedAt: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`Erro ao cachear catálogo '${key}' no IndexedDB:`, err);
  }
}

/**
 * Retrieves cached reference data from IndexedDB.
 */
export async function getCachedCatalogData<T>(key: 'destinations' | 'drivers' | 'paymentMethods' | 'sectors'): Promise<T[] | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(['catalog_cache'], 'readonly');
      const store = transaction.objectStore('catalog_cache');
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result && request.result.data) {
          resolve(request.result.data as T[]);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Saves arbitrary offline metadata.
 */
export async function setOfflineMeta(key: string, value: any): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline_meta'], 'readwrite');
      const store = transaction.objectStore('offline_meta');
      const request = store.put({ key, value, updatedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar meta no IndexedDB:', err);
  }
}

/**
 * Gets arbitrary offline metadata.
 */
export async function getOfflineMeta<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(['offline_meta'], 'readonly');
      const store = transaction.objectStore('offline_meta');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? (request.result.value as T) : null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
