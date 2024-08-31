import { MultiPolygon } from 'polygon-clipping';
import { IRect } from '../bb-types';

export function multiPolygonFromRect(rect: IRect): MultiPolygon {
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
