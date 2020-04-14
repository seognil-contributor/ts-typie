#!/usr/bin/env node

import args from 'args';
import chalk from 'chalk';
import commandExists from 'command-exists';
import { execSync } from 'child_process';
import figures from 'figures';
import pkgDir from 'pkg-dir';
import fs from 'fs';
import path from 'path';
import registryUrl from 'registry-url';
import request from 'request';
import ora from 'ora';

(async () => {
  // * ---------------------------------------------------------------- util

  const b = (s: string) => chalk.bold(s);

  const isTyped = (dep: string) => /^@types\//.test(dep);

  const d2t = (dep: string) => `@types/${dep}`;

  const joinDeps = (deps: string[]) => deps.map(d2t).join(' ');

  const logSkip = (str: string) => {
    // ? display or not, it's verbose
    // console.log(chalk.yellow(figures.bullet, str));
  };

  const logUninstall = (str: string) => {
    console.log(chalk.red(figures.arrowLeft, str));
  };

  // * ---------------------------------------------------------------- env and checking

  // * ---------------- tools
  // * list of supported package manager tools
  // * the first one found will be default

  const tools = {
    yarn: { install: `yarn add -D`, uninstall: `yarn remove` },
    npm: { install: `npm install -D`, uninstall: `npm uninstall` },
  };

  // * ---------------- look for the first available tool

  const defaultTool = Object.keys(tools).find((tool) => commandExists.sync(tool));

  if (defaultTool === undefined) {
    console.error("Couldn't find a supported package manager tool.");
  }

  // * ---------------- support for overriding default

  args.option('tool', 'Which package manager tool to use', defaultTool);
  const opts = args.parse(process.argv, {
    name: 'ts-typie',
    mri: {},
    mainColor: 'yellow',
    subColor: 'dim',
  });
  const tool = tools[opts.tool as keyof typeof tools];

  // * ---------------- check if package.json exists

  const cwd = process.cwd();
  const rootDir = await pkgDir(cwd);

  if (rootDir === undefined) {
    console.error('No package.json file found!');
    process.exit();
  }

  const packagePath = path.join(rootDir, 'package.json');

  // * ---------------------------------------------------------------- calculation

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  const { dependencies: deps = {}, devDependencies: devDeps = {} } = pkg;

  const allDeps = [...Object.keys(deps), ...Object.keys(devDeps), 'node'];

  const allTypes = allDeps.filter((dep) => isTyped(dep));
  const allNormalDeps = allDeps.filter((dep) => !isTyped(dep));

  // * ---------------- deps crossing

  const alreadyTypedDeps = allNormalDeps.filter((dep) => allTypes.includes(`@types/${dep}`));

  const selfTypedDeps = allNormalDeps.filter((dep) => {
    const pkgPath = path.join(rootDir, 'node_modules', dep, 'package.json');

    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      if (pkg.types || pkg.typings) {
        return true;
      }

      if (pkg.files && (pkg.files as string[]).find((e) => /\.d\.ts/.test(e))) {
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
    .map((dep: string) => dep.replace(`@types/`, ''))
    .filter((intalled) => !allNormalDeps.find((dep) => dep === intalled));

  const shouldRemoveTypeDeps = [...new Set([...deprecated, ...unused])];

  // * ---------------------------------------------------------------- display skipping installed

  alreadyTypedDeps.forEach((dep) => {
    logSkip(`${b(d2t(dep))} for ${dep} already installed. Skipping...`);
  });

  selfTypedDeps.forEach((dep) => {
    logSkip(`${b(dep)} includes own types. Skipping...`);
  });

  // * ---------------------------------------------------------------- fetching

  // `https://www.npmjs.com/@types/${dep}`
  // `https://registry.npm.taobao.org/@types/${dep}`

  const globalRegistry = registryUrl();
  const fetchPkg = (pkg: string) => {
    // * support custom registry from config for good reason
    // TODO mayby failure fallback ?
    const url = `${globalRegistry}/@types/${pkg}`.replace('//@types', '/@types');

    return new Promise<[string, boolean]>((resolve) => {
      request(url, (err, res, body) => {
        resolve([pkg, res.statusCode === 200]);
      });
    });
  };

  const spinner = ora('Fetching...').start();

  // * parallel fetch
  const fetchAll = await Promise.all(shouldAddTypeDeps.map((dep) => fetchPkg(dep)));

  spinner.stop();

  const founds = fetchAll.filter(([, found]) => found).map(([dep]) => dep);
  const notFounds = fetchAll.filter(([, found]) => !found).map(([dep]) => dep);

  // * ---------------------------------------------------------------- display skipping not found

  notFounds.forEach((dep) => {
    logSkip(`${b(d2t(dep))} not found in registry. Skipping...`);
  });

  // * ---------------------------------------------------------------- display uninstalling list

  deprecated.forEach((dep) => {
    logUninstall(`${b(d2t(dep))} is deprecated. Uninstalling...`);
  });

  unused.forEach((dep) => {
    logUninstall(`${b(d2t(dep))} is unused. Uninstalling...`);
  });

  // * ---------------------------------------------------------------- display installing list

  if (founds.length) {
    founds.forEach((dep) => {
      console.log(chalk.green(figures.arrowRight, `Installing ${b(d2t(dep))}`));
    });
  } else {
    console.log(chalk.white(figures.squareSmallFilled, `Nothing needs to be install`));
  }

  // * ---------------------------------------------------------------- run commands or not

  if (shouldRemoveTypeDeps.length) {
    execSync(`${tool.uninstall} ${joinDeps(shouldRemoveTypeDeps)}`, { stdio: 'inherit' });
  }

  if (founds.length) {
    execSync(`${tool.install} ${joinDeps(founds)}`, { stdio: 'inherit' });
  }

  console.log(chalk.green(figures.tick, `Accomplished!`));
})();
