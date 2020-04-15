import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { tool } from '../../src/tools';

const currentDir = path.resolve(__dirname);

// * prepare
execSync(`cd ${currentDir}; cp package.origin.json package.json`);

// * npm install
execSync(`cd ${currentDir}; ${tool} install`, { stdio: 'inherit' });

// * run
execSync(`cd ${currentDir}; ../../node_modules/ts-node/dist/bin.js ../../src/app.ts`, {
  stdio: 'inherit',
});

describe('run test', () => {
  test('should applying correctly', () => {
    const readPkg = (file: string) =>
      JSON.parse(fs.readFileSync(path.resolve(currentDir, file), 'utf8'));

    const j1 = readPkg('./package.json');
    const j2 = readPkg('./package.expect.json');

    const listDeps = (pkg: any, field: string) => {
      Object.keys(pkg[field]).sort((a, b) => (a < b ? -1 : 1));
    };

    expect(listDeps(j1, 'devDependencies')).toEqual(listDeps(j2, 'devDependencies'));

    expect(listDeps(j1, 'dependencies')).toEqual(listDeps(j2, 'dependencies'));
  });
});
