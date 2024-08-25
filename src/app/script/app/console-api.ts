import { IVector2D } from '../bb/bb-types';

export type TConsoleApi = {
    readonly draw: (path: IVector2D[]) => void;
    readonly help: () => void;
};

export function createConsoleApi(p: { onDraw: (path: IVector2D[]) => void }): TConsoleApi {
    const output = [
        'Draw via the console! Learn more: %cKL.help()',
        'background: #000; color: #0f0;',
    ];
    'info' in (console as any) ? console.info(...output) : console.log(...output);

    return Object.freeze({
        draw: (path: IVector2D[]): void => {
            p.onDraw(path);
        },
        help: (): void => {
            console.log(`KL.draw({x: number; y: number}[]) // draw a line
KL.help() // print help
`);
        },
    });
}
