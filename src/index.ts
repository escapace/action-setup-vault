import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import { getRelease } from './vendor'
import { isError, isString, isEmpty } from 'lodash-es'
import os from 'os'

const mapArch = (arch: string): string =>
  ({
    x32: '386',
    arm64: 'arm64',
    x64: 'amd64'
  }[arch] ?? arch)

const mapOS = (os: string): string =>
  ({
    win32: 'windows'
  }[os] ?? os)

const USER_AGENT = 'escapace/setup-vault'

async function download(
  url: string,
  verify: (zipFile: string) => Promise<void>
) {
  core.debug(`Downloading Vault from ${url}`)

  const pathToZip = await tc.downloadTool(url)

  await verify(pathToZip)

  const pathToFile = await tc.extractZip(pathToZip)

  core.debug(`Vault path is ${pathToFile}.`)

  if (!isString(pathToZip) || !isString(pathToFile)) {
    throw new Error(`Unable to download Vault from ${url}`)
  }

  return pathToFile
}

export async function run() {
  try {
    const version = core.getInput('vault-version')
    const platform = mapOS(os.platform())
    const arch = mapArch(os.arch())

    core.debug(`Finding releases for Vault version ${version}`)

    const release = await getRelease('vault', version, USER_AGENT)

    core.debug(
      `Getting build for Vault version ${release.version}: ${platform} ${arch}`
    )

    const build = release.getBuild(platform, arch)

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (!build) {
      throw new Error(
        `Vault version ${version} not available for ${platform} and ${arch}`
      )
    }

    let toolPath = tc.find('vault', release.version, arch)

    if (!isString(toolPath) || isEmpty(toolPath)) {
      toolPath = await download(
        build.url,
        async (zipFile: string) => await release.verify(zipFile, build.filename)
      )
    }

    core.addPath(toolPath)
  } catch (error) {
    if (isError(error)) {
      core.setFailed(error.message)
    } else if (isString(error)) {
      core.setFailed(error)
    }

    core.setFailed('Unknown Error')
  }
}

void run()
