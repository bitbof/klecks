import {BB} from '../../../bb/bb';
import {LANG} from '../../../language/language';

/**
 * fades in a little message that reminds user to save their draw
 * goes away by itself. stays a few seconds
 */
export function showSaveReminderToast(remindersShowed) {
    let inner = BB.el({
        content: LANG('save-reminder-title') + '<br>' + LANG('save-reminder-text'),
    });
    let div = BB.el({
        content: inner,
        className: "reminder-toast g-root",
        css: {
            opacity: '0',
            top: '-20px'
        }
    });

    let transitionMs = 300;
    let durationMs = 2500;

    let mix = Math.min(1, remindersShowed / 5);
    let colA = [0,0,0];
    let colB = [50,0,0];
    let col = [
        Math.round(BB.mix(colA[0], colB[0], mix)),
        Math.round(BB.mix(colA[1], colB[1], mix)),
        Math.round(BB.mix(colA[2], colB[2], mix))
    ];
    inner.style.background = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ', 0.5)';

    document.body.appendChild(div);
    setTimeout(function() {
        div.style.opacity = '1';
        div.style.top = '10px';
    }, 22);
    setTimeout(function() {
        div.style.opacity = '0';
    }, durationMs + transitionMs);
    setTimeout(function() {
        document.body.removeChild(div);
    }, durationMs + 2 * transitionMs);
}