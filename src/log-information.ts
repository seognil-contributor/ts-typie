import chalk from 'chalk';
import figures from 'figures';

type Logger = (arg: { deprecated: string[]; unused: string[]; founds: string[] }) => void;

export const logLists: Logger = ({ deprecated, unused, founds }) => {
  const b = (dep: string) => chalk.bold(dep);

  // * ---------------- log uninstall list

  deprecated.forEach((dep) => {
    console.log(chalk.red(figures.arrowLeft, `${b(dep)} is deprecated. Needs to uninstall`));
  });

  unused.forEach((dep) => {
    console.log(chalk.red(figures.arrowLeft, `${b(dep)} is unused. Needs to uninstall`));
  });

  // * ---------------- log install list

  if (founds.length) {
    founds.forEach((dep) => {
      console.log(chalk.green(figures.arrowRight, `${b(dep)} is missing. Waiting for install`));
    });
  } else {
    console.log(chalk.white(figures.squareSmallFilled, `Nothing new`));
  }
};
