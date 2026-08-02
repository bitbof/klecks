/**
 * Versioned types for Kl_INDEXED_DB. Differentiates between reading and writing.
 * Reading needs to support old data. Writing can be cleaner.
 *
 * TIdb
 *  Version - version of database
 *      Common - types used across stores
 *      <StoreName> - types used within a store
 *          Key - key type of entries
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
            Key: number;
            Read: {
                id: 1;
                // unix timestamp when updated
                timestamp: number;
                // png - added with 0.5.1
                thumbnail?: TIdb['V1']['Common']['PngBlob'];
                // int
                width: number;
                // int
                height: number;
                layers: {
                    name: string;
                    // added with 0.6.2
                    isVisible?: boolean;
                    // 0 - 1
                    opacity: number;
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
            Key: number;
            ImageDataRef: {
                // id of imageDataStore entry
                id: TIdb['V2']['Common']['Uuid'];
            };
            Read: {
                id: 1;
                // may not exist pre 0.9. not tabId.
                projectId?: TIdb['V2']['Common']['Uuid'];
                // unix timestamp when updated
                timestamp: number;
                // added with 0.5.1
                thumbnail?:
                    | TIdb['V2']['Common']['PngBlob'] // <- before 0.9
                    | TIdb['V2']['ProjectStore']['ImageDataRef'];
                // int
                width: number;
                // int
                height: number;
                layers: {
                    name: string;
                    // added with 0.6.2
                    isVisible?: boolean;
                    // 0 - 1
                    opacity: number;
                    mixModeStr?: TIdb['V2']['Common']['MixMode'];
                    blob:
                        | TIdb['V2']['Common']['PngBlob']
                        | TIdb['V2']['ProjectStore']['ImageDataRef'];
                }[];
            };
            Write: {
                id: 1;
                projectId: TIdb['V2']['Common']['Uuid'];
                // unix timestamp when updated
                timestamp: number;
                thumbnail: TIdb['V2']['ProjectStore']['ImageDataRef'];
                // int
                width: number;
                // int
                height: number;
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
            Key: string;
            LayerFill: {
                // css color string. hex, rgb, rgba, color name
                fill: string;
            };
            ImageDataRef: {
                // id of imageDataStore entry
                id: TIdb['V2']['Common']['Uuid'];
                sizeBytes: number;
            };
            Read: {
                // not the tab id. added during 0.9 beta
                projectId?: TIdb['V2']['Common']['Uuid'];
                // int
                width: number;
                // int
                height: number;
                // regenerated on each change. id of imageDataStore entry
                thumbnail: TIdb['V2']['Common']['Uuid'];
                // unix timestamp when updated
                timestamp: number;
                layers: {
                    name: string;
                    isVisible: boolean;
                    opacity: number; // 0 - 1
                    mixModeStr?: TIdb['V2']['Common']['MixMode'];
                    // Tiles can have the wrong size (always HISTORY_TILE_SIZE). Was only fixed with 0.10.2.
                    image: (
                        | TIdb['V2']['RecoveryStore']['ImageDataRef']
                        | TIdb['V2']['RecoveryStore']['LayerFill']
                    )[];
                }[];
                memoryEstimateBytes: number;
            };
            Write: {
                // not the tab id.
                projectId: TIdb['V2']['Common']['Uuid'];
                // int
                width: number;
                // int
                height: number;
                // regenerated on each change. id of imageDataStore entry
                thumbnail: TIdb['V2']['Common']['Uuid'];
                // unix timestamp when updated
                timestamp: number;
                layers: {
                    name: string;
                    isVisible: boolean;
                    // 0 - 1
                    opacity: number;
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
            Key: string;
            Read: ImageData | TIdb['V2']['Common']['PngBlob'];
            // allow blob for Browser Storage (ProjectStore)
            Write: ImageData | TIdb['V2']['Common']['PngBlob'];
        };
    };
};
