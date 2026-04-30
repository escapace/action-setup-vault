import { Release } from '@hashicorp/js-releases'
import semver from 'semver'

const PRODUCT = 'vault'
const RELEASES_URL = 'https://releases.hashicorp.com'

export interface VaultBuild {
  filename: string
  url: string
}

export interface VaultRelease {
  version: string
  getBuild: (platform: string, arch: string) => VaultBuild | undefined
  verify: (zipFile: string, buildFilename: string) => Promise<void>
}

export interface ReleaseMetadata {
  name: string
  version: string
  builds?: VaultBuild[]
  shasums?: string
  shasums_signature?: string
  shasums_signatures?: string[]
}

export interface ReleaseIndex {
  name: string
  versions: Record<string, ReleaseMetadata>
}

export interface SetupVaultDependencies {
  downloadTool: (url: string) => Promise<string>
  extractZip: (zipFile: string) => Promise<string>
  findTool: (toolName: string, version: string, arch: string) => string
  debug?: (message: string) => void
  getRelease?: (version: string, enterprise: boolean, userAgent: string) => Promise<VaultRelease>
}

export interface SetupVaultOptions extends SetupVaultDependencies {
  arch: string
  enterprise: boolean
  platform: string
  userAgent: string
  version: string
}

const isEnterpriseVersion = (version: string): boolean => version.includes('+ent')

export const mapArch = (value: string): string =>
  ({
    arm64: 'arm64',
    x32: '386',
    x64: 'amd64',
  })[value] ?? value

export const mapOS = (value: string): string =>
  ({
    win32: 'windows',
  })[value] ?? value

async function fetchVaultReleaseIndex(userAgent: string): Promise<ReleaseIndex> {
  const response = await fetch(`${RELEASES_URL}/${PRODUCT}/index.json`, {
    headers: {
      'User-Agent': userAgent,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Unable to fetch Vault release index: ${response.status} ${response.statusText}`,
    )
  }

  return (await response.json()) as ReleaseIndex
}

export function selectVaultReleaseVersion(
  versions: Record<string, ReleaseMetadata>,
  version: string,
  enterprise: boolean,
): string {
  if (versions[version] !== undefined && isEnterpriseVersion(version) === enterprise) {
    return version
  }

  if (versions[version] !== undefined && isEnterpriseVersion(version)) {
    throw new Error(`Vault Enterprise version ${version} is excluded by the enterprise option`)
  }

  if (isEnterpriseVersion(version) && !enterprise) {
    throw new Error(`Vault Enterprise version ${version} is excluded by the enterprise option`)
  }

  const availableVersions = Object.keys(versions).filter(
    (key) => semver.valid(key) !== null && isEnterpriseVersion(key) === enterprise,
  )

  const validVersion = semver.validRange(version, { loose: true })

  if (validVersion === null) {
    const releaseVersion = availableVersions
      .filter((availableVersion) => semver.prerelease(availableVersion) === null)
      .sort((a, b) => semver.rcompare(a, b))[0]

    if (releaseVersion === undefined) {
      throw new Error(`No Vault ${enterprise ? 'Enterprise ' : ''}releases found`)
    }

    return releaseVersion
  }

  const releaseVersion = semver.maxSatisfying(availableVersions, validVersion)

  if (releaseVersion === null) {
    throw new Error(
      `No matching Vault ${enterprise ? 'Enterprise ' : ''}version found for constraint "${validVersion}"`,
    )
  }

  return releaseVersion
}

async function getVaultRelease(
  version: string,
  enterprise: boolean,
  userAgent: string,
): Promise<VaultRelease> {
  const releaseIndex = await fetchVaultReleaseIndex(userAgent)
  const releaseVersion = selectVaultReleaseVersion(releaseIndex.versions, version, enterprise)
  const releaseMetadata = releaseIndex.versions[releaseVersion]

  if (releaseMetadata === undefined) {
    throw new Error(`Vault version ${releaseVersion} not found in the release index`)
  }

  return new Release(releaseMetadata)
}

export async function setupVault(options: SetupVaultOptions): Promise<string> {
  const platform = mapOS(options.platform)
  const arch = mapArch(options.arch)
  const getRelease = options.getRelease ?? getVaultRelease

  options.debug?.(
    `Finding ${options.enterprise ? 'Vault Enterprise' : 'Vault'} release for version ${options.version}`,
  )

  const release = await getRelease(options.version, options.enterprise, options.userAgent)

  options.debug?.(`Getting build for Vault version ${release.version}: ${platform} ${arch}`)

  const build = release.getBuild(platform, arch)

  if (build === undefined) {
    throw new Error(`Vault version ${options.version} not available for ${platform} and ${arch}`)
  }

  let toolPath = options.findTool(PRODUCT, release.version, arch)

  if (toolPath.length === 0) {
    options.debug?.(`Downloading Vault from ${build.url}`)

    const zipFile = await options.downloadTool(build.url)

    await release.verify(zipFile, build.filename)

    toolPath = await options.extractZip(zipFile)

    options.debug?.(`Vault path is ${toolPath}.`)

    if (toolPath.length === 0) {
      throw new Error(`Unable to download Vault from ${build.url}`)
    }
  }

  return toolPath
}
