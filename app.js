#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var searchPkg = _interopDefault(require('pkg-dir'));
var child_process = require('child_process');
var chalk = _interopDefault(require('chalk'));
var figures = _interopDefault(require('figures'));
var ora = _interopDefault(require('ora'));
var prettyMs = _interopDefault(require('pretty-ms'));
var args = _interopDefault(require('args'));
var commandExists = _interopDefault(require('command-exists'));
var path = _interopDefault(require('path'));
var fs = _interopDefault(require('fs'));
var registryUrl = _interopDefault(require('registry-url'));
var request = _interopDefault(require('request'));

// * list of supported package manager tools
// * the first one found will be default
const tools = {
    yarn: { install: `yarn add -D`, uninstall: `yarn remove` },
    npm: { install: `npm install -D`, uninstall: `npm uninstall` },
};
// * look for the first available tool
const defaultTool = Object.keys(tools).find((tool) => commandExists.sync(tool));
if (defaultTool === undefined) {
    console.error("Couldn't find a supported package manager tool");
    console.error('Have you installed Node.js?');
    process.exit();
}
// * support for overriding default
args.option('tool', 'Which package manager tool to use', defaultTool);
const opts = args.parse(process.argv, {
    name: 'ts-typie',
    mri: {},
    mainColor: 'yellow',
    subColor: 'dim',
});
const tool = opts.tool;
const toolCommand = tools[tool];

const isTyped = (dep) => /^@types\//.test(dep);
const parsePkg = (rootDir) => {
    // * ---------------- reading package.json
    const packagePath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const { dependencies: deps = {}, devDependencies: devDeps = {} } = pkg;
    // * support `@types/node`
    const allList = ['node', ...Object.keys(deps), ...Object.keys(devDeps)];
    const typesAll = allList.filter((dep) => isTyped(dep));
    const depsAll = allList.filter((dep) => !isTyped(dep));
    // * ---------------- analyzing dependencies
    const depsAlreadyTyped = depsAll.filter((dep) => typesAll.includes(`@types/${dep}`));
    // * jest needs @types/jest somehow, don't know why yet
    // ! maybe better checking method
    const itsNotSelfed = ['jest'];
    const depsSelfTyped = depsAll
        .filter((dep) => {
        const pkgPath = path.join(rootDir, 'node_modules', dep, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const isTyped = pkg.types || pkg.typings;
            const containDts = pkg.files && pkg.files.find((e) => /\.d\.ts/.test(e));
            return isTyped || containDts;
        }
        return false;
    })
        .filter((dep) => !itsNotSelfed.includes(dep));
    // * ---------------- types result
    const d2t = (dep) => `@types/${dep}`;
    const sorter = (a, b) => (a < b ? -1 : 1);
    const missed = depsAll
        .filter((dep) => !depsSelfTyped.includes(dep))
        .filter((dep) => !depsAlreadyTyped.includes(dep))
        .map(d2t)
        .sort(sorter);
    // * installed, but deprecated
    // * e.g. https://www.npmjs.com/package/@types/chalk
    const deprecated = depsAlreadyTyped
        .filter((dep) => depsSelfTyped.includes(dep))
        .map(d2t)
        .sort(sorter);
    const unused = typesAll
        .map((dep) => dep.replace(`@types/`, ''))
        .filter((intalled) => !depsAll.find((dep) => dep === intalled))
        .map(d2t)
        .sort(sorter);
    // * ---------------- return
    return {
        deprecated,
        unused,
        missed,
    };
};

const globalRegistry = registryUrl();
// * support custom registry from global config
// `https://www.npmjs.com/@types/${dep}`
// `https://registry.npm.taobao.org/@types/${dep}`
// TODO mayby failure fallback ?
const fetchSingle = (pkg) => {
    const url = `${globalRegistry}/${pkg}`.replace('//@types', '/@types');
    return new Promise((resolve) => {
        request(url, (err, res, body) => {
            resolve([pkg, res.statusCode === 200]);
        });
    });
};
// * parallel fetching, it's faster
const fetchTypes = (deps) => Promise.all(deps.map((dep) => fetchSingle(dep))).then((allTypesResult) => {
    const founds = allTypesResult.filter(([, f]) => f).map(([dep]) => dep);
    const notFounds = allTypesResult.filter(([, f]) => !f).map(([dep]) => dep);
    return { founds, notFounds };
});

const logLists = ({ deprecated, unused, founds }) => {
    const b = (dep) => chalk.bold(dep);
    // * ---------------- log uninstall list
    deprecated.forEach((dep) => {
        console.log(chalk.red(figures.arrowLeft, `${b(dep)} is deprecated. Uninstalling...`));
    });
    unused.forEach((dep) => {
        console.log(chalk.red(figures.arrowLeft, `${b(dep)} is unused. Uninstalling...`));
    });
    // * ---------------- log install list
    if (founds.length) {
        founds.forEach((dep) => {
            console.log(chalk.green(figures.arrowRight, `Installing ${b(dep)}`));
        });
    }
    else {
        console.log(chalk.white(figures.squareSmallFilled, `Nothing needs to be install`));
    }
};

(async () => {
    const startTime = Date.now();
    // * ---------------- check if package.json exists
    const pkgDir = await searchPkg(process.cwd());
    if (pkgDir === undefined) {
        console.error('No package.json file found!');
        process.exit();
    }
    // * ---------------- static package analyzing
    const { deprecated, unused, missed } = parsePkg(pkgDir);
    // * ---------------- fetching
    const spinner = ora('Fetching...').start();
    const { founds } = await fetchTypes(missed);
    spinner.stop();
    // * ---------------- process or not
    logLists({ deprecated, unused, founds });
    const { install, uninstall } = toolCommand;
    const allUn = [...new Set([...deprecated, ...unused])].join(' ');
    if (allUn.length) {
        child_process.execSync(`${uninstall} ${allUn}`, { stdio: 'inherit' });
    }
    const allIn = founds.join(' ');
    if (allIn.length) {
        child_process.execSync(`${install} ${allIn}`, { stdio: 'inherit' });
    }
    // * ---------------- completing
    const deltaTime = prettyMs(Date.now() - startTime, { secondsDecimalDigits: 2 });
    console.log(chalk.green(figures.tick, `All types are Ok, done in ${deltaTime}`));
})();
