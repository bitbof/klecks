import { BB } from '../../../bb/bb';

export function table(
    data: (HTMLElement | string)[][],
    cellProps?: Record<string, { rowspan: number }>, // {'0.2': {...}} -> row 1, col 3
): HTMLElement {
    const result = BB.el({
        tagName: 'table',
        className: 'kl-table',
    });
    data.forEach((row, rowIndex) => {
        const rowEl = BB.el({
            tagName: 'tr',
        });
        rowEl.append(
            ...row.map((el, colIndex) => {
                const cellEl = BB.el({
                    tagName: 'td',
                    content: el,
                });

                const key = rowIndex + '.' + colIndex;
                if (cellProps !== undefined && key in cellProps) {
                    cellEl.rowSpan = cellProps[key].rowspan;
                }

                return cellEl;
            }),
        );
        result.append(rowEl);
    });
    return result;
}
