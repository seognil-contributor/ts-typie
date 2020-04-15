import path from 'path';
import fs from 'fs';

export const isTyped = (dep: string) => /^@types\//.test(dep);

export const parsePkg = (rootDir: string) => {
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
  const itsNotSelfed: string[] = ['jest'];

  const depsSelfTyped = depsAll
    .filter((dep) => {
      const pkgPath = path.join(rootDir, 'node_modules', dep, 'package.json');

      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        const isTyped = pkg.types || pkg.typings;
        const containDts = pkg.files && (pkg.files as string[]).find((e) => /\.d\.ts/.test(e));

        return isTyped || containDts;
      }

      return false;
    })
    .filter((dep) => !itsNotSelfed.includes(dep));

  // * ---------------- types result

  const d2t = (dep: string) => `@types/${dep}`;

  const sorter = (a: string, b: string) => (a < b ? -1 : 1);

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
    .map((dep: string) => dep.replace(`@types/`, ''))
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
