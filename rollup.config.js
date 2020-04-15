import hashbang from 'rollup-plugin-hashbang';
import typescript from '@rollup/plugin-typescript';

export default {
  input: './src/app.ts',
  output: { file: './app.js', format: 'cjs' },
  plugins: [hashbang(), typescript({ module: 'ESNext' })],
};
