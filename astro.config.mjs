// @ts-check
import { defineConfig } from 'astro/config';

const isGithubPages = process.env.GITHUB_PAGES === 'true';
const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER;
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isUserSite = repositoryOwner && repositoryName === `${repositoryOwner}.github.io`;

// https://astro.build/config
export default defineConfig({
	...(isGithubPages && repositoryOwner ? { site: `https://${repositoryOwner}.github.io` } : {}),
	base: isGithubPages && repositoryName && !isUserSite ? `/${repositoryName}` : '/',
});
