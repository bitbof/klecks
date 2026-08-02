import { BB } from '../../../bb/bb';
import { getImageDataSafely } from '../../../bb/base/canvas';
import { getTileSize } from '../image-data-tile';
import { HISTORY_TILE_SIZE } from '../kl-history';

export function getTileFromCanvas(canvas: HTMLCanvasElement, col: number, row: number): ImageData {
    const ctx = BB.ctx(canvas);
    const { width, height } = getTileSize(col, row, canvas);

    /*
        NS_ERROR_FAILURE & NS_ERROR_OUT_OF_MEMORY
        Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0
        Probably out of memory judging by https://searchfox.org/firefox-main/source/dom/canvas/CanvasRenderingContext2D.cpp
        I am only able to force NS_ERROR_FAILURE with 83GB worth of canvas elements (32gb ram).
        Maybe a memory leak?
     */
    /*
        Uncaught SecurityError: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': The canvas has been tainted by cross-origin data.
        Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
        -> no idea how this was achieved. Tried importing svg with cross-origin content. Did not result in that exception
     */
    // Exception: InvalidStateError: The object is in an invalid state.
    return getImageDataSafely(ctx, col * HISTORY_TILE_SIZE, row * HISTORY_TILE_SIZE, width, height);
}
