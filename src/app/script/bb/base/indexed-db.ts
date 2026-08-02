import { getAbortError, timeoutWrapper } from './base';

function requestToPromise<G>(request: IDBRequest<G>): Promise<G> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export type TIndexedDbRecord<GValue, GKey extends IDBValidKey> = {
    // The index key for index reads; identical to primaryKey for object-store reads.
    key: GKey;
    // The key of the record in its object store.
    primaryKey: GKey;
    value: GValue;
};

// todo remove when typescript api is updated
type TIdbObjectStoreWithGetAllRecords = IDBObjectStore & {
    getAllRecords?: () => IDBRequest<TIndexedDbRecord<unknown, IDBValidKey>[]>;
};

export type TIdbSchema = {
    [K in string]: {
        Key: IDBValidKey;
        Read: any;
        Write: any;
    };
};
export type TIdbSchemaStoreName<G extends TIdbSchema> = keyof G & string;

export class IndexedDbTransaction<
    GSchema extends TIdbSchema,
    GStoreName extends TIdbSchemaStoreName<GSchema>,
> {
    // A trick to ensure store names must exactly match when passing an instance of this class,
    // because parameters of function-valued properties are type checked contravariantly.
    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-6.html#strict-function-types
    declare private readonly enforceStoreNames: (storeName: GStoreName) => void;

    constructor(private transaction: IDBTransaction) {}

    private getObjectStore(store: TIdbSchemaStoreName<GSchema>): IDBObjectStore {
        return this.transaction.objectStore(store);
    }

    async get<G extends GStoreName>(
        store: G,
        key: GSchema[G]['Key'],
    ): Promise<GSchema[G]['Read'] | undefined> {
        return requestToPromise(this.getObjectStore(store).get(key));
    }

    async getAll<G extends GStoreName>(store: G): Promise<GSchema[G]['Read'][]> {
        return requestToPromise(this.getObjectStore(store).getAll());
    }

    async getAllKeys<G extends GStoreName>(store: G): Promise<GSchema[G]['Key'][]> {
        return requestToPromise(this.getObjectStore(store).getAllKeys()) as Promise<
            GSchema[G]['Key'][]
        >;
    }

    async getAllRecords<G extends GStoreName>(
        store: G,
    ): Promise<TIndexedDbRecord<GSchema[G]['Read'], GSchema[G]['Key']>[]> {
        const objectStore = this.getObjectStore(store) as TIdbObjectStoreWithGetAllRecords;
        if (objectStore.getAllRecords) {
            return requestToPromise(objectStore.getAllRecords()) as Promise<
                TIndexedDbRecord<GSchema[G]['Read'], GSchema[G]['Key']>[]
            >;
        }
        // getAllRecords was added to browsers 2025/2026. So we have a fallback.

        // same ordering
        const [keys, values] = await Promise.all([
            requestToPromise(objectStore.getAllKeys()),
            requestToPromise(objectStore.getAll()) as Promise<GSchema[G]['Read'][]>,
        ]);
        return keys.map((key, index) => ({
            key,
            primaryKey: key,
            value: values[index],
        }));
    }

    async set<G extends GStoreName>(
        store: G,
        key: GSchema[G]['Key'] | undefined,
        value: GSchema[G]['Write'],
    ): Promise<void> {
        await requestToPromise(this.getObjectStore(store).put(value, key));
    }

    async remove<G extends GStoreName>(store: G, key: GSchema[G]['Key']): Promise<void> {
        await requestToPromise(this.getObjectStore(store).delete(key));
    }

    async bulkGet<G extends GStoreName>(
        store: G,
        keys: GSchema[G]['Key'][],
    ): Promise<Map<GSchema[G]['Key'], GSchema[G]['Read'] | undefined>> {
        const objectStore = this.getObjectStore(store);
        const entries = await Promise.all(
            [...new Set(keys)].map(
                async (key) =>
                    [
                        key,
                        await requestToPromise<GSchema[G]['Read'] | undefined>(
                            objectStore.get(key),
                        ),
                    ] as const,
            ),
        );
        return new Map(entries);
    }

    async bulkSet<G extends GStoreName>(
        store: G,
        entries: {
            key: GSchema[G]['Key'] | undefined;
            value: GSchema[G]['Write'];
        }[],
    ): Promise<void> {
        const objectStore = this.getObjectStore(store);
        await Promise.all(
            entries.map(({ key, value }) => requestToPromise(objectStore.put(value, key))),
        );
    }

    async bulkRemove<G extends GStoreName>(store: G, keys: GSchema[G]['Key'][]): Promise<void> {
        const objectStore = this.getObjectStore(store);
        await Promise.all(
            [...new Set(keys)].map((key) => requestToPromise(objectStore.delete(key))),
        );
    }
}

