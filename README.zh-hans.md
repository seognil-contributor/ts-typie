# ts-typie

一个用来安装 TypeScript 类型声明库的小工具。

> 你也可以去看其他语言的 README：[English](./README.md), [简体中文](./README.zh-hans.md)

---

ts-typie 读取你的 `package.json` 文件，分析所有的依赖字段，并为它们安装缺失的类型声明。这样你就不用手动一个一个安装了。（什么是类型声明，参考 [这个网站](http://definitelytyped.org/)）

对于每个 package，ts-typie 也检查它是否已经内置了声明文件（`d.ts`），如果是，那么就没必要添加额外的声明。（比方说，[moment](https://github.com/moment/moment) 这个包现在已经内置了[声明文件](https://github.com/moment/moment/blob/develop/moment.d.ts)，于是 [@types/moment](https://www.npmjs.com/package/@types/moment) 就不需要了）

## 特性

ts-typie 现在支持：

- 删除 deprecated 的项（比如刚才提到的 `@types/moment`）
- 删除未使用的类型声明项
- 自动读取 `npm config`，解析当前仓库源（比如从 `https://registry.npm.taobao.org/` 而不是 `https://registry.npmjs.org/`）
- 并行搜索，提高搜索效率
- 检查 `@types/node`
- 支持 yarn 或 npm 进行安装

## 安装

全局安装：

- `npm -g i ts-typie`
- `yarn global add ts-typie`

或作为依赖安装：

- `npm install -D ts-typie`
- `yarn add -D ts-typie`

## 使用

进入你的 Node 项目中，然后在终端运行 ts-typie

如果是通过全局安装的：

`ts-typie [options]`

如果是作为依赖安装的：

`npx ts-typie [options]`

### 选项

| 选项                           | 描述                                   |
| ------------------------------ | -------------------------------------- |
| `--help`, `-h`                 | 打印帮助信息                           |
| `--tool [value]`, `-t [value]` | 指定包管理器 (默认搜素顺序 yarn , npm) |
| `--version`, `-v`              | 打印版本信息                           |

## 贡献

欢迎提 PR。如果是大的改动，那你可以先开一个 issue 来讨论你想进行什么改动。

调整后记得同时更新测试。

## License

ISC
