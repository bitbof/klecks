<p style="text-align:center">
<img src="https://bitbof.com/stuff/2022-01-klecks/klecks-github.png" alt="Klecks"><br>
</p>

Klecks (German for "splash of color", pronounced "clex") is the official open-source release of the community-funded online painting app [Kleki](https://kleki.com).
Klecks and Kleki are by developer/artist [bitbof](https://bitbof.com). Klecks offers the same features as Kleki but might diverge slightly in the future.

Klecks was originally written in JavaScript and made the switch to TypeScript in December 2021. It uses Parcel as a bundler.
[Glfx.js](https://github.com/evanw/glfx.js) is used for the filters. [Ag-psd](https://github.com/Agamnentzar/ag-psd) is used for PSD import/export.

Klecks can either run in standalone mode (e.g. on [kleki.com](https://kleki.com)), or as an embed (e.g. on [2draw.net](https://2draw.net)). The embed can be included on an existing page, and used for something like a drawing community where people draw and revise their works with Klecks, which are then uploaded. Using it inside of an iframe is not recommended due to various browser bugs.

For a demo and list of features visit [kleki.com/home](https://kleki.com/home/). For future plans check here: [kleki.com/about](https://kleki.com/about/).

# Commands
- initialize via `npm install` (requires node and npm to be installed already)
- `npm run start` - dev server (to run it locally)
- `npm run build` - build standalone into `/dist/`
- `npm run build:embed` - build of embed into `/dist/`

# Embed
Example usage of the embed can be found under: `/examples/embed/`

# Selfhost
You can easily run your own instance using docker

```sh
git clone https://github.com/bitbof/klecks.git
docker-compose build
docker-compose up
```

http://localhost:5050

# Contribute
Klecks and Kleki are community funded. [Donate today](https://kleki.com/donate/)

# License

bitbof © 2022 - Released under the MIT License. Icons by bitbof are public domain (excluding the Klecks logo).

If you wish to say you're using "Kleki" and use its branding you must acquire a license from bitbof. You are free to say you're using "Klecks".
