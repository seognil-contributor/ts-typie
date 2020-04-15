#!/usr/bin/env node

import searchPkg from 'pkg-dir';
import { execSync } from 'child_process';
import chalk from 'chalk';
import figures from 'figures';
import ora from 'ora';
import prettyMs from 'pretty-ms';

import { toolCommand } from './tools';
import { parsePkg } from './listing-dep';
import { fetchTypes } from './listing-fetch';
import { logLists } from './log-information';

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
    execSync(`${uninstall} ${allUn}`, { stdio: 'inherit' });
  }

  const allIn = founds.join(' ');
  if (allIn.length) {
    execSync(`${install} ${allIn}`, { stdio: 'inherit' });
  }

  // * ---------------- completing

  const deltaTime = prettyMs(Date.now() - startTime, { secondsDecimalDigits: 2 });
  console.log(chalk.green(figures.tick, `All types are OK. Done in ${deltaTime}`));
})();
