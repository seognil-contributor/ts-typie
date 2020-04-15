import path from 'path';
import { execSync } from 'child_process';
import { parsePkg } from '../../src/listing-dep';
import { tool } from '../../src/tools';

const currentDir = path.resolve(__dirname);

// * npm install before
execSync(`cd ${currentDir}; ${tool} install`, { stdio: 'inherit' });

describe('package static analyze', () => {
  test('should resulting correctly', () => {
    expect(parsePkg(currentDir)).toEqual({
      deprecated: [
        //
        '@types/chalk',
        '@types/ora',
      ],
      unused: [
        //
        '@types/terser-webpack-plugin',
      ],
      missed: [
        '@types/args',
        '@types/command-exists',
        '@types/jest',
        '@types/node',
        '@types/request',
        '@types/rollup-plugin-hashbang',
      ],
    });
  });
});
