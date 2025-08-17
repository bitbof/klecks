import { LANG } from '../../../language/language';

export function timestampToAge(timestamp: number): string {
    let age = new Date().getTime() - timestamp;
    let ageStr;
    age = Math.floor(age / 1000 / 60);
    ageStr = LANG('file-storage-min-ago').replace('{x}', '' + age);
    if (age > 60) {
        age = Math.floor(age / 60);
        ageStr = LANG('file-storage-hours-ago').replace('{x}', '' + age);
        if (age > 24) {
            age = Math.floor(age / 24);
            ageStr = LANG('file-storage-days-ago').replace('{x}', '' + age);
            if (age > 31) {
                ageStr = LANG('file-storage-month-ago');
            }
        }
    }
    return ageStr;
}
