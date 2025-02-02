import { TPointerType } from '../../../bb/input/event.types';

export const DEFAULT_DOUBLE_TAP_POINTER_TYPES: TPointerType[] = ['touch'];

// triggers for switching into temp tool
export const TEMP_TRIGGERS_KEYS = ['space', 'alt', 'r', 'z'] as const;
export const TEMP_TRIGGERS = ['mouse-middle', 'mouse-right', ...TEMP_TRIGGERS_KEYS] as const;

export const EASEL_MIN_SCALE = 1 / 16;
export const EASEL_MAX_SCALE = Math.pow(2, 7);
