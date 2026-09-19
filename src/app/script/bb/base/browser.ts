export const IS_FIREFOX = navigator.userAgent.toLowerCase().includes('firefox');

export const EVENT_USES_HIGH_RES_TIMESTAMP = (function (): () => boolean {
    const eventUsesHighResTimeStamp: boolean = new Event('').timeStamp < 1000 * 60 * 60;
    return function (): boolean {
        return eventUsesHighResTimeStamp;
    };
})();

export const HAS_POINTER_EVENTS = !!window.PointerEvent;

export const canShareFiles = function (): boolean {
    return 'share' in navigator && 'canShare' in navigator;
};

export function printStorageQuota(): void {
    navigator.storage.estimate().then((estimate) => {
        if (estimate.quota === undefined || estimate.usage === undefined) {
            console.log('no quota info');
            return;
        }
        console.log(
            `using ${((estimate.usage / estimate.quota) * 100).toFixed(2)}% of total quota`,
        );

        console.log('usage (GB)', (estimate.usage / 1024 / 1024 / 1024).toFixed(2));
        console.log('quota (GB)', (estimate.quota / 1024 / 1024 / 1024).toFixed(2));
    });
}
