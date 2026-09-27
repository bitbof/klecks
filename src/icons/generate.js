import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const OUTPUT_DIRECTORY = './src/app/icons';
const OUTPUT_TS_FILE = `${OUTPUT_DIRECTORY}/icons.ts`;
const OUTPUT_SCSS_FILE = `${OUTPUT_DIRECTORY}/icons.scss`;

/**
 * Generates a TypeScript module containing the SVG source from each directory.
 * Icon names are derived from filenames, without the .svg extension.
 *
 * @param {string[]} sourceDirectories
 */
export function buildIcons(sourceDirectories) {
    const iconEntries = [];
    const usedNames = new Set();

    sourceDirectories.forEach((sourceDirectory) => {
        fs.readdirSync(sourceDirectory, { withFileTypes: true })
            .filter((entry) => entry.isFile() && path.extname(entry.name) === '.svg')
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((entry) => {
                const name = path.basename(entry.name, '.svg');
                if (usedNames.has(name)) {
                    throw new Error(`Duplicate icon name: "${name}"`);
                }
                usedNames.add(name);
                const svg = fs.readFileSync(path.join(sourceDirectory, entry.name), {
                    encoding: 'utf-8',
                });
                const root = svg.match(/<svg\b[\s\S]*?>/i)?.[0];
                if (!root || !/\sviewBox\s*=/i.test(root)) {
                    throw new Error(`Icon must have a viewBox: "${entry.name}"`);
                }
                if (/\s(?:width|height)\s*=/i.test(root)) {
                    throw new Error(`Icon root cannot have width or height: "${entry.name}"`);
                }
                iconEntries.push([name, svg]);
            });
    });

    iconEntries.sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
    const lines = iconEntries.map(
        ([name, svg]) => `    ${JSON.stringify(name)}: ${JSON.stringify(svg)},`,
    );
    const tsOutput = `/* eslint-disable quotes */
// generated from ${sourceDirectories.join(' and ')}. "npm run icon:build" to update

export const icons = {
${lines.join('\n')}
} as const;

export type IconName = keyof typeof icons;
`;
    const scssLines = iconEntries.map(([name]) => `    ${JSON.stringify(name)}: --icon-${name},`);
    const scssOutput = `// generated from ${sourceDirectories.join(
        ' and ',
    )}. "npm run icon:build" to update

@use 'sass:map';

$icons: (
${scssLines.join('\n')}
);

@function icon($name) {
    @if not map.has-key($icons, $name) {
        @error 'Unknown icon: #{inspect($name)}';
    }
    @return var(#{map.get($icons, $name)});
}
`;

    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
    fs.writeFileSync(OUTPUT_TS_FILE, tsOutput);
    fs.writeFileSync(OUTPUT_SCSS_FILE, scssOutput);
    console.log(
        `\x1b[32m\u2714 Generated ${iconEntries.length} icons in "${OUTPUT_DIRECTORY}"\x1b[0m`,
    );
}

const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
    buildIcons(['src/icons']);
}
