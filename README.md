<p style="text-align:center">
<img src="https://bitbof.com/stuff/2022-01-klecks/2022-03-klecks-github.png" alt="Klecks"><br>
</p>

Klecks (German for "splash of color", pronounced "clex") is the official open-source release of the community-funded online painting app [Kleki](https://kleki.com).
Klecks and Kleki are by developer/artist [bitbof](https://bitbof.com). Klecks offers the same features as Kleki but might diverge slightly in the future.

Klecks was originally written in JavaScript and made the switch to TypeScript in December 2021. It uses Parcel as a bundler.
[Glfx.js](https://github.com/evanw/glfx.js) is used for the filters. [Ag-psd](https://github.com/Agamnentzar/ag-psd) is used for PSD import/export.

Klecks can either run in standalone mode (e.g. on [kleki.com](https://kleki.com)), or as an embed (e.g. on [2draw.net](https://2draw.net)). The embed can be included on an existing page, and used for something like a drawing community where people draw and revise their works with Klecks, which are then uploaded. Using it inside of an iframe is not recommended due to various browser bugs.

For a demo and list of features visit [kleki.com/home](https://kleki.com/home/). For future plans check here: [kleki.com/about](https://kleki.com/about/).

# Commands
- initialize via `npm install` (requires node and npm to be installed already)
- `npm run lang:build` - generate language files necessary to run Klecks
- `npm run start` - dev server (to run it locally)
- `npm run build` - build standalone into `/dist/`
- `npm run build:embed` - build of embed into `/dist/`
- `npm run build:help` - build help page (when clicking the questionmark) into `/dist/`

# Embed
Example usage of the embed can be found under: `/examples/embed/`

# Docker
To run Klecks (standalone) within a Docker container, run the following commands in project root:

`docker-compose build`

`docker-compose up -d`

It is then accessible through: http://localhost:5050


# Translations
Are you a native speaker or have advanced skills in a language with no translation yet?
Any contribution by you is highly encouraged and appreciated! These are the currently available languages:
- English
- French
- German
- Japanese
- Chinese (simplified)
- Chinese (traditional)

### Where are translation files?
Translations are located in `src/languages` where each translation is its own JSON5 file, e.g. `de.json5` for German.
Within such a file everything except `value` is to be kept in sync with `_base-en.json5`.

### Structure of a translation file
```json5
{
  // key by which this text is referenced in code
  stabilizer: {
    
    // A hint, further explaining the text
    hint: 'Common feature in drawing software to make lines smoother',
    
    // Original text (English)
    original: 'Stabilizer',
    
    // Translated text
    value: '抖动修正'
  },
  // ...
}
```

### Creating/editing a translation
To **create a new translation** run `npm run lang:add <code>`, which creates `src/languages/<code>.json5`. You find all
(ISO 639-1) language codes in `src/languages/languages.json`. The generated file will already include everything except `value`.
To **edit an existing translation**, simply edit one of the files in `src/languages`. If a language file is out of sync with
`src/languages/_base-en.json5` (English), whatever key is out of sync will be ignored and fall back on English. English is the
source of truth. A translation cannot add new keys without them also being present in `_base-en.json5`.

To **see your changes** in Klecks, run `npm run lang:build`. It needs to be run whenever changes to `src/languages` are
made or it won't be up-to-date. Then build or start Klecks.

A translation should try not to cause additional line-breaks in the UI if possible. Test to make sure translations
fit the context of the application. Note, some texts are only visible in the standalone-version and vice versa with
the embed-version.

### List of commands
- `npm run lang:add <code>` - creates new language file `src/languages/<code>.json5`.
  - See (ISO 639-1) language codes in `src/languages/languages.json`
- `npm run lang:sync <code>` - synchronizes with base file. (TODO)
- `npm run lang:build` - generates JSON & TS files in `src/app/languages`
  - Problems are printed to the command line output

# Contribute
Klecks and Kleki are community funded. [Donate today](https://kleki.com/donate/)

# License

bitbof © 2024 - Released under the MIT License. Icons by bitbof are public domain (excluding the Klecks logo, bitbof logo).

If you wish to say you're using "Kleki" and use its branding you must acquire a license from bitbof. You are free to say you're using "Klecks".
