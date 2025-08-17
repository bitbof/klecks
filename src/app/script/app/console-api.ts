import { TVector2D } from '../bb/bb-types';

export type TConsoleApi = {
    readonly draw: (path: TVector2D[]) => void;
    readonly help: () => void;
};

export function createConsoleApi(p: { onDraw: (path: TVector2D[]) => void }): TConsoleApi {
    const output = [
        'Draw via the console! Learn more: %cKL.help()',
        'background: #000; color: #0f0;',
    ];
    'info' in (console as any) ? console.info(...output) : console.log(...output);

    return Object.freeze({
        draw: (path: TVector2D[]): void => {
            p.onDraw(path);
        },
        help: (): void => {
            console.log(`KL.draw({x: number; y: number}[]) // draw a line
KL.help() // print help
`);
        },
    });
}
