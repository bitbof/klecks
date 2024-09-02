import {BB} from '../../../bb/bb';
import {Select} from '../components/select';
import {ColorOptions} from '../components/color-options';
import {showModal} from './base/showModal';
import {LANG} from '../../../language/language';
import {IRGB, IRGBA} from '../../kl-types';
import {IKeyString, ISize2D} from '../../../bb/bb-types';
import {table} from '../components/table';
import {theme} from '../../../theme/theme';
import { KL } from '../../kl';

export async function selectStyleDialog (
    p: {
        onStyleSelect(type: string): void;
        selectedStyle : string;
    }
):  Promise<void> {
    const mainDiv = BB.el();
    const selectStyle = new KL.Select({
        optionArr: [
            ['Van Gogh', 'Van Gogh'],
            ['Rembrandt', 'Rembrandt van Rijn'],
            ['Picasso', 'Picasso'],
            ['Photo', 'Photo']
        ],
        initValue: p.selectedStyle,
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
            maxWidth: '800px',
            minWidth: '300px',
            boxSizing: 'border-box',
        },
        callback: function (result) {
            if (result === 'Cancel') {
                return;
            }
            if(result === 'Ok'){
                p.onStyleSelect(selectStyle.getValue());
            }
        },
        clickOnEnter: 'Ok',
    });
}

