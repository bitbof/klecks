import { IKlStorageProject } from '../kl-types';

const indexedDbIsSupported = !!window.indexedDB;
let dbNameStr = 'Klecks';
const storageNameStr = 'ProjectStore';

export function setDbName(name: string): void {
    dbNameStr = '' + name;
}

/**
 * connects to db dbNameStr, then executes transaction on storageNameStr storage
 * with index 'id'
 *
 * @param actionFunction what to execute during transaction
 * @param successCallback on successful transaction
 * @param errorCallback on error
 */
function execIndexedDBTransaction(
    actionFunction: (storeObj: IDBObjectStore) => void,
    successCallback: () => void,
    errorCallback: (errorStr: string) => void,
): void {
    let hasFinished = false;

    function onSuccess(): void {
        if (hasFinished) {
            return;
        }
        hasFinished = true;
        successCallback();
    }

    function onError(errorStr: string): void {
        if (hasFinished) {
            return;
        }
        hasFinished = true;
        errorCallback(errorStr);
    }

    if (!indexedDbIsSupported) {
        setTimeout(function () {
            onError('no indexed db available');
        }, 0);
        return;
    }
    let requestObj: IDBOpenDBRequest;

    try {
        requestObj = window.indexedDB.open(dbNameStr, 1);
    } catch (e) {
        onError((e as { message: string }).message);
        return;
    }

    requestObj.onupgradeneeded = function (): void {
        try {
            const db: IDBDatabase = requestObj.result;
            const store = db.createObjectStore(storageNameStr, {
                keyPath: 'id',
            });
            store.createIndex('id', 'id', { unique: true });
        } catch (e) {
            onError((e as { message: string }).message);
        }
    };
    requestObj.onerror = function (): void {
        onError('indexedDB.open failed, ' + requestObj.error);
    };
    requestObj.onsuccess = function (): void {
        let databaseObj: IDBDatabase;
        let transactionObj: IDBTransaction;
        let storeObj: IDBObjectStore;

        try {
            databaseObj = requestObj.result;
            if (!databaseObj.objectStoreNames.contains(storageNameStr)) {
                //someone maybe messed with the db, or creation failed earlier
                //it's broken -> destroy
                window.indexedDB.deleteDatabase(dbNameStr);
                onError('object store ' + storageNameStr + ' missing. destroying db');
                return;
            }
            transactionObj = databaseObj.transaction(storageNameStr, 'readwrite');
            storeObj = transactionObj.objectStore(storageNameStr);
            storeObj.index('id');
        } catch (e) {
            onError((e as { message: string }).message);
            return;
        }

        databaseObj.onerror = function (): void {
            onError('database error, ' + (databaseObj as IDBDatabase & { error: string }).error);
        };

        try {
            actionFunction(storeObj);
        } catch (e) {
            onError((e as { message: string }).message);
            return;
        }

        transactionObj.oncomplete = function (): void {
            onSuccess();
            databaseObj.close();
        };
        transactionObj.onerror = function (): void {
            onError('transaction error, ' + transactionObj.error);
        };
    };
}

export function getKlProjectObj(
    successCallback: (result: undefined | IKlStorageProject) => void,
    errorCallback: (error: string) => void,
): void {
    if (indexedDbIsSupported) {
        let query: IDBRequest<undefined | IKlStorageProject>;
        execIndexedDBTransaction(
            function (storeObj) {
                query = storeObj.get(1);
            },
            function () {
                successCallback(query.result);
            },
            function (errorStr) {
                errorCallback('execIndexedDBTransaction error, ' + errorStr);
            },
        );
    } else {
        successCallback(undefined);
    }
}

/**
 * stores a project into id = 1 in database:dbNameStr > storage: storageNameStr
 */
export function storeKlProjectObj(
    storageProject: IKlStorageProject,
    successCallback: () => void,
    errorCallback: (error: string) => void,
): void {
    execIndexedDBTransaction(
        function (storeObj) {
            storeObj.put(storageProject);
        },
        function () {
            successCallback();
        },
        function (errorStr) {
            errorCallback(errorStr);
        },
    );
}

/**
 * deletes stored project, by removing id = 1 from database:dbNameStr > storage: storageNameStr
 */
export function clear(successCallback: () => void, errorCallback: (error: string) => void): void {
    execIndexedDBTransaction(
        function (storeObj) {
            storeObj.delete(1);
        },
        function () {
            successCallback();
        },
        function (error) {
            errorCallback(error);
        },
    );
}
