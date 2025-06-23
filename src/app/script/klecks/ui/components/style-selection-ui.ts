import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { Style } from '../../kl-types';
import { ImageRadioList } from './image-radio-list';

export type TStyleSelectionUiParams = {
    styleOptions: Style[];
    selectedStyle: Style;
    onStyleSelect: (style: Style) => void;
};

export class StyleSelectionUi {
    private readonly rootEl: HTMLElement;
    private imageRadioList: ImageRadioList<string> | undefined;
    private onStyleSelectCallback: (style: Style) => void;
    private currentStyleOptions: Style[] = [];

    constructor(params: TStyleSelectionUiParams) {
        this.rootEl = BB.el({
            className: 'style-selection-grid-wrapper', // For styling
            css: {
                // Add any specific styles for the wrapper itself if needed, e.g., margin
                // margin: '10px 0', // Example: if it needs space around it below brushDiv
            },
        });
        this.onStyleSelectCallback = params.onStyleSelect;
        this.currentStyleOptions = params.styleOptions;

        this.updateStyleSelection(params.styleOptions, params.selectedStyle);
    }

    public getElement(): HTMLElement {
        return this.rootEl;
    }

    public updateStyleSelection(styleOptions: Style[], selectedStyle: Style | undefined): void {
        this.currentStyleOptions = styleOptions;

        // Clear previous content
        BB.clearNode(this.rootEl);
        if (this.imageRadioList) {
            this.imageRadioList.destroy();
            this.imageRadioList = undefined;
        }

        if (styleOptions && styleOptions.length > 0 && selectedStyle) {
            const titleEl = BB.el({
                content: LANG('select-style-title') + ':', // TODO: Consider a more appropriate title like "Styles" or "Art Styles"
                css: {
                    display: 'block', // Make title take full width
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    // paddingLeft: '10px' // If inside a toolspace that has its own padding
                },
            });
            this.rootEl.append(titleEl);

            this.imageRadioList = new ImageRadioList<string>({
                optionArr: styleOptions.map(style => ({
                    id: style.name,
                    title: style.name, // Tooltip for the image
                    image: style.image,
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

            // Optional: Add a separator if it visually fits below the style grid and before next elements
            // const hr = BB.el({ className: 'grid-hr', css: { margin: '15px 0' } });
            // this.rootEl.append(hr);

        } else {
            // Optionally, display a message if no styles are available or failed to load
            // For now, it will just be empty if no styles.
            // BB.el({ parent: this.rootEl, content: 'No styles available.' });
        }
    }

    public destroy(): void {
        if (this.imageRadioList) {
            this.imageRadioList.destroy();
        }
        BB.clearNode(this.rootEl);
    }
}
