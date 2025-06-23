import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { Style } from '../../kl-types';
import { ImageRadioList } from './image-radio-list';

export type TStyleSelectionUiParams = {
    styleOptions: Style[];
    selectedStyle: Style;
    onStyleSelect: (style: Style) => void;
    backendUrl: string;
};

export class StyleSelectionUi {
    private readonly rootEl: HTMLElement;
    private imageRadioList: ImageRadioList<string> | undefined;
    private onStyleSelectCallback: (style: Style) => void;
    private currentStyleOptions: Style[] = [];
    private backendUrl: string;

    constructor(params: TStyleSelectionUiParams) {
        this.rootEl = BB.el({
            className: 'style-selection-grid-wrapper' // For styling
        });
        this.onStyleSelectCallback = params.onStyleSelect;
        this.currentStyleOptions = params.styleOptions;
        this.backendUrl = params.backendUrl;

        this.updateStyleSelection(params.styleOptions, params.selectedStyle);
    }

    public getElement(): HTMLElement {
        return this.rootEl;
    }

    public updateStyleSelection(styleOptions: Style[], selectedStyle: Style | undefined): void {
        this.currentStyleOptions = styleOptions;

        // Clear previous content
        if (this.imageRadioList) {
            this.imageRadioList.destroy();
            this.imageRadioList = undefined;
        }

        if (styleOptions && styleOptions.length > 0 && selectedStyle) {
            const titleEl = BB.el({
                content: `${LANG('select-style-title')}:`,
                css: {
                    display: 'block',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    paddingLeft: '10px'
                },
            });
            this.rootEl.append(titleEl);

            this.imageRadioList = new ImageRadioList<string>({
                optionArr: styleOptions.map(style => ({
                    id: style.name,
                    title: style.name, // Tooltip for the image
                    image: this.backendUrl + style.imageUrl,
                    darkInvert: !!style.darkInvert,
                })),
                initId: selectedStyle.name,
                onChange: (styleName) => {
                    const newSelectedStyle = this.currentStyleOptions.find(s => s.name === styleName);
                    if (newSelectedStyle && this.onStyleSelectCallback) {
                        this.onStyleSelectCallback(newSelectedStyle);
                    }
                },
            });
            this.rootEl.append(this.imageRadioList.getElement());

        } else {
        }
    }

    public destroy(): void {
        if (this.imageRadioList) {
            this.imageRadioList.destroy();
        }
    }
}
