import { IndexedDb } from '../../bb/base/indexed-db';
import type { TIdb } from './kl-indexed-db.types';

let dbName = 'Klecks';
export function setKlIndexedDbName(name: string): void {
    dbName = name;
}
export function getKlIndexedDbName(): string {
    return dbName;
}

export const RECOVERY_STORE = 'RecoveryStore';
export const IMAGE_DATA_STORE = 'ImageDataStore';
// aka browser storage
export const PROJECT_STORE = 'ProjectStore';
export type TKlIdbSchema = {
    [RECOVERY_STORE]: {
        Key: TIdb['V2']['RecoveryStore']['Key'];
        Read: TIdb['V2']['RecoveryStore']['Read'];
        Write: TIdb['V2']['RecoveryStore']['Write'];
    };
    [IMAGE_DATA_STORE]: {
        Key: TIdb['V2']['ImageDataStore']['Key'];
        Read: TIdb['V2']['ImageDataStore']['Read'];
        Write: TIdb['V2']['ImageDataStore']['Write'];
    };
    [PROJECT_STORE]: {
        Key: TIdb['V2']['ProjectStore']['Key'];
        Read: TIdb['V2']['ProjectStore']['Read'];
        Write: TIdb['V2']['ProjectStore']['Write'];
    };
};

export const KL_INDEXED_DB_VERSION = 2;
export const KL_INDEXED_DB_UPGRADER = (event: IDBVersionChangeEvent) => {
    const oldVersion = event.oldVersion;
    const db = (event.target as IDBOpenDBRequest).result;
    if (oldVersion < 1) {
        const store = db.createObjectStore(PROJECT_STORE, {
            keyPath: 'id',
        });
        store.createIndex('id', 'id', { unique: true });
    }
    if (oldVersion < 2) {
        db.createObjectStore(IMAGE_DATA_STORE);
        db.createObjectStore(RECOVERY_STORE);
    }
};

export const KL_INDEXED_DB = new IndexedDb<TKlIdbSchema>({
    objectStoreNames: [RECOVERY_STORE, IMAGE_DATA_STORE, PROJECT_STORE],
    version: KL_INDEXED_DB_VERSION,
    upgrader: KL_INDEXED_DB_UPGRADER,
});
