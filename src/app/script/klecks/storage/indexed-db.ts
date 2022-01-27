//browser storage indexedDB


import {IKlStorageProject} from '../kl.types';

const indexedDbIsSupported = !!window.indexedDB;
let dbNameStr = 'Klecks';
const storageNameStr = 'ProjectStore';

export function setDbName(name: string) {
    dbNameStr = '' + name;
}

/**
 * connects to db dbNameStr, then executes transaction on storageNameStr storage
 * with index 'id'
 *
 * @param actionFunction function(storeObj) - what you want to execute during transaction
 * @param successCallback function() - on succesful transaction
 * @param errorCallback function(errorStr) - on error
 */
function execIndexedDBTransaction(actionFunction, successCallback, errorCallback) {

    let hasFinished = false;

    function onSuccess() {
        if (hasFinished) {
            return;
        }
        hasFinished = true;
        successCallback();
    }

    function onError(errorStr) {
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
    let requestObj;

    try {
        requestObj = window.indexedDB.open(dbNameStr, 1);
    } catch (e) {
        onError(e.message);
        return;
    }

    requestObj.onupgradeneeded = function (e) {
        try {
            let db = requestObj.result;
            let store = db.createObjectStore(storageNameStr, {keyPath: 'id'});
            store.createIndex('id', 'id', {unique: true});
        } catch (e) {
            onError(e.message);
        }
    };
    requestObj.onerror = function (e) {
        onError('indexedDB.open failed, ' + requestObj.error);
    };
    requestObj.onsuccess = function (e) {
        let databaseObj;
        let transactionObj;
        let storeObj;

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
            onError(e.message);
            return;
        }

        databaseObj.onerror = function (e) {
            onError('database error, ' + databaseObj.error);
        };

        try {
            actionFunction(storeObj);
        } catch (e) {
            onError(e.message);
            return;
        }

        transactionObj.oncomplete = function () {
            onSuccess();
            databaseObj.close();
        };
        transactionObj.onerror = function () {
            onError('transaction error, ' + transactionObj.error);
        };
    };
}

/**
 * getKlProjectObj {
 *     width: int,
 *     height: int,
 *     layers: {
 *        name: string,
 *        opacity: float (0 - 1),
 *        mixModeStr: string,
 *        image: image object                <--------- image already loaded!
 *     }[]
 * }
 *
 * @param successCallback function - called when succesfully queried. passes KlProjectObj
 * @param errorCallback - function(errorStr) - called when error during query
 */
export function getKlProjectObj(successCallback, errorCallback) {
    if (indexedDbIsSupported) {
        let query;
        execIndexedDBTransaction(function (storeObj) {
            query = storeObj.get(1);
        }, function () {
            successCallback(query.result);
        }, function (errorStr) {
            errorCallback('execIndexedDBTransaction error, ' + errorStr);
        });
    } else {
        successCallback(null);
    }
}

/**
 * stores a klProjectObj into id = 1 in database:dbNameStr > storage: storageNameStr
 *
 * KlProjectObj {
 *     width: int,
 *     height: int,
 *     layers: {
 *        name: string,
 *        opacity: float (0 - 1),
 *        mixModeStr: string,
 *        blob: blob object                 <--------- blob!
 *     }[]
 * }
 *
 * @param storageProject IKlStorageProject - project to be stored
 * @param successCallback function() - on successful transaction
 * @param errorCallback function(errorStr) - on error
 */
export function storeKlProjectObj(storageProject: IKlStorageProject, successCallback, errorCallback) {
    execIndexedDBTransaction(function (storeObj) {
        storeObj.put(storageProject);
    }, function () {
        successCallback();
    }, function (errorStr) {
        errorCallback(errorStr);
    });

}

/**
 * removes id = 1 from database:dbNameStr > storage: storageNameStr
 *
 * @param successCallback function() - on successful transaction
 * @param errorCallback function(error) - on error
 */
export function clear(successCallback, errorCallback) {
    execIndexedDBTransaction(function (storeObj) {
        storeObj.delete(1);
    }, function () {
        successCallback();
    }, function (error) {
        errorCallback(error);
    });

}
