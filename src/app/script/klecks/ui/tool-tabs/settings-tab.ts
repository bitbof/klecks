import {BB} from '../../../bb/bb';
import {LANG, languageStrings, LS_LANGUAGE_KEY} from '../../../language/language';
import {KL} from '../../kl';
import {languages} from '../../../../languages/languages';
import {Popup} from '../modals/popup';
// @ts-ignore
import bitbofLogoImg from 'url:~/src/app/img/bitbof-logo.svg';
// @ts-ignore
import klecksLogoImg from 'url:~/src/app/img/klecks-logo.png';
// @ts-ignore
import uiSwapImg from 'url:~/src/app/img/ui/ui-swap-lr.svg';
import {LocalStorage} from '../../../bb/base/local-storage';

export class SettingsTab {

    private el: HTMLElement;

    // --- public ---
    constructor (
        onLeftRight: () => void,
        customAbout?: HTMLElement,
    ) {




        // ---- language ----
        const language = languageStrings.getLanguage();

        this.el = BB.el({
            content: `
${LANG('settings-language')}: ${language.name} (${language.code})
            `,
            css: {
                margin: '10px',
            }
        });

        const preferredLanguageRow = BB.el({
            content: LANG('settings-preferred-language') + ':<br>',
            css: {
                marginTop: '10px',
            }
        });
        const options: [string, string][] = [
            ['auto', LANG('auto')] as [string, string]
        ].concat(
            languages.map(item => {
                return [item.code, item.name + ` (${item.code})`];
            })
        );
        const languageSelect = new KL.Select({
            initValue: LocalStorage.getItem(LS_LANGUAGE_KEY) ? LocalStorage.getItem(LS_LANGUAGE_KEY) : 'auto',
            optionArr: options,
            onChange: (val) => {
                if (val === 'auto') {
                    LocalStorage.removeItem(LS_LANGUAGE_KEY);
                } else {
                    LocalStorage.setItem(LS_LANGUAGE_KEY, val);
                }
                languageHint.style.display = 'block';
            },
        });
        const languageHint = BB.el({
            content: LANG('settings-language-reload'),
            css: {
                display: 'none',
                marginTop: '5px',
            }
        });

        preferredLanguageRow.append(
            languageSelect.getElement(),
            languageHint,
        );

        this.el.append(preferredLanguageRow);

        // ---- flip ui ----
        BB.el({
            tagName: 'button',
            parent: this.el,
            content: '<img height="20" width="18" src="' + uiSwapImg + '" alt="icon" style="margin-right: 5px"/>' + LANG('switch-ui-left-right'),
            onClick: () => onLeftRight(),
            css: {
                marginTop: '20px',
            },
            custom: {
                tabIndex: '-1',
            }
        });


        // ---- about ----
        this.el.append(BB.el({className: 'gridHr', css: {margin: '10px 0'}}));

        function makeLicenses() {
            return BB.el({
                tagName: 'a',
                content: LANG('licenses'),
                onClick: () => {
                    import('./licenses').then(result => {
                        new Popup({
                            title: BB.el({
                                content: LANG('licenses'),
                            }),
                            content: BB.el({
                                content: BB.el({
                                    content: result.licenses.replace(/\n/g, '<br>'),
                                    css: {
                                        padding: '20px',
                                    }
                                }),
                                css: {
                                    height: '100%',
                                    overflowY: 'scroll',
                                }
                            }),
                            width: 800,
                            isMaxHeight: true,
                        });
                    });
                },
            });
        }

        if (customAbout) {
            this.el.append(customAbout);
            if (!customAbout.innerHTML) {
                const minimalAbout = BB.el({
                    parent: customAbout,
                    css: {
                       textAlign: 'center',
                   }
                });
                minimalAbout.append(
                    BB.el({
                        content: `<img alt="icon" height="20" style="vertical-align:middle" src="${bitbofLogoImg}"> <a href="https://bitbof.com" target="_blank" tabIndex="-1">bitbof</a> © 2022<br>`,
                    }),
                    makeLicenses(),
                );
            }
        } else {
            const versionEl = BB.el({
                parent: this.el,
                css: {
                    textAlign: 'center',
                },
                content: `
<img alt="Klecks" height="25" src="${klecksLogoImg}"><br>
<img alt="icon" height="20" style="vertical-align:middle" src="${bitbofLogoImg}"> <a href="https://bitbof.com" target="_blank" tabIndex="-1">bitbof</a> © 2022<br>`
            });

            versionEl.append(
                makeLicenses(),
                document.createTextNode(' | '),
                BB.el({
                    tagName: 'a',
                    content: LANG('donate'),
                    custom: {
                        href: 'https://kleki.com/donate/',
                        target: '_blank',
                    }
                }),
                document.createTextNode(' | '),
                BB.el({
                    tagName: 'a',
                    content: LANG('source-code'),
                    custom: {
                        href: 'https://klecks.org',
                        target: '_blank',
                    }
                }),
            );


        }

        window.addEventListener('storage', (e) => {
            if (e.key !== LS_LANGUAGE_KEY) {
                return;
            }
            languageSelect.setValue(
                LocalStorage.getItem(LS_LANGUAGE_KEY) ? LocalStorage.getItem(LS_LANGUAGE_KEY) : 'auto'
            );
        });

    }

    getElement (): HTMLElement {
        return this.el;
    }

}