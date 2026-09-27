// generates app/languages/...
import fs from 'fs';
import JSON5 from 'json5';
import jsBeautify from 'js-beautify';
import path from 'path';
import { fileURLToPath } from 'url';

export const JSON_INDENT_SIZE = 2;

/**
 * A translation (not base)
 * @typedef {{code: string, data: Object.<string, {hint?: string, original:string, value: string}>}} KLTranslation
 */

/**
 * Base language
 * @typedef {Object.<string, (string|{hint:string, value: string})>} KLBase
 */

/**
 * @param {KLBase} base
 * @returns {KLTranslation}
 */
export function addNewLanguage(base) {
    const lang = JSON.parse(JSON.stringify(base));
    const keys = Object.keys(lang);
    keys.forEach((item) => {
        if (typeof lang[item] === 'string') {
            lang[item] = {
                original: lang[item],
                value: '',
            };
        } else {
            lang[item] = {
                hint: lang[item].hint,
                original: lang[item].value,
                value: '',
            };
        }
    });
    return lang;
}

export function syncLanguages() {}

/**
 *
 * @param {KLBase} baseEn
 * @param {KLTranslation[]} translations
 * @param {boolean} showMissing
 */
export function buildLanguages(baseEn, translations, showMissing) {
    /**
     * @type {{name:string,"name-english":string,"iso-639-1":string}[]}
     */
    const languages = JSON.parse(
        fs.readFileSync('./src/languages/languages.json', { encoding: 'UTF-8' }),
    );

    // This is the canonical order shared by every generated language array.
    const keys = Object.keys(baseEn);
    keys.forEach((item) => {
        if (typeof baseEn[item] !== 'string') {
            baseEn[item] = baseEn[item].value;
        }
    });

    if (!fs.existsSync('./src/app/languages')) {
        fs.mkdirSync('./src/app/languages/');
    }

    const writeLanguage = (code, values) =>
        fs.writeFileSync(`./src/app/languages/${code}.json`, JSON.stringify(values));

    // base language
    writeLanguage(
        'en',
        keys.map((key) => baseEn[key]),
    );
    let langArray = [];
    let loadLanguage = '';
    translations.forEach((item) => {
        const lang = languages.find((searchItem) => {
            return searchItem['iso-639-1'] === item.code;
        });
        if (!lang) {
            throw 'unknown language code: ' + item;
        }
        langArray.push(`    {
        code: '${item.code}',
        name: '${lang.name}',
    }`);
        loadLanguage += `    } else if (code === '${item.code}') {
        return await import('./${item.code}.json');
`;
    });

    {
        let tsStr = `// generated from src/languages. "npm run lang:build" to update

import dataEn from './en.json';

export const english: readonly string[] = dataEn;
export const languages: {code: string; name: string}[] = [
    {
        code: 'en',
        name: 'English',
    },
${langArray.join(',\n')},
];
export const loadLanguage = async (code: string): Promise<readonly (string | null)[]> => {
    if (code === 'en') {
        return english;
${loadLanguage}    }
    throw new Error('unknown language code');
};

export const translationCodes = [
`;

        keys.forEach((item) => {
            tsStr += `    '${item}',`;
            tsStr += ` // ${baseEn[item].replace('\n', '')}\n`;
        });
        tsStr += `] as const;
export type TTranslationCode = (typeof translationCodes)[number];
export const translationCodeToIndex = Object.fromEntries(
    translationCodes.map((code, index) => [code, index]),
) as Record<TTranslationCode, number>;
`;
        fs.writeFileSync('./src/app/languages/languages.ts', tsStr);
    }

    // translations
    let hasMissing = false;
    translations.forEach((translation) => {
        const values = [];
        const missingMessages = [];
        keys.forEach((key) => {
            const item = translation.data[key];
            if (item === undefined) {
                missingMessages.push(
                    `${translation.code}: Key "${key}" not in "${translation.code}".`,
                );
            }
            if (
                item === undefined ||
                item.original !== baseEn[key] ||
                item.value === '' ||
                item.value === undefined ||
                item.value === null
            ) {
                if (item !== undefined && item.original !== baseEn[key]) {
                    console.log(
                        `${translation.code}: Original not matching base for key "${key}".`,
                    );
                } else if (
                    item !== undefined &&
                    (item.value === '' || item.value === undefined || item.value === null)
                ) {
                    missingMessages.push(`${translation.code}: Value empty for key "${key}".`);
                }
                values.push(undefined);
                return;
            }
            values.push(item.value);
        });
        Object.keys(translation.data).forEach((key) => {
            if (!(key in baseEn)) {
                console.log(`${translation.code}: Key "${key}" not in base.`);
            }
        });
        writeLanguage(translation.code, values);
        if (showMissing) {
            missingMessages.forEach((message) => {
                console.log(message);
            });
        } else if (missingMessages.length > 0) {
            hasMissing = true;
            console.log(
                `${translation.code}: ${missingMessages.length} keys missing their translation.`,
            );
        }
    });
    if (hasMissing) {
        console.log('Show missing translations by adding "-- --missing" to the command.');
    }
    console.log(
        `\x1b[32m\u2714 Generated/updated ${translations.length + 2} files in "src/app/languages"\x1b[0m`,
    );
}

/**
 * @param {string} code
 * @returns {void}
 */
export function cmdAdd(code) {
    if (!code) {
        console.log('error: argument missing for language code (ISO 639-1).');
        process.exit(1);
    }
    const path = `./src/languages/${code}.json5`;
    if (fs.existsSync(path)) {
        console.error(`error "${path}" exists already.`);
        process.exit(1);
    }
    const lang = addNewLanguage(
        JSON5.parse(fs.readFileSync('./src/languages/_base-en.json5', { encoding: 'utf-8' })),
        code,
    );
    fs.writeFileSync(path, jsBeautify.js(JSON5.stringify(lang), { indent_size: JSON_INDENT_SIZE }));
    console.log('Created: ' + path);
}

/**
 * @returns {void}
 */
export function cmdSync() {
    console.log('not implemented');
}

/**
 * @return {string[]}
 */
export function getCodes() {
    const codes = [];
    fs.readdirSync('./src/languages').forEach((file) => {
        if (file === '_base-en.json5') {
            return;
        }
        if (path.extname(file) === '.json5') {
            codes.push(path.parse(file).name);
        }
    });
    return codes;
}

/**
 * @returns {void}
 */
export function cmdBuild(showMissing) {
    const translations = [];
    const codes = getCodes();
    codes.forEach((code) => {
        translations.push({
            code,
            data: JSON5.parse(
                fs.readFileSync('./src/languages/' + code + '.json5', { encoding: 'utf-8' }),
            ),
        });
    });
    buildLanguages(
        JSON5.parse(fs.readFileSync('./src/languages/_base-en.json5', { encoding: 'utf-8' })),
        translations,
        showMissing,
    );
}

// --- cli ---
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    if (process.argv[2] === 'add') {
        cmdAdd(process.argv[3]);
    } else if (process.argv[2] === 'sync') {
        cmdSync();
    } else if (process.argv[2] === 'build') {
        const showMissing = process.argv.includes('--missing');
        cmdBuild(showMissing);
    } else if (!process.argv[2]) {
        console.log('add argument "add <code>", "sync", or "build".');
    } else {
        console.log('Unknown argument. Use "add <code>", "sync", or "build".');
    }
}
