import { c } from '../../../../bb/base/c';
import { css as emotionCss } from '@emotion/css';
import { DynamicModal } from '../base/dynamic-modal';
import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';

export function showLicensesDialog() {
    const licensesCss = emotionCss({
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        'details > div': {
            padding: '10px',
            boxShadow: '0 0 0 1px',
            marginTop: '5px',
            fontFamily: 'monospace',
            background: '#aaa2',
            overflow: 'hidden',
        },
        summary: {
            cursor: 'pointer',
            userSelect: 'none',
        },
    });

    const libraries = c('.' + licensesCss, LANG('loading'));
    const fonts = c('.' + licensesCss, LANG('loading'));

    const content = c(',flex,flexCol,gap-10', [libraries, fonts]);

    new DynamicModal({
        title: BB.el({
            content: LANG('licenses'),
        }),
        content: BB.el({
            content,
            css: {
                height: '100%',
                overflowY: 'auto',
                padding: '10px',
                boxSizing: 'border-box',
            },
        }),
        width: 800,
        isMaxHeight: true,
        onClose: () => {
            if (window.location.hash === '#licenses') {
                history.replaceState(
                    '',
                    document.title,
                    window.location.pathname + window.location.search,
                );
            }
        },
    });

    import('./licenses').then((result) => {
        libraries.innerHTML = '';
        result.licenses.forEach((item) => {
            libraries.append(
                c('details', [c('summary', item.title), c('', item.full.replace(/\n/g, '<br>'))]),
            );
        });
    });

    import('../../../../../fonts/font-licenses').then((result) => {
        fonts.innerHTML = '';
        result.fontLicenses.forEach((item) => {
            fonts.append(
                c('details', [
                    c('summary', 'Font: ' + item.title),
                    c('', item.full.replace(/\n/g, '<br>')),
                ]),
            );
        });
    });
}
