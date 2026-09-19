import { TMixMode } from '../kl-types';

export function getMixModeStr(mixModeStr?: TMixMode): TMixMode {
    return mixModeStr ?? 'source-over';
}
