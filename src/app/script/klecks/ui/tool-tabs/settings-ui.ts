import { BB } from '../../../bb/bb';
import { LANG, languageStrings, LS_LANGUAGE_KEY } from '../../../language/language';
import { KL } from '../../kl';
import { languages } from '../../../../languages/languages';
import bitbofLogoImg from '/src/app/img/bitbof-logo.svg';
import klecksLogoImg from '/src/app/img/klecks-logo.png';
import uiSwapImg from '/src/app/img/ui/ui-swap-lr.svg';
import { LocalStorage } from '../../../bb/base/local-storage';
import { theme, TTheme } from '../../../theme/theme';
import { addIsDarkListener, nullToUndefined } from '../../../bb/base/base';
import { showLicensesDialog } from '../modals/licenses-dialog/show-licenses-dialog';
import { c } from '../../../bb/base/c';
import { SaveReminder } from '../components/save-reminder';
import { showModal } from '../modals/base/showModal';

export type TSettingsUiParams = {
    onLeftRight: () => void;
    saveReminder: SaveReminder | undefined;
    customAbout?: HTMLElement;
};

export class SettingsUi {
    private readonly rootEl: HTMLElement;

    // ----------------------------------- public -----------------------------------
    constructor({ onLeftRight, saveReminder, customAbout }: TSettingsUiParams) {
        this.rootEl = BB.el({
            css: {
                margin: '10px',
            },
        });

        // ---- language ----
        const autoLanguage = languageStrings.getAutoLanguage();

        const langWrapper = BB.el({
            parent: this.rootEl,
            content: BB.el({
                content: LANG('settings-language') + ':',
                css: {
                    marginRight: '5px',
                    marginBottom: '2px',
                },
            }),
            css: {
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
            },
        });

        const options: [string, string][] = [
            ['auto', LANG('auto') + ` → ${autoLanguage.name} (${autoLanguage.code})`] as [
                string,
                string,
            ],
            ...languages.map((item) => {
                return [item.code, item.name + ` (${item.code})`] as [string, string];
            }),
        ];
        const languageSelect = new KL.Select({
            initValue: nullToUndefined(
                LocalStorage.getItem(LS_LANGUAGE_KEY)
                    ? LocalStorage.getItem(LS_LANGUAGE_KEY)
                    : 'auto',
            ),
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
        BB.css(languageSelect.getElement(), {
            flexGrow: '1',
        });
        const languageHint = BB.el({
            className: 'kl-toolspace-note',
            content: LANG('settings-language-reload'),
            css: {
                display: 'none',
                marginTop: '5px',
                flexGrow: '1',
            },
        });

        langWrapper.append(languageSelect.getElement(), languageHint);

        // ---- theme ----
        function themeToLabel(theme: TTheme): string {
            return theme === 'dark' ? '⬛ ' + LANG('theme-dark') : '⬜ ' + LANG('theme-light');
        }
        const themeSelect = new KL.Select({
            optionArr: [
                ['auto', LANG('auto') + ' → ' + themeToLabel(theme.getMediaQueryTheme())],
                ['light', themeToLabel('light')],
                ['dark', themeToLabel('dark')],
            ],
            initValue: theme.getStoredTheme() || 'auto',
            onChange: (val): void => {
                theme.setStoredTheme(val === 'auto' ? undefined : val);
            },
        });
        BB.css(themeSelect.getElement(), {
            flexGrow: '1',
        });
        addIsDarkListener(() => {
            themeSelect.updateLabel(
                'auto',
                LANG('auto') + ' → ' + themeToLabel(theme.getMediaQueryTheme()),
            );
        });
        BB.el({
            parent: this.rootEl,
            content: [
                BB.el({
                    content: LANG('settings-theme') + ':',
                    css: {
                        marginRight: '5px',
                        marginBottom: '2px',
                    },
                }),
                themeSelect.getElement(),
            ],
            css: {
                marginTop: '15px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
            },
        });

        // ---- save reminder ----
        if (saveReminder) {
            const reminderSelect = new KL.Select({
                optionArr: [
                    ['20min', LANG('x-minutes', { x: '20' })],
                    ['40min', LANG('x-minutes', { x: '40' })],
                    ['disabled', '⚠️ ' + LANG('settings-save-reminder-disabled')],
                ],
                initValue: saveReminder.getSetting(),
                onChange: (val) => {
                    if (val !== 'disabled') {
                        saveReminder.setSetting(val);
                        return;
                    }
                    const disableStr = LANG('settings-save-reminder-confirm-disable');
                    showModal({
                        target: document.body,
                        message: '⚠️' + LANG('settings-save-reminder-confirm-title'),
                        div: c('', [
                            c('.info-hint', LANG('settings-save-reminder-confirm-a')),
                            LANG('settings-save-reminder-confirm-b'),
                        ]),
                        buttons: [disableStr, 'Cancel'],
                        callback: (result) => {
                            if (result === disableStr) {
                                saveReminder.setSetting(val);
                            } else {
                                reminderSelect.setValue(saveReminder.getSetting());
                            }
                        },
                    });
                },
            });
            reminderSelect.getElement().style.flexGrow = '1';

            this.rootEl.append(
                c(',flex,items-center,gap-5,mt-15,flexWrap', [
                    LANG('settings-save-reminder-label') + ':',
                    reminderSelect.getElement(),
                ]),
            );
        }

        // ---- flip ui ----
        BB.el({
            tagName: 'button',
            parent: this.rootEl,
            content:
                '<img height="20" width="18" src="' +
                uiSwapImg +
                '" alt="icon" style="margin-right: 5px"/>' +
                LANG('switch-ui-left-right'),
            onClick: () => onLeftRight(),
            css: {
                marginTop: '15px',
            },
            custom: {
                tabIndex: '-1',
            },
        });

        // ---- about ----
        this.rootEl.append(BB.el({ className: 'grid-hr', css: { margin: '10px 0' } }));

        function makeLicenses() {
            return BB.el({
                tagName: 'a',
                content: LANG('licenses'),
                onClick: () => showLicensesDialog(),
            });
        }

        if (customAbout) {
            this.rootEl.append(customAbout);
            if (!customAbout.innerHTML) {
                const minimalAbout = BB.el({
                    parent: customAbout,
                    css: {
                        textAlign: 'center',
                    },
                });
                minimalAbout.append(
                    BB.el({
                        content: `<img alt="icon" height="20" style="vertical-align:middle" src="${bitbofLogoImg}"> <a href="https://bitbof.com" target="_blank" tabIndex="-1">bitbof</a> © 2024<br>`,
                    }),
                    makeLicenses(),
                );
            }
        } else {
            const versionEl = BB.el({
                parent: this.rootEl,
                css: {
                    textAlign: 'center',
                },
                content: `
<img alt="Klecks" class="dark-invert" height="25" src="${klecksLogoImg}"><br>
<img alt="icon" height="20" style="vertical-align:middle" src="${bitbofLogoImg}"> <a href="https://bitbof.com" target="_blank" tabIndex="-1">bitbof</a> © 2024<br>`,
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
                    },
                }),
                document.createTextNode(' | '),
                BB.el({
                    tagName: 'a',
                    content: LANG('source-code'),
                    custom: {
                        href: 'https://klecks.org',
                        target: '_blank',
                    },
                }),
            );
        }

        window.addEventListener('storage', (e) => {
            if (e.key !== LS_LANGUAGE_KEY) {
                return;
            }
            languageSelect.setValue(
                nullToUndefined(
                    LocalStorage.getItem(LS_LANGUAGE_KEY)
                        ? LocalStorage.getItem(LS_LANGUAGE_KEY)
                        : 'auto',
                ),
            );
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
