import {BB} from '../../../bb/bb';
import {showModal} from './base/showModal';
import {LANG} from '../../../language/language';
import { KL } from '../../kl';

export async function selectStyleDialog (
    p: {
        onStyleSelect(style: Style): void;
        selectedStyle : Style;
        styleOptions : Style[]
    }
):  Promise<void> {
    const mainDiv = BB.el();
    const selectStyles = p.styleOptions.map(x => [x.name, x.name]) as []; 
    
    const selectStyle = new KL.Select({
        optionArr: selectStyles,
        initValue: p.selectedStyle.name,
        onChange: (val : string) => {
        },
        title: LANG('file-format'),
    });
    mainDiv.append(selectStyle.getElement());
    
    showModal({
        target: document.body,
        message: `<b>${LANG('select-style-title')}</b>`,
        div: mainDiv,
        buttons: ['Ok',],
        style: {
            width: 'calc(100% - 50px)',
            maxWidth: '300px',
            minWidth: '300px',
            boxSizing: 'border-box',    
        },
        callback: function (result) {
            if (result === 'Cancel') {
                return;
            }
            if(result === 'Ok'){
                p.onStyleSelect(p.styleOptions.find(x => x.name == selectStyle.getValue()) as Style);
            }
        },
        clickOnEnter: 'Ok',
    });
}

export interface Style {
    name: string;
    positivePrompt: string;
    negativePrompt: string;
}