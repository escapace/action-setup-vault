## action-setup-vault

Sets up HashiCorp Vault.

### Inputs

#### `vault-version`

**Optional** The version of Vault to install. Instead of full version string you
can also specify a semantic version range (for example `^1.10.4`) to install the
latest version satisfying the constraint. A value of `latest` will install the
latest version of Vault. Defaults to `latest`.

### Example usage

```yaml
uses: escapace/action-setup-vault@v0.1.1
with:
  vault-version: ~1.10.4
```
