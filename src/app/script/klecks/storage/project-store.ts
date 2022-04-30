import {IKlProject, IKlStorageProject} from '../kl.types';
import {ProjectConverter} from './project-converter';
import {clear, getKlProjectObj, storeKlProjectObj} from './indexed-db';
import {LocalStorage} from '../../bb/base/local-storage';


export interface IProjectStoreListener {
    onUpdate: (timestamp?: number, thumbnail?: HTMLImageElement | HTMLCanvasElement) => void,
}

function makeAsync(func): Promise<any> {
    return new Promise((resolve, reject) => {
        func(resolve, reject);
    });
}

/**
 * simplified interface for storing projects into browser storage
 */
export class ProjectStore {

    private listeners: IProjectStoreListener[] = [];
    private accessHasFailed: boolean = false;

    async lowLevelStore (project: IKlStorageProject): Promise<any> {
        await new Promise((resolve, reject) => {
            storeKlProjectObj(project, resolve, reject);
        });
    }

    async lowLevelRead (): Promise<IKlStorageProject> {
        return await makeAsync(getKlProjectObj) as IKlStorageProject;
    }

    async lowLevelClear (): Promise<any> {
        await makeAsync(clear);
    }



    private emit(timestamp?: number, thumbnail?: HTMLImageElement | HTMLCanvasElement) {
        this.listeners.forEach(item => {
            item.onUpdate(timestamp, thumbnail);
        });
    }

    private updateTimestamp() {
        LocalStorage.setItem('indexedDbUpdatedAt', '' + new Date().getTime());
    }

    // --- public ---

    constructor () {
        window.addEventListener('storage', (e) => {
            if (e.key !== 'indexedDbUpdatedAt' || this.listeners.length === 0) {
                return;
            }
            try {
                ( async () => {
                    const readResult = await this.read();
                    if (readResult) {
                        this.emit(readResult.timestamp, readResult.thumbnail);
                    } else {
                        this.emit();
                    }
                })();
            } catch (e) {
                if (e.message.indexOf('db-error') === 0) {
                    this.accessHasFailed = true;
                }
            }

        });
    }

    async read(): Promise<{
        project: IKlProject,
        timestamp: number,
        thumbnail: HTMLImageElement | HTMLCanvasElement
    } | null> {
        let storageProject;
        try {
            storageProject = await this.lowLevelRead();
        } catch (e) {
            this.accessHasFailed = true;
            throw new Error('db-error: ' + e);
        }
        if (!storageProject) {
            return null;
        }
        let result;
        try {
            result = await ProjectConverter.readStorageProject(storageProject);
        } catch (e) {
            throw new Error('format-error: ' + e);
        }
        return result;
    }

    async store(project: IKlProject): Promise<void> {
        try {
            const storageProject = ProjectConverter.createStorageProject(project);
            await this.lowLevelStore(storageProject);
        } catch (e) {
            this.accessHasFailed = true;
            throw new Error('db-error: ' + e);
        }
        {
            // immediately test if it can be read
            const storageProject = await this.lowLevelRead();
            let readResult = null;
            try {
                readResult = await ProjectConverter.readStorageProject(storageProject);
            } catch (e) {
                await this.lowLevelClear();
                this.updateTimestamp();
                setTimeout(() => this.emit(), 0);
                throw new Error('format-error: ' + e);
            }
            this.updateTimestamp();
            setTimeout(() => this.emit(readResult.timestamp, readResult.thumbnail), 0);
        }
    }

    async clear(): Promise<void> {
        await this.lowLevelClear();
        this.updateTimestamp();
        setTimeout(() => this.emit(), 0);
    }

    subscribe(listener: IProjectStoreListener) {
        if (this.listeners.includes(listener)) {
            return;
        }
        this.listeners.push(listener);
    }

    unsubscribe(listener: IProjectStoreListener) {
        for (let i = 0; i < this.listeners.length; i++) {
            if (listener === this.listeners[i]) {
                this.listeners.splice(i, 1);
                return;
            }
        }
    }

    isBroken() {
        return this.accessHasFailed;
    }

}