/**
 * by bitbof (bitbof.com)
 */

import './app/style/embed.scss';
import {EmbedWrapper} from './app/script/embed/bootstrap/embed-wrapper';
import {initEmbedStyle} from './app/script/embed/bootstrap/init-embed-style';

// Important to keep the initial bundle small so there can be a loading screen

initEmbedStyle();
window['Klecks'] = EmbedWrapper;
