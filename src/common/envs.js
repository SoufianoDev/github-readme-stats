// @ts-check

const getWhitelist = () =>
  process.env.WHITELIST
    ? process.env.WHITELIST.split(",")
    : undefined;

const getGistWhitelist = () =>
  process.env.GIST_WHITELIST
    ? process.env.GIST_WHITELIST.split(",")
    : undefined;

const getExcludeRepositories = () =>
  process.env.EXCLUDE_REPO
    ? process.env.EXCLUDE_REPO.split(",")
    : [];

export { getWhitelist as whitelist, getGistWhitelist as gistWhitelist, getExcludeRepositories as excludeRepositories };
