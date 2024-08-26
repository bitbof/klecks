import { IKlProject, IKlStorageProject } from '../kl-types';
import { BB } from '../../bb/bb';
import { drawProject } from '../canvas/draw-project';
import { base64ToBlob } from './base-64-to-blob';

export type TReadStorageProjectResult = {
    project: IKlProject;
    timestamp: number;
    thumbnail: HTMLImageElement | HTMLCanvasElement;
};

const thumbSize = 240;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
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
            reject('layer image failed loading');
        };
        im.onerror = (): void => {
            reject('layer image failed loading');
        };
    });
}

/**
 * for:
 * - preparing project to be stored in ProjectStore
 * - reading a project that came out of the ProjectStore
 */
export class ProjectConverter {
    private static createThumbnail(project: IKlProject): HTMLCanvasElement {
        const size = BB.fitInto(project.width, project.height, thumbSize, thumbSize);
        const factor = size.width / project.width;
        return drawProject(project, factor);
    }

    static createStorageProject(project: IKlProject): IKlStorageProject {
        return {
            id: 1,
            timestamp: new Date().getTime(),
            thumbnail: base64ToBlob(
                ProjectConverter.createThumbnail(project).toDataURL('image/png'),
            ),
            width: project.width,
            height: project.height,
            layers: project.layers.map((item) => {
                let blob;
                if (item.image instanceof HTMLCanvasElement) {
                    blob = base64ToBlob((item.image as HTMLCanvasElement).toDataURL('image/png'));
                } else {
                    // todo image
                    throw new Error('Not implemented');
                }
                return {
                    name: item.name,
                    isVisible: item.isVisible,
                    opacity: item.opacity,
                    mixModeStr: item.mixModeStr,
                    blob,
                };
            }),
        };
    }

    static async readStorageProject(
        storageProject: IKlStorageProject,
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
        const project: IKlProject = {
            width: storageProject.width,
            height: storageProject.height,
            layers: (
                await Promise.all(storageProject.layers.map((layer) => loadImage(layer.blob)))
            ).map((image, i) => {
                const storageLayer = storageProject.layers[i];
                return {
                    name: storageLayer.name,
                    isVisible: 'isVisible' in storageLayer ? storageLayer.isVisible : true, // isVisible added 2023-07
                    opacity: storageLayer.opacity,
                    mixModeStr: storageLayer.mixModeStr,
                    image,
                };
            }),
        };

        let thumbnail;
        if (storageProject.thumbnail) {
            thumbnail = await loadImage(storageProject.thumbnail);
        } else {
            thumbnail = ProjectConverter.createThumbnail(project);
        }

        return {
            project: project,
            timestamp: storageProject.timestamp,
            thumbnail: thumbnail,
        };
    }
}
