import registryUrl from 'registry-url';
import request from 'request';

const globalRegistry = registryUrl();

// * support custom registry from global config
// `https://www.npmjs.com/@types/${dep}`
// `https://registry.npm.taobao.org/@types/${dep}`
// TODO mayby failure fallback ?

const fetchSingle = (pkg: string) => {
  const typesPkg = `@types/${pkg}`;
  const url = `${globalRegistry}/${typesPkg}`.replace('//@types', '/@types');

  return new Promise<[string, boolean]>((resolve) => {
    request(url, (err, res, body) => {
      resolve([typesPkg, res.statusCode === 200]);
    });
  });
};

// * parallel fetching, it's faster
export const fetchTypes = (deps: string[]) =>
  Promise.all(deps.map((dep) => fetchSingle(dep))).then((allTypesResult) => {
    const founds = allTypesResult.filter(([, f]) => f).map(([dep]) => dep);
    const notFounds = allTypesResult.filter(([, f]) => !f).map(([dep]) => dep);

    return { founds, notFounds };
  });
