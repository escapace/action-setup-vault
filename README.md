## action-setup-vault

Install the HashiCorp Vault CLI in GitHub Actions and add the selected community or Enterprise binary to `PATH`.

When a matching version was installed by this action before, the cached installation is reused.

```yaml
uses: escapace/action-setup-vault@v1.0.0
with:
  vault-version: ~1.10.4
```

### Inputs

#### `vault-version`

Version or semantic version range to install. Use `latest` for the latest community release, or for the latest Enterprise release when `enterprise` is `true`.

Default: `latest`

#### `enterprise`

Install a Vault Enterprise release instead of a community release.

Default: `false`

#### `cache`

Persist installed Vault versions with the GitHub Actions cache.

Default: `true`

```yaml
uses: escapace/action-setup-vault@v1.0.0
with:
  enterprise: true
  vault-version: ^1.21.0
```
