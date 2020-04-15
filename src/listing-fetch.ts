import registryUrl from 'registry-url';
import request from 'request';

const globalRegistry = registryUrl();

// * support custom registry from global config
// `https://www.npmjs.com/@types/${dep}`
// `https://registry.npm.taobao.org/@types/${dep}`
// TODO mayby failure fallback ?

const fetchSingle = (pkg: string): Promise<[string, boolean]> => {
  const url = `${globalRegistry}/${pkg}`.replace('//@types', '/@types');

  return new Promise<[string, boolean]>((resolve) => {
    request(url, (err, res, body) => {
      resolve([pkg, res.statusCode === 200]);
    });
  });
};

// * parallel fetching, it's faster
export const fetchTypes = (deps: string[]): Promise<{ founds: string[]; notFounds: string[] }> =>
  Promise.all(deps.map((dep) => fetchSingle(dep))).then((allTypesResult) => {
    const founds: string[] = allTypesResult.filter(([, f]) => f).map(([dep]) => dep);
    const notFounds: string[] = allTypesResult.filter(([, f]) => !f).map(([dep]) => dep);

    return { founds, notFounds };
  });
