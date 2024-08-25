import { EmbedWrapper } from './app/script/embed/bootstrap/embed-wrapper';
/**
 * by bitbof (bitbof.com)
 */
// Important to keep the initial bundle small so there can be a loading screen

import('./app/style/embed.scss'); // loading like this gives it a hash
Object.defineProperty(window, 'Klecks', {
    value: EmbedWrapper,
});
