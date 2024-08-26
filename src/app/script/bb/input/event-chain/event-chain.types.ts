import { IPointerEvent } from '../event.types';

export type TChainOutFunc = (event: IPointerEvent) => void;

export interface IChainElement {
    chainIn: (event: IPointerEvent) => IPointerEvent;
    setChainOut: (f: (event: IPointerEvent) => void) => void;
}
