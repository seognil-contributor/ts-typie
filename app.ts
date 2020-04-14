#!/usr/bin/env node

import args from 'args';
import chalk from 'chalk';
import commandExists from 'command-exists';
import { exec } from 'child_process';
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

  const joinDeps = (deps: string[]) => deps.map((dep) => `@types/${dep}`).join(' ');

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

  // * ---------------------------------------------------------------- display skipping

  alreadyTypedDeps.forEach((dep) => {
    console.log(chalk.yellow(figures.play, `Types for ${b(dep)} already installed. Skipping...`));
  });

  selfTypedDeps.forEach((dep) => {
    console.log(chalk.yellow(figures.warning, `Module ${b(dep)} includes own types. Skipping...`));
  });

  // * ---------------------------------------------------------------- display uninstalling

  deprecated.forEach((dep) => {
    console.log(chalk.red(figures.cross, `@types/${b(dep)} is deprecated. Uninstalling...`));
  });

  unused.forEach((dep) => {
    console.log(chalk.red(figures.cross, `@types/${b(dep)} is unused. Uninstalling...`));
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

  // * parallel
  const fetchAll = await Promise.all(shouldAddTypeDeps.map((dep) => fetchPkg(dep)));

  const founds = fetchAll.filter(([, found]) => found).map(([dep]) => dep);
  const notFounds = fetchAll.filter(([, found]) => !found).map(([dep]) => dep);

  // * ---------------------------------------------------------------- display skipping, installing

  notFounds.forEach((dep) => {
    console.log(chalk.red(figures.cross, `No types found for ${b(dep)} in registry. Skipping...`));
  });

  if (founds.length) {
    founds.forEach((dep) => {
      console.log(chalk.green(figures.tick, `Installing @types/${b(dep)}`));
    });
  } else {
    console.log(chalk.white(figures.circle, `Nothing needs to be install`));
  }

  // * ---------------------------------------------------------------- calculate commands

  let commands: string[] = [];

  if (shouldRemoveTypeDeps.length) {
    commands.push(`${tool.uninstall} ${joinDeps(shouldRemoveTypeDeps)}`);
  }

  if (founds.length) {
    commands.push(`${tool.uninstall} ${joinDeps(shouldRemoveTypeDeps)}`);
  }

  // * ---------------------------------------------------------------- run commands or not

  const spinner = ora('Processing...').start();

  const complete = () => {
    spinner.stop();
    console.log(chalk.green(figures.tick, `Accomplished!`));
  };

  if (commands.length) {
    exec(commands.join('; '), () => complete());
  } else {
    complete();
  }
})();
