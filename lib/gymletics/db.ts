import { createDefaultData } from './defaults';
import type { GymleticsData } from './types';

const DB_NAME = 'gymletics-local';
const DB_VERSION = 1;
const STORE = 'app-state';
const STATE_KEY = 'primary';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadData(): Promise<GymleticsData> {
  if (typeof indexedDB === 'undefined') return createDefaultData();
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(STATE_KEY);
    request.onsuccess = () => resolve((request.result as GymleticsData | undefined) ?? createDefaultData());
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveData(data: GymleticsData): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(data, STATE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export function isGymleticsData(value: unknown): value is GymleticsData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GymleticsData>;
  return candidate.version === 1 && Array.isArray(candidate.plans) && Array.isArray(candidate.sessions);
}
