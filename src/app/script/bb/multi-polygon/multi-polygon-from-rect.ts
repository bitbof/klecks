import { MultiPolygon } from 'polygon-clipping';
import { TRect } from '../bb-types';

export function multiPolygonFromRect(rect: TRect): MultiPolygon {
    return [
        [
            [
                [rect.x, rect.y],
                [rect.x + rect.width, rect.y],
                [rect.x + rect.width, rect.y + rect.height],
                [rect.x, rect.y + rect.height],
                [rect.x, rect.y],
            ],
        ],
    ];
}
