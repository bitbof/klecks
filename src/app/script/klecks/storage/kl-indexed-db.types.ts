/**
 * Versioned types for Kl_INDEXED_DB. Differentiates between reading and writing.
 * Reading needs to support old data. Writing can be cleaner.
 *
 * TIdb
 *  Version - version of database
 *      Common - types used across stores
 *      <StoreName> - types used within a store
 *          Read - what is returned on reading from that store
 *          Write - what is allowed to be written to that store
 *          <Other> - common types used by that store
 */
export type TIdb = {
    // v1 - archived
    V1: {
        Common: {
            PngBlob: Blob;
            MixMode:
                | 'source-over' // default aka normal
                | 'darken'
                | 'multiply'
                | 'color-burn'
                | 'lighten'
                | 'screen'
                | 'color-dodge'
                | 'overlay'
                | 'soft-light'
                | 'hard-light'
                | 'difference'
                | 'exclusion'
                | 'hue'
                | 'saturation'
                | 'color'
                | 'luminosity';
        };
        ProjectStore: {
            Read: {
                id: 1;
                timestamp: number; // unix timestamp when updated
                // png - added with 0.5.1
                thumbnail?: TIdb['V1']['Common']['PngBlob'];
                width: number; // int
                height: number; // int
                layers: {
                    name: string;
                    isVisible?: boolean; // added with 0.6.2
                    opacity: number; // 0 - 1
                    mixModeStr?: TIdb['V1']['Common']['MixMode'];
                    blob: TIdb['V1']['Common']['PngBlob']; // png
                }[];
            };
        };
    };
    V2: {
        Common: {
            Uuid: string;
            PngBlob: Blob;
            MixMode:
                | 'source-over' // default aka normal
                | 'darken'
                | 'multiply'
                | 'color-burn'
                | 'lighten'
                | 'screen'
                | 'color-dodge'
                | 'overlay'
                | 'soft-light'
                | 'hard-light'
                | 'difference'
                | 'exclusion'
                | 'hue'
                | 'saturation'
                | 'color'
                | 'luminosity';
        };
        ProjectStore: {
            ImageDataRef: {
                id: TIdb['V2']['Common']['Uuid']; // id of imageDataStore entry
            };
            Read: {
                id: 1;
                projectId?: TIdb['V2']['Common']['Uuid']; // may not exist pre 0.9. not tabId.
                timestamp: number; // unix timestamp when updated
                // png - added with 0.5.1
                thumbnail?:
                    | TIdb['V2']['Common']['PngBlob'] // before 0.9
                    | TIdb['V2']['ProjectStore']['ImageDataRef'];
                width: number; // int
                height: number; // int
                layers: {
                    name: string;
                    isVisible?: boolean; // added with 0.6.2
                    opacity: number; // 0 - 1
                    mixModeStr?: TIdb['V2']['Common']['MixMode'];
                    blob:
                        | TIdb['V2']['Common']['PngBlob']
                        | TIdb['V2']['ProjectStore']['ImageDataRef']; // png
                }[];
            };
            Write: {
                id: 1;
                projectId: TIdb['V2']['Common']['Uuid'];
                timestamp: number; // unix timestamp when updated
                thumbnail: TIdb['V2']['ProjectStore']['ImageDataRef'];
                width: number; // int
                height: number; // int
                layers: {
                    name: string;
                    isVisible: boolean;
                    opacity: number; // 0 - 1
                    mixModeStr: TIdb['V2']['Common']['MixMode'];
                    blob: TIdb['V2']['ProjectStore']['ImageDataRef'];
                }[];
            };
        };
        RecoveryStore: {
            LayerFill: { fill: string }; // css color string. hex, rgb, rgba, color name
            ImageDataRef: {
                id: TIdb['V2']['Common']['Uuid']; // id of imageDataStore entry
                sizeBytes: number;
            };
            Read: {
                projectId?: TIdb['V2']['Common']['Uuid']; // not the tab id. added during 0.9 beta
                width: number; // int
                height: number; // int
                // regenerated on each change. id of imageDataStore entry
                thumbnail: TIdb['V2']['Common']['Uuid'];
                timestamp: number; // unix timestamp when updated
                layers: {
                    name: string;
                    isVisible: boolean;
                    opacity: number; // 0 - 1
                    mixModeStr?: TIdb['V2']['Common']['MixMode'];
                    image: (
                        | TIdb['V2']['RecoveryStore']['ImageDataRef']
                        | TIdb['V2']['RecoveryStore']['LayerFill']
                    )[];
                }[];
                memoryEstimateBytes: number;
            };
            Write: {
                projectId: TIdb['V2']['Common']['Uuid']; // not the tab id.
                width: number; // int
                height: number; // int
                // regenerated on each change. id of imageDataStore entry
                thumbnail: TIdb['V2']['Common']['Uuid'];
                timestamp: number; // unix timestamp when updated
                layers: {
                    name: string;
                    isVisible: boolean;
                    opacity: number; // 0 - 1
                    mixModeStr: TIdb['V2']['Common']['MixMode'];
                    image: (
                        | TIdb['V2']['RecoveryStore']['ImageDataRef']
                        | TIdb['V2']['RecoveryStore']['LayerFill']
                    )[];
                }[];
                memoryEstimateBytes: number;
            };
        };
        ImageDataStore: {
            Read: ImageData | TIdb['V2']['Common']['PngBlob'];
            Write: ImageData | TIdb['V2']['Common']['PngBlob']; // allow blob for Browser Storage
        };
    };
};
