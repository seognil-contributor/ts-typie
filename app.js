#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const args_1 = __importDefault(require("args"));
const chalk_1 = __importDefault(require("chalk"));
const command_exists_1 = __importDefault(require("command-exists"));
const child_process_1 = require("child_process");
const figures_1 = __importDefault(require("figures"));
const pkg_dir_1 = __importDefault(require("pkg-dir"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const registry_url_1 = __importDefault(require("registry-url"));
const request_1 = __importDefault(require("request"));
const ora_1 = __importDefault(require("ora"));
(async () => {
    // * ---------------------------------------------------------------- util
    const b = (s) => chalk_1.default.bold(s);
    const isTyped = (dep) => /^@types\//.test(dep);
    const joinDeps = (deps) => deps.map((dep) => `@types/${dep}`).join(' ');
    // * ---------------------------------------------------------------- env and checking
    // * ---------------- tools
    // * list of supported package manager tools
    // * the first one found will be default
    const tools = {
        yarn: { install: `yarn add -D`, uninstall: `yarn remove` },
        npm: { install: `npm install -D`, uninstall: `npm uninstall` },
    };
    // * ---------------- look for the first available tool
    const defaultTool = Object.keys(tools).find((tool) => command_exists_1.default.sync(tool));
    if (defaultTool === undefined) {
        console.error("Couldn't find a supported package manager tool.");
    }
    // * ---------------- support for overriding default
    args_1.default.option('tool', 'Which package manager tool to use', defaultTool);
    const opts = args_1.default.parse(process.argv, {
        name: 'ts-typie',
        mri: {},
        mainColor: 'yellow',
        subColor: 'dim',
    });
    const tool = tools[opts.tool];
    // * ---------------- check if package.json exists
    const cwd = process.cwd();
    const rootDir = await pkg_dir_1.default(cwd);
    if (rootDir === undefined) {
        console.error('No package.json file found!');
        process.exit();
    }
    const packagePath = path_1.default.join(rootDir, 'package.json');
    // * ---------------------------------------------------------------- calculation
    const pkg = JSON.parse(fs_1.default.readFileSync(packagePath, 'utf8'));
    const { dependencies: deps = {}, devDependencies: devDeps = {} } = pkg;
    const allDeps = [...Object.keys(deps), ...Object.keys(devDeps), 'node'];
    const allTypes = allDeps.filter((dep) => isTyped(dep));
    const allNormalDeps = allDeps.filter((dep) => !isTyped(dep));
    // * ---------------- deps crossing
    const alreadyTypedDeps = allNormalDeps.filter((dep) => allTypes.includes(`@types/${dep}`));
    const selfTypedDeps = allNormalDeps.filter((dep) => {
        const pkgPath = path_1.default.join(rootDir, 'node_modules', dep, 'package.json');
        if (fs_1.default.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, 'utf8'));
            if (pkg.types || pkg.typings) {
                return true;
            }
            if (pkg.files && pkg.files.find((e) => /\.d\.ts/.test(e))) {
                return true;
            }
        }
        return false;
    });
    const shouldAddTypeDeps = allNormalDeps
        .filter((dep) => !selfTypedDeps.includes(dep))
        .filter((dep) => !alreadyTypedDeps.includes(dep));
    // * installed, but deprecated
    // * e.g. https://www.npmjs.com/package/@types/chalk
    const deprecated = alreadyTypedDeps.filter((dep) => selfTypedDeps.includes(dep));
    const unused = allTypes
        .map((dep) => dep.replace(`@types/`, ''))
        .filter((intalled) => !allNormalDeps.find((dep) => dep === intalled));
    const shouldRemoveTypeDeps = [...new Set([...deprecated, ...unused])];
    // * ---------------------------------------------------------------- display skipping
    alreadyTypedDeps.forEach((dep) => {
        console.log(chalk_1.default.yellow(figures_1.default.play, `Types for ${b(dep)} already installed. Skipping...`));
    });
    selfTypedDeps.forEach((dep) => {
        console.log(chalk_1.default.yellow(figures_1.default.warning, `Module ${b(dep)} includes own types. Skipping...`));
    });
    // * ---------------------------------------------------------------- display uninstalling
    deprecated.forEach((dep) => {
        console.log(chalk_1.default.red(figures_1.default.cross, `@types/${b(dep)} is deprecated. Uninstalling...`));
    });
    unused.forEach((dep) => {
        console.log(chalk_1.default.red(figures_1.default.cross, `@types/${b(dep)} is unused. Uninstalling...`));
    });
    // * ---------------------------------------------------------------- fetching
    // `https://www.npmjs.com/@types/${dep}`
    // `https://registry.npm.taobao.org/@types/${dep}`
    const globalRegistry = registry_url_1.default();
    const fetchPkg = (pkg) => {
        // * support custom registry from config for good reason
        // TODO mayby failure fallback ?
        const url = `${globalRegistry}/@types/${pkg}`.replace('//@types', '/@types');
        return new Promise((resolve) => {
            request_1.default(url, (err, res, body) => {
                resolve([pkg, res.statusCode === 200]);
            });
        });
    };
    // * parallel
    const fetchAll = await Promise.all(shouldAddTypeDeps.map((dep) => fetchPkg(dep)));
    const founds = fetchAll.filter(([, found]) => found).map(([dep]) => dep);
    const notFounds = fetchAll.filter(([, found]) => !found).map(([dep]) => dep);
    // * ---------------------------------------------------------------- display skipping, installing
    notFounds.forEach((dep) => {
        console.log(chalk_1.default.red(figures_1.default.cross, `No types found for ${b(dep)} in registry. Skipping...`));
    });
    if (founds.length) {
        founds.forEach((dep) => {
            console.log(chalk_1.default.green(figures_1.default.tick, `Installing @types/${b(dep)}`));
        });
    }
    else {
        console.log(chalk_1.default.white(figures_1.default.circle, `Nothing needs to be install`));
    }
    // * ---------------------------------------------------------------- calculate commands
    let commands = [];
    if (shouldRemoveTypeDeps.length) {
        commands.push(`${tool.uninstall} ${joinDeps(shouldRemoveTypeDeps)}`);
    }
    if (founds.length) {
        commands.push(`${tool.uninstall} ${joinDeps(shouldRemoveTypeDeps)}`);
    }
    // * ---------------------------------------------------------------- run commands or not
    const spinner = ora_1.default('Processing...').start();
    const complete = () => {
        spinner.stop();
        console.log(chalk_1.default.green(figures_1.default.tick, `Accomplished!`));
    };
    if (commands.length) {
        child_process_1.exec(commands.join('; '), () => complete());
    }
    else {
        complete();
    }
})();
