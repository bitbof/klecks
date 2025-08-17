/**
 * https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
 * Might reduce deletions of indexedDB data by browser.
 *
 * "The best time to request your storage be marked as persistent is when you save critical user
 * data, and the request should ideally be **wrapped in a user gesture**."
 * from https://web.dev/articles/persistent-storage
 */
export async function requestPersistentStorage(): Promise<void> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
        await navigator.storage.persist();
    }
}
