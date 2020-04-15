# ts-typie

A small utility for installing TypeScript definition files using npm.

> You can also read this README in [English](./README.md), [简体中文](./README.zh-hans.md)

---

ts-typie reads your `package.json` file and tries to install TypeScript definition files for all your installed modules, so you don't have to do it manually. (About TypeScript definition, check [this site](http://definitelytyped.org/))

For every package you have installed, ts-typie also checks for included definition files that come packed with the npm module itself and skips the module if it finds bundled definition files. (e.g. [moment](https://github.com/moment/moment) includes [its own definition files](https://github.com/moment/moment/blob/develop/moment.d.ts), so [@types/moment](https://www.npmjs.com/package/@types/moment) is deprecated now)

## Features

ts-typie now supports:

- Uninstall deprecated packages (e.g. `@types/moment` we just mentioned before)
- Uninstall unused definition packages
- read `npm config`, use current registry (e.g. Chinese developers may using `https://registry.npm.taobao.org/` instead of `https://registry.npmjs.org/`)
- Parallel fetching, improve the speed
- Check `@types/node`
- Install missing definition packages using yarn or npm

## Installation

Global install:

- `npm -g i ts-typie`
- `yarn global add ts-typie`

Or as a dev dependancy:

- `npm install -D ts-typie`
- `yarn add -D ts-typie`

## Usage

While in you node project, run ts-typie through terminal

if global installed:

`ts-typie [options]`

if as dev dependancy:

`npx ts-typie [options]`

### Options

| Option                         | Info                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| `--help`, `-h`                 | Output usage information                                        |
| `--tool [value]`, `-t [value]` | Which package manager tool to use (defaults to first available) |
| `--version`, `-v`              | Output the version number                                       |

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

ISC
