import { build } from 'esbuild'
import { execa } from 'execa'
import fse from 'fs-extra'
import { mkdir } from 'fs/promises'
import path from 'path'
import { cwd, target, external } from './constants.mjs'

const options = {
  cjs: {
    outdir: path.join(cwd, 'lib/cjs')
  }
}

process.umask(0o022)
process.chdir(cwd)

await Promise.all(
  Object.keys(options).map(async (format) => {
    const { outdir } = options[format]

    await fse.remove(outdir)
    await mkdir(outdir, { recursive: true })

    await build({
      bundle: true,
      entryPoints: ['src/index.ts'],
      // external: ['esbuild', ...external],
      format,
      logLevel: 'info',
      outExtension: { '.js': `.${format === 'esm' ? 'mjs' : 'cjs'}` },
      outbase: path.join(cwd, 'src'),
      outdir,
      platform: 'node',
      sourcemap: true,
      target,
      tsconfig: path.join(cwd, 'tsconfig-build.json')
    })
  })
)
