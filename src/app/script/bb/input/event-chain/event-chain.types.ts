import { TPointerEvent } from '../event.types';

export type TChainOutFunc = (event: TPointerEvent) => void;

export type TChainElement = {
    chainIn: (event: TPointerEvent) => TPointerEvent;
    setChainOut: (f: (event: TPointerEvent) => void) => void;
};
