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
import { ImageRadioList } from '../components/image-radio-list';
import { Style } from '../../kl-types';

export type TSettingsUiParams = {
    onLeftRight: () => void;
    saveReminder: SaveReminder | undefined;
    customAbout?: HTMLElement;
    styleOptions: Style[];
    selectedStyle: Style;
    onStyleSelect: (style: Style) => void;
};

export class SettingsUi {
    private readonly rootEl: HTMLElement;
    private styleRadioList: ImageRadioList<string> | undefined;
    private styleSectionWrapper: HTMLElement | undefined;
    private onStyleSelectCallback: ((style: Style) => void) | undefined;
    private currentStyleOptions: Style[] = [];

    // ----------------------------------- public -----------------------------------
    constructor({ onLeftRight, saveReminder, customAbout, styleOptions, selectedStyle, onStyleSelect }: TSettingsUiParams) {
        this.rootEl = BB.el({
            css: {
                margin: '10px',
            },
        });
        this.onStyleSelectCallback = onStyleSelect;
        this.currentStyleOptions = styleOptions;

        // Placeholder for style section
        this.styleSectionWrapper = BB.el({
            className: 'style-selection-grid-wrapper',
        });
        this.rootEl.append(this.styleSectionWrapper);
        // Initial population, could be empty if styles not loaded yet
        this.updateStyleSelection(styleOptions, selectedStyle);


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

    public updateStyleSelection(styleOptions: Style[], selectedStyle: Style | undefined): void {
        this.currentStyleOptions = styleOptions;
        if (!this.styleSectionWrapper) {
            return;
        }
        // Clear previous style selection
        BB.clearNode(this.styleSectionWrapper);
        if (this.styleRadioList) {
            this.styleRadioList.destroy();
            this.styleRadioList = undefined;
        }

        if (styleOptions && styleOptions.length > 0 && selectedStyle) {
            const titleEl = BB.el({
                parent: this.styleSectionWrapper,
                content: LANG('select-style-title') + ':', // Using existing language key, might need a new one
                css: {
                    marginBottom: '5px',
                    fontWeight: 'bold',
                },
            });

            this.styleRadioList = new ImageRadioList<string>({
                optionArr: styleOptions.map(style => ({
                    id: style.name, // Assuming name is unique identifier
                    title: style.name,
                    image: style.image, // Assuming image is a URL
                    darkInvert: !!style.darkInvert, // Or determine based on theme/style property
                })),
                initId: selectedStyle.name,
                onChange: (styleName) => {
                    const currentSelectedStyle = this.currentStyleOptions.find(s => s.name === styleName);
                    if (currentSelectedStyle && this.onStyleSelectCallback) {
                        this.onStyleSelectCallback(currentSelectedStyle);
                    }
                },
            });
            this.styleSectionWrapper.append(titleEl, this.styleRadioList.getElement());

            // Separator
            const hr = BB.el({ className: 'grid-hr', css: { margin: '15px 0' } });
            this.styleSectionWrapper.append(hr);

            // Ensure the style section is inserted before the language section if it wasn't already.
            // This is a bit of a workaround for ordering; ideally, the layout is more structured.
            const languageSectionMarker = this.rootEl.querySelector('.kl-toolspace-note'); // A bit fragile selector
            if (languageSectionMarker && languageSectionMarker.parentElement) {
                 if(this.styleSectionWrapper.nextSibling !== languageSectionMarker.parentElement) {
                    this.rootEl.insertBefore(this.styleSectionWrapper, languageSectionMarker.parentElement);
                 }
            }


        }
    }
}
