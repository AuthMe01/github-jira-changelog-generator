# Github Jira Changelog Generator

從 Github Changelog Generator 的 ouput 再去產生 Jira Changelog

## Inputs

### `host`
**Required** The host of Jira Project.

### `userName`
**Required** The user name of Jira account.

### `password`
**Required** The password or token of Jira account.

### `projectKey`
**Required** The key of Jira project.

### `fileName`
**Required** The file name of changelog.

## Outputs

## Example usage

```yaml
uses: actions/github-jira-generator@v1.0
with:
  host: 'authme01.atlassian.net'
  userName: 'lutas.lin@authme.com'
  password: 'token'
  projectKey: 'PROD'
```