// generates app/languages/...
const fs = require('fs');
const JSON5 = require('json5');
const beautify = require('js-beautify').js;
const path = require('path');

const JSON_INDENT_SIZE = 2;

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
function addNewLanguage(base) {
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

function syncLanguages() {}

/**
 *
 * @param {KLBase} baseEn
 * @param {KLTranslation[]}translations
 */
function buildLanguages(baseEn, translations) {
    /**
     * @type {{name:string,"name-english":string,"iso-639-1":string}[]}
     */
    const languages = JSON.parse(
        fs.readFileSync('./src/languages/languages.json', { encoding: 'UTF-8' }),
    );

    const keys = Object.keys(baseEn);
    keys.forEach((item) => {
        if (typeof baseEn[item] !== 'string') {
            baseEn[item] = baseEn[item].value;
        }
    });

    if (!fs.existsSync('./src/app/languages')) {
        fs.mkdirSync('./src/app/languages/');
    }

    // base language
    fs.writeFileSync('./src/app/languages/en.json', JSON.stringify(baseEn));
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

export const english = dataEn;
export const languages: {code: string; name: string}[] = [
    {
        code: 'en',
        name: 'English',
    },
${langArray.join(',\n')},
];
export const loadLanguage = async (code: string): Promise<Record<TTranslationCode, string>> => {
    if (code === 'en') {
        return english;
${loadLanguage}    }
    throw new Error('unknown language code');
};

export type TTranslationCode = `;

        keys.forEach((item, index) => {
            if (index > 0) {
                tsStr += '    ';
            }
            tsStr += `'${item}'`;
            if (index < keys.length - 1) {
                tsStr += ' |';
            } else {
                tsStr += ';';
            }
            tsStr += ` // ${baseEn[item].replace('\n', '')}\n`;
        });
        fs.writeFileSync('./src/app/languages/languages.ts', tsStr);
    }

    // translations
    translations.forEach((translation) => {
        const json = {};
        const keys = Object.keys(translation.data);
        const baseKeys = Object.keys(baseEn);
        baseKeys.forEach((key) => {
            if (!keys.includes(key)) {
                console.log(`${translation.code}: Key "${key}" not in "${translation.code}".`);
            }
        });
        keys.forEach((key) => {
            const item = translation.data[key];
            if (
                !(key in baseEn) ||
                item.original !== baseEn[key] ||
                item.value === '' ||
                item.value === undefined ||
                item.value === null
            ) {
                if (!(key in baseEn)) {
                    console.log(`${translation.code}: Key "${key}" not in base.`);
                } else if (item.original !== baseEn[key]) {
                    console.log(
                        `${translation.code}: Original not matching base for key "${key}".`,
                    );
                } else if (item.value === '' || item.value === undefined || item.value === null) {
                    console.log(`${translation.code}: Value empty for key "${key}".`);
                }
                return;
            }
            /*if (typeof item.value === 'string' && item.value.length > item.original.length + 10) {
                const d = item.value.length - item.original.length;
                console.log(`${translation.code}: "${key}"'s value longer than original by ${d} characters.`);
            }*/
            json[key] = item.value;
        });
        fs.writeFileSync(`./src/app/languages/${translation.code}.json`, JSON.stringify(json));
    });
}

/**
 * @param {string} code
 * @returns {void}
 */
function cmdAdd(code) {
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
    fs.writeFileSync(path, beautify(JSON5.stringify(lang), { indent_size: JSON_INDENT_SIZE }));
    console.log('Created: ' + path);
}

/**
 * @returns {void}
 */
function cmdSync() {
    console.log('not implemented');
}

/**
 * @return {string[]}
 */
function getCodes() {
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
function cmdBuild() {
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
    );
}

// --- exports ---
exports.addNewLanguage = addNewLanguage;
exports.syncLanguages = syncLanguages;
exports.buildLanguages = buildLanguages;
exports.cmdAdd = cmdAdd;
exports.cmdSync = cmdSync;
exports.getCodes = getCodes;
exports.cmdBuild = cmdBuild;
exports.JSON_INDENT_SIZE = JSON_INDENT_SIZE;

// --- cli ---
if (process.argv[1] === __filename) {
    if (process.argv[2] === 'add') {
        cmdAdd(process.argv[3]);
    } else if (process.argv[2] === 'sync') {
        cmdSync();
    } else if (process.argv[2] === 'build') {
        cmdBuild();
    } else if (!process.argv[2]) {
        console.log('add argument "add <code>", "sync", or "build".');
    } else {
        console.log('Unknown argument. Use "add <code>", "sync", or "build".');
    }
}
