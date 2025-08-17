import { TKlProject, TKlProjectMeta, TMixMode, TRawMeta } from '../kl-types';
import { BB } from '../../bb/bb';
import { drawProject } from '../canvas/draw-project';
import { canvasToBlob } from '../../bb/base/canvas';

export type TReadStorageProjectResult = {
    project: TKlProject;
    timestamp: number;
    thumbnail: HTMLImageElement | HTMLCanvasElement;
};

/**
 * project after being read from "browser storage" via "low level" methods
 */
export type TKlStorageProjectRead = {
    id: 1;
    projectId: string;
    timestamp: number;
    thumbnail: Blob; // png
    width: number; // int
    height: number; // int
    layers: {
        name: string;
        isVisible: boolean;
        opacity: number; // 0 - 1
        mixModeStr: TMixMode;
        blob?: Blob; // png
    }[];
};
/**
 * project about to be stored into "browser storage" via "low level" methods
 */
export type TKlStorageProjectWrite = {
    id: 1;
    projectId: string;
    timestamp: number;
    thumbnail: Blob; // png
    width: number; // int
    height: number; // int
    layers: {
        name: string;
        isVisible: boolean;
        opacity: number; // 0 - 1
        mixModeStr: TMixMode;
        blob: Blob; // png
    }[];
};

export const PROJECT_STORE_THUMBNAIL_SIZE_PX = 240;

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        try {
            im.src = BB.imageBlobToUrl(blob);
        } catch (e) {
            reject('imageBlobToUrl, ' + (e instanceof Error ? e.message : ''));
            return;
        }
        im.onload = (): void => {
            URL.revokeObjectURL(im.src);
            resolve(im);
        };
        im.onabort = (): void => {
            URL.revokeObjectURL(im.src);
            reject('layer image failed loading (abort)');
        };
        // This does occur. Maybe decoder runs of memory or storage corruption.
        im.onerror = (): void => {
            URL.revokeObjectURL(im.src);
            reject('layer image failed loading (error)');
        };
    });
}

/**
 * for:
 * - preparing project to be stored in ProjectStore
 * - reading a project that came out of the ProjectStore
 */
export class ProjectConverter {
    private static createThumbnail(project: TKlProject): HTMLCanvasElement {
        const size = BB.fitInto(
            project.width,
            project.height,
            PROJECT_STORE_THUMBNAIL_SIZE_PX,
            PROJECT_STORE_THUMBNAIL_SIZE_PX,
        );
        const factor = size.width / project.width;
        return drawProject(project, factor);
    }

    static async createStorageProject(project: TKlProject): Promise<TKlStorageProjectWrite> {
        const layers: TKlStorageProjectWrite['layers'] = [];
        for (const item of project.layers) {
            let blob;
            if (item.image instanceof HTMLCanvasElement) {
                blob = await canvasToBlob(item.image as HTMLCanvasElement, 'image/png');
            } else {
                // todo image
                throw new Error('Not implemented');
            }
            layers.push({
                name: item.name,
                isVisible: item.isVisible,
                opacity: item.opacity,
                mixModeStr: item.mixModeStr ?? 'source-over',
                blob,
            });
        }

        return {
            id: 1,
            projectId: project.projectId,
            timestamp: new Date().getTime(),
            thumbnail: await canvasToBlob(ProjectConverter.createThumbnail(project), 'image/png'),
            width: project.width,
            height: project.height,
            layers,
        };
    }

    static async readStorageProject(
        storageProject: TKlStorageProjectRead,
    ): Promise<TReadStorageProjectResult> {
        if (
            !storageProject.width ||
            !storageProject.height ||
            isNaN(storageProject.width) ||
            isNaN(storageProject.height) ||
            storageProject.width < 1 ||
            storageProject.height < 1
        ) {
            throw new Error(
                'readStorageProject invalid canvas size: ' +
                    storageProject.width +
                    ', ' +
                    storageProject.height,
            );
        }
        const project: TKlProject = {
            projectId: storageProject.projectId,
            width: storageProject.width,
            height: storageProject.height,
            layers: (
                await Promise.all(
                    storageProject.layers.map((layer) => {
                        if (layer.blob) {
                            return loadImage(layer.blob).catch(
                                () => new Image(storageProject.width, storageProject.height),
                            );
                        }
                        return new Image(storageProject.width, storageProject.height);
                    }),
                )
            ).map((image, i) => {
                const storageLayer = storageProject.layers[i];
                return {
                    name: storageLayer.name,
                    isVisible: storageLayer.isVisible,
                    opacity: storageLayer.opacity,
                    mixModeStr: storageLayer.mixModeStr,
                    image,
                };
            }),
        };

        return {
            project: project,
            timestamp: storageProject.timestamp,
            thumbnail: await loadImage(storageProject.thumbnail).catch(
                () => new Image(PROJECT_STORE_THUMBNAIL_SIZE_PX, PROJECT_STORE_THUMBNAIL_SIZE_PX),
            ),
        };
    }

    static async readStorageMeta(rawMeta: TRawMeta): Promise<TKlProjectMeta> {
        return {
            projectId: rawMeta.projectId,
            timestamp: rawMeta.timestamp,
            thumbnail: rawMeta.thumbnail
                ? await loadImage(rawMeta.thumbnail).catch(
                      () =>
                          new Image(
                              PROJECT_STORE_THUMBNAIL_SIZE_PX,
                              PROJECT_STORE_THUMBNAIL_SIZE_PX,
                          ),
                  )
                : BB.canvas(10, 10),
        };
    }
}