// 2025-05-20
// Blobs not supported on iPad in private tabs.
// Blobs are required for indexed db to be useful. Data urls would be wasteful.
const areBlobUrlsSupported = async function (): Promise<boolean> {
    let result = true;
    const dbName = 'kl-blob-url-test';
    try {
        const blob = new Blob(['test'], { type: 'text/plain' });
        const db = await timeoutWrapper(
            new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(dbName, 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    db.createObjectStore('testStore');
                };
            }),
            'areBlobUrlsSupported.createDb',
        );

        await timeoutWrapper(
            new Promise<void>((resolve, reject) => {
                const transaction = db.transaction('testStore', 'readwrite');
                const store = transaction.objectStore('testStore');
                transaction.onabort = () => reject(transaction.error);
                transaction.oncomplete = () => resolve();
                store.put(blob, 'testStore');
            }),
            'areBlobUrlsSupported.storeBlob',
        );

        db.close();
    } catch (e) {
        result = false;
    }
    try {
        indexedDB.deleteDatabase(dbName);
    } catch (e) {
        // IDBFactory.deleteDatabase() called in an invalid security context
    }

    return result;
};

export type TIndexedDbUpgrader = (event: IDBVersionChangeEvent) => void;

export type TIndexedDbParams<GSchema extends TIdbSchema> = {
    objectStoreNames: TIdbSchemaStoreName<GSchema>[];
    version: number;
    upgrader: TIndexedDbUpgrader;
};

export class IndexedDb<GSchema extends TIdbSchema> {
    private storeNames: TIdbSchemaStoreName<GSchema>[];
    private dbVersion: number;
    private upgrader: TIndexedDbUpgrader;

    private dbName: string = '';
    private db: IDBDatabase | undefined;
    private openingPromise: Promise<IDBDatabase> | undefined;
    private isAvailable: boolean = true;
    private disconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    private openTransactionCount: number = 0;

    private disconnect(): void {
        this.db?.close();
        this.db = undefined;
    }

    private async disconnectAfterwardsWrapper<G>(activity: () => Promise<G>): Promise<G> {
        try {
            this.openTransactionCount++;
            clearTimeout(this.disconnectTimeout);
            return await activity();
        } finally {
            this.openTransactionCount--;
            if (this.openTransactionCount === 0) {
                // When a new version of the app upgrades the DB, old tabs holding open connections would
                // block the upgrade.
                // -> Close DB connections when inactive.
                clearTimeout(this.disconnectTimeout);
                this.disconnectTimeout = setTimeout(() => this.disconnect(), 1000);
            }
        }
    }

    private openDb(): Promise<IDBDatabase> {
        if (this.db) {
            return Promise.resolve(this.db);
        }
        if (this.openingPromise) {
            return this.openingPromise;
        }

        // ensure only one db connection
        const openingPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const openDbRequest = indexedDB.open(this.dbName, this.dbVersion);

            openDbRequest.onupgradeneeded = (event) => {
                this.upgrader(event);
            };

            openDbRequest.onsuccess = () => {
                const db = openDbRequest.result;

                // a different tab wants to upgrade the database (most likely a newer version of the app)
                db.onversionchange = () => {
                    // this tab can't work with the upgraded database. disable indexed db for this tab.
                    this.isAvailable = false;

                    // close connection so other tab can upgrade the db
                    db.close();
                    if (this.db === db) {
                        this.db = undefined;
                    }
                    throw new Error('IndexedDB onversionchange');
                };
                // when the database connection is unexpectedly closed
                db.onclose = () => {
                    if (this.db === db) {
                        this.db = undefined;
                    }
                    throw new Error('IndexedDB closed');
                };

                this.db = db;
                resolve(db);
            };

            openDbRequest.onerror = () => {
                this.isAvailable = false;
                reject(
                    openDbRequest.error ?? new Error(`Could not open IndexedDB "${this.dbName}"`),
                );
            };

            openDbRequest.onblocked = () => {
                throw new Error('IndexedDB blocked');
            };
        });

        this.openingPromise = openingPromise;
        const clearOpeningPromise = () => {
            if (this.openingPromise === openingPromise) {
                this.openingPromise = undefined;
            }
        };
        openingPromise.then(clearOpeningPromise, clearOpeningPromise);

        return openingPromise;
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TIndexedDbParams<GSchema>) {
        this.storeNames = [...p.objectStoreNames];
        this.dbVersion = p.version;
        this.upgrader = p.upgrader;
    }

    init(dbName: string) {
        if (this.dbName !== '') {
            throw new Error('IndexedDb already initialized');
        }

        this.dbName = dbName;
    }

    async testConnection(): Promise<boolean> {
        this.isAvailable = this.isAvailable && (await areBlobUrlsSupported());
        if (!this.isAvailable) {
            return this.isAvailable;
        }
        try {
            for (const name of this.storeNames) {
                const db = await timeoutWrapper(this.openDb(), 'indexed-db.testConnection.openDb');
                const transaction = db.transaction(name, 'readonly');
                transaction.abort();
            }
        } catch (e) {
            this.isAvailable = false;
        } finally {
            this.disconnect();
        }
        return this.isAvailable;
    }

    /**
     * Runs requests within a single native IndexedDB transaction. If the transaction aborts,
     * IndexedDB rolls back all changes made by it, preventing partial updates.
     */
    async runTransaction<GStoreName extends TIdbSchemaStoreName<GSchema>, GReturnValue>(
        storeNames: GStoreName[],
        mode: IDBTransactionMode,
        // Throw inside activity to abort the transaction.
        // Do not await async work unrelated to IndexedDB, or the transaction will commit early.
        activity: (transaction: IndexedDbTransaction<GSchema, GStoreName>) => Promise<GReturnValue>,
        options?: {
            // Chrome defaults to "relaxed", which is much faster and typically good enough.
            durability?: IDBTransactionDurability;
            // Aborting the signal aborts and rolls back the native transaction while it is active.
            signal?: AbortSignal;
        },
    ): Promise<GReturnValue> {
        return this.disconnectAfterwardsWrapper(async () => {
            const { durability, signal } = options ?? {};
            if (signal?.aborted) {
                throw getAbortError(signal);
            }

            const db = await this.openDb();
            if (signal?.aborted) {
                throw getAbortError(signal);
            }

            for (const storeName of storeNames) {
                if (!this.storeNames.includes(storeName)) {
                    throw new Error(`indexedDb store "${storeName}" not found in "${this.dbName}"`);
                }
            }

            const transaction = db.transaction(
                [...storeNames],
                mode,
                durability ? { durability } : undefined,
            );
            const transactionResultPromise = new Promise<
                { status: 'complete' } | { status: 'abort'; error: unknown }
            >((resolve) => {
                transaction.oncomplete = () => resolve({ status: 'complete' });
                transaction.onabort = () =>
                    resolve({
                        status: 'abort',
                        error:
                            transaction.error ??
                            new Error('IndexedDB transaction aborted for unknown reason'),
                    });
            });
            const wrappedTransaction = new IndexedDbTransaction<GSchema, GStoreName>(transaction);
            const abortTransaction = () => {
                try {
                    transaction.abort();
                } catch {
                    // The transaction already completed.
                }
            };
            signal?.addEventListener('abort', abortTransaction, { once: true });

            try {
                let result: GReturnValue;
                try {
                    result = await activity(wrappedTransaction);
                } catch (error) {
                    if (!signal?.aborted) {
                        abortTransaction();
                    }
                    const transactionResult = await transactionResultPromise;
                    if (transactionResult.status === 'complete') {
                        // a strange case you might want to know about
                        console.error(
                            'IndexedDB transaction completed, but its activity threw an error.',
                            error,
                        );
                    }
                    throw signal?.aborted ? getAbortError(signal) : error;
                }

                const transactionResult = await transactionResultPromise;
                if (transactionResult.status === 'abort') {
                    throw signal?.aborted ? getAbortError(signal) : transactionResult.error;
                }
                return result;
            } finally {
                signal?.removeEventListener('abort', abortTransaction);
            }
        });
    }

    getIsAvailable(): boolean {
        return this.isAvailable;
    }

    destroy(): void {
        this.disconnect();
    }
}
