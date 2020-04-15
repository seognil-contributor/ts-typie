import args from 'args';
import commandExists from 'command-exists';

// * list of supported package manager tools
// * the first one found will be default
const tools = {
  yarn: { install: `yarn add -D`, uninstall: `yarn remove` },
  npm: { install: `npm install -D`, uninstall: `npm uninstall` },
};

// * look for the first available tool
const defaultTool = Object.keys(tools).find((tool) => commandExists.sync(tool));
if (defaultTool === undefined) {
  console.error("Couldn't find a supported package manager tool");
  console.error('Have you installed Node.js?');
  process.exit();
}

// * support for overriding default
args.option('tool', 'Which package manager tool to use', defaultTool);
const opts = args.parse(process.argv, {
  name: 'ts-typie',
  mri: {},
  mainColor: 'yellow',
  subColor: 'dim',
});

export const tool = opts.tool as keyof typeof tools;

export const toolCommand = tools[tool];
