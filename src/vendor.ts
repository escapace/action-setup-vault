import { Release } from '@hashicorp/js-releases'
import request from 'axios'
import semver from 'semver'

const releasesUrl = 'https://releases.hashicorp.com'

export async function getRelease(
  product: string,
  version?: string,
  userAgent?: string,
  includePrerelease?: boolean
): Promise<Release> {
  const range = semver.validRange(version, {
    includePrerelease,
    loose: true
  })

  const indexUrl = `${releasesUrl}/${product}/index.json`

  const headers =
    userAgent !== undefined ? { 'User-Agent': userAgent } : undefined

  const response = await request(indexUrl, { headers })

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const versions = response.data.versions as Record<string, unknown>

  let release: Release

  if (range == null) {
    // pick the latest release (prereleases will be skipped for safety, set an explicit version instead)
    const releaseVersions = Object.keys(versions)
      .filter((v) => semver.valid(v) !== null)
      .filter((v) => semver.prerelease(v) == null)

    version = releaseVersions.sort((a, b) => semver.rcompare(a, b))[0]

    release = new Release(versions[version])
  } else {
    release = matchVersion(versions, range, includePrerelease)
  }

  return release
}

function matchVersion(
  versions: Record<string, unknown>,
  range: string,
  includePrerelease?: boolean
): Release {
  // If a prerelease version range is given, it will only match in that series (0.14-rc0, 0.14-rc1)
  // unless includePrerelease is set to true
  // https://www.npmjs.com/package/semver#prerelease-tags
  const version = semver.maxSatisfying(Object.keys(versions), range, {
    includePrerelease
  })

  if (version !== null) {
    return new Release(versions[version])
  } else {
    throw new Error('No matching version found')
  }
}
