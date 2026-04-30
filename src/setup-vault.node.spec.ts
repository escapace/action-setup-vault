import { describe, expect, it, vi } from 'vitest'
import {
  mapArch,
  mapOS,
  type ReleaseMetadata,
  selectVaultReleaseVersion,
  setupVault,
  type VaultRelease,
} from './setup-vault'

const toolCacheRoot = '/opt/hostedtoolcache'

function release(version: string): ReleaseMetadata {
  return {
    name: 'vault',
    version,
  }
}

function createRelease(
  version: string,
  build = {
    filename: `vault_${version}_linux_amd64.zip`,
    url: `https://releases.hashicorp.com/vault/${version}/vault_${version}_linux_amd64.zip`,
  },
): VaultRelease {
  return {
    getBuild: vi.fn<VaultRelease['getBuild']>(() => build),
    verify: vi.fn<VaultRelease['verify']>(async () => {
      await Promise.resolve()
    }),
    version,
  }
}

describe('mapArch', () => {
  it('maps Node architecture names to Vault release architecture names', () => {
    expect(mapArch('x64')).toBe('amd64')
    expect(mapArch('x32')).toBe('386')
    expect(mapArch('arm64')).toBe('arm64')
    expect(mapArch('s390x')).toBe('s390x')
  })
})

describe('mapOS', () => {
  it('maps Node platform names to Vault release OS names', () => {
    expect(mapOS('win32')).toBe('windows')
    expect(mapOS('linux')).toBe('linux')
  })
})

describe('selectVaultReleaseVersion', () => {
  it('excludes enterprise releases when enterprise is false', () => {
    expect(
      selectVaultReleaseVersion(
        {
          '1.0.0': release('1.0.0'),
          '1.1.0': release('1.1.0'),
          '1.2.0+ent': release('1.2.0+ent'),
        },
        'latest',
        false,
      ),
    ).toBe('1.1.0')
  })

  it('selects enterprise releases when enterprise is true', () => {
    expect(
      selectVaultReleaseVersion(
        {
          '1.0.0': release('1.0.0'),
          '1.1.0': release('1.1.0'),
          '1.2.0+ent': release('1.2.0+ent'),
        },
        'latest',
        true,
      ),
    ).toBe('1.2.0+ent')
  })

  it('resolves semver ranges without selecting enterprise releases by default', () => {
    expect(
      selectVaultReleaseVersion(
        {
          '1.21.4': release('1.21.4'),
          '1.21.5+ent': release('1.21.5+ent'),
          '1.21.5+ent.hsm': release('1.21.5+ent.hsm'),
        },
        '^1.21.0',
        false,
      ),
    ).toBe('1.21.4')
  })

  it('resolves semver ranges to enterprise releases when enterprise is true', () => {
    expect(
      selectVaultReleaseVersion(
        {
          '1.21.4': release('1.21.4'),
          '1.21.5+ent': release('1.21.5+ent'),
        },
        '^1.21.0',
        true,
      ),
    ).toBe('1.21.5+ent')
  })

  it('resolves a community version constraint to its enterprise build when enterprise is true', () => {
    expect(
      selectVaultReleaseVersion(
        {
          '1.21.5': release('1.21.5'),
          '1.21.5+ent': release('1.21.5+ent'),
        },
        '1.21.5',
        true,
      ),
    ).toBe('1.21.5+ent')
  })

  it('keeps exact enterprise version requests when enterprise is true', () => {
    expect(
      selectVaultReleaseVersion(
        {
          '1.21.5': release('1.21.5'),
          '1.21.5+ent': release('1.21.5+ent'),
        },
        '1.21.5+ent',
        true,
      ),
    ).toBe('1.21.5+ent')
  })

  it('rejects exact enterprise version requests when enterprise is false', () => {
    expect(() =>
      selectVaultReleaseVersion(
        {
          '1.21.5': release('1.21.5'),
          '1.21.5+ent': release('1.21.5+ent'),
        },
        '1.21.5+ent',
        false,
      ),
    ).toThrow('excluded by the enterprise option')
  })
})

describe('setupVault', () => {
  it('uses a cached Vault tool path when available', async () => {
    const release = createRelease('1.21.5')
    const cacheTool =
      vi.fn<
        (
          sourceDirectory: string,
          toolName: string,
          version: string,
          arch: string,
        ) => Promise<string>
      >()
    const downloadTool = vi.fn<(url: string) => Promise<string>>()
    const extractZip = vi.fn<(zipFile: string) => Promise<string>>()
    const findTool = vi.fn(
      () => '/opt/hostedtoolcache/action-setup-vault-tool-cache-community/1.21.5/amd64',
    )
    const restoreActionsCache =
      vi.fn<(paths: string[], key: string) => Promise<string | undefined>>()
    const saveActionsCache = vi.fn<(paths: string[], key: string) => Promise<number>>()

    await expect(
      setupVault({
        actionsCacheEnabled: true,
        arch: 'x64',
        cacheTool,
        downloadTool,
        enterprise: false,
        extractZip,
        findTool,
        platform: 'linux',
        restoreActionsCache,
        saveActionsCache,
        toolCacheRoot,
        userAgent: 'test-agent',
        version: '^1.21.0',
        actionsCacheFeatureAvailable: () => true,
        getRelease: async () => await Promise.resolve(release),
        removePath: async () => await Promise.resolve(),
      }),
    ).resolves.toBe('/opt/hostedtoolcache/action-setup-vault-tool-cache-community/1.21.5/amd64')

    expect(release.getBuild).toHaveBeenCalledWith('linux', 'amd64')
    expect(findTool).toHaveBeenCalledWith(
      'action-setup-vault-tool-cache-community',
      '1.21.5',
      'amd64',
    )
    expect(restoreActionsCache).not.toHaveBeenCalled()
    expect(saveActionsCache).not.toHaveBeenCalled()
    expect(cacheTool).not.toHaveBeenCalled()
    expect(downloadTool).not.toHaveBeenCalled()
    expect(extractZip).not.toHaveBeenCalled()
    expect(release.verify).not.toHaveBeenCalled()
  })

  it('restores Vault from the GitHub Actions cache before downloading', async () => {
    const release = createRelease('1.21.5')
    const cacheTool =
      vi.fn<
        (
          sourceDirectory: string,
          toolName: string,
          version: string,
          arch: string,
        ) => Promise<string>
      >()
    const downloadTool = vi.fn<(url: string) => Promise<string>>()
    const extractZip = vi.fn<(zipFile: string) => Promise<string>>()
    const findTool = vi
      .fn<(...parameters: [string, string, string]) => string>()
      .mockReturnValueOnce('')
      .mockReturnValueOnce(
        '/opt/hostedtoolcache/action-setup-vault-tool-cache-community/1.21.5/amd64',
      )
    const removePath = vi.fn(async () => await Promise.resolve())
    const restoreActionsCache = vi.fn(async () => await Promise.resolve('vault-cache-key'))
    const saveActionsCache = vi.fn<(paths: string[], key: string) => Promise<number>>()

    await expect(
      setupVault({
        actionsCacheEnabled: true,
        arch: 'x64',
        cacheTool,
        downloadTool,
        enterprise: false,
        extractZip,
        findTool,
        platform: 'linux',
        removePath,
        restoreActionsCache,
        saveActionsCache,
        toolCacheRoot,
        userAgent: 'test-agent',
        version: '^1.21.0',
        actionsCacheFeatureAvailable: () => true,
        getRelease: async () => await Promise.resolve(release),
      }),
    ).resolves.toBe('/opt/hostedtoolcache/action-setup-vault-tool-cache-community/1.21.5/amd64')

    expect(removePath).toHaveBeenCalledWith(
      '/opt/hostedtoolcache/action-setup-vault-tool-cache-community/1.21.5/amd64',
    )
    expect(removePath).toHaveBeenCalledWith(
      '/opt/hostedtoolcache/action-setup-vault-tool-cache-community/1.21.5/amd64.complete',
    )
    expect(restoreActionsCache).toHaveBeenCalledWith(
      [
        '/opt/hostedtoolcache/action-setup-vault-tool-cache-community/1.21.5/amd64',
        '/opt/hostedtoolcache/action-setup-vault-tool-cache-community/1.21.5/amd64.complete',
      ],
      'action-setup-vault-tool-cache-community-1.21.5-linux-amd64',
    )
    expect(downloadTool).not.toHaveBeenCalled()
    expect(cacheTool).not.toHaveBeenCalled()
    expect(saveActionsCache).not.toHaveBeenCalled()
  })

  it('downloads, verifies, extracts, locally caches, and saves Vault on cache misses', async () => {
    const build = {
      filename: 'vault_1.21.5+ent_windows_amd64.zip',
      url: 'https://releases.hashicorp.com/vault/1.21.5+ent/vault_1.21.5+ent_windows_amd64.zip',
    }
    const release = createRelease('1.21.5+ent', build)
    const cacheTool = vi.fn(
      async () =>
        await Promise.resolve(
          '/opt/hostedtoolcache/action-setup-vault-tool-cache-enterprise/1.21.5/amd64',
        ),
    )
    const downloadTool = vi.fn(async () => {
      await Promise.resolve()

      return '/tmp/vault.zip'
    })
    const extractZip = vi.fn(async () => {
      await Promise.resolve()

      return '/tmp/vault'
    })
    const findTool = vi.fn(() => '')
    const restoreActionsCache = vi.fn(async () => await Promise.resolve(undefined))
    const saveActionsCache = vi.fn(async () => await Promise.resolve(1))

    await expect(
      setupVault({
        actionsCacheEnabled: true,
        arch: 'x64',
        cacheTool,
        downloadTool,
        enterprise: true,
        extractZip,
        findTool,
        platform: 'win32',
        restoreActionsCache,
        saveActionsCache,
        toolCacheRoot,
        userAgent: 'test-agent',
        version: '^1.21.0',
        actionsCacheFeatureAvailable: () => true,
        getRelease: async () => await Promise.resolve(release),
        removePath: async () => await Promise.resolve(),
      }),
    ).resolves.toBe('/opt/hostedtoolcache/action-setup-vault-tool-cache-enterprise/1.21.5/amd64')

    expect(release.getBuild).toHaveBeenCalledWith('windows', 'amd64')
    expect(findTool).toHaveBeenCalledWith(
      'action-setup-vault-tool-cache-enterprise',
      '1.21.5+ent',
      'amd64',
    )
    expect(downloadTool).toHaveBeenCalledWith(build.url)
    expect(release.verify).toHaveBeenCalledWith('/tmp/vault.zip', build.filename)
    expect(extractZip).toHaveBeenCalledWith('/tmp/vault.zip')
    expect(cacheTool).toHaveBeenCalledWith(
      '/tmp/vault',
      'action-setup-vault-tool-cache-enterprise',
      '1.21.5+ent',
      'amd64',
    )
    expect(saveActionsCache).toHaveBeenCalledWith(
      [
        '/opt/hostedtoolcache/action-setup-vault-tool-cache-enterprise/1.21.5/amd64',
        '/opt/hostedtoolcache/action-setup-vault-tool-cache-enterprise/1.21.5/amd64.complete',
      ],
      'action-setup-vault-tool-cache-enterprise-1.21.5-windows-amd64',
    )
  })
})
