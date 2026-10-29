// Usage: npm run evidence:github -- OWNER/REPOSITORY
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2];
if (!repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
  console.error('Usage: npm run evidence:github -- OWNER/REPOSITORY');
  process.exit(1);
}
const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
const url = 'https://api.github.com/repos/' + repo;
const args = ['--silent', '--show-error', '--fail-with-body', '--location', '--header', 'Accept: application/vnd.github+json', url];
const result = spawnSync(curl, args, { encoding: 'utf8' });
if (result.error || result.status !== 0) {
  console.error('Cannot read public repository. Create a PUBLIC fork first.', result.error?.message || result.stderr || result.stdout);
  process.exit(1);
}
const metadata = JSON.parse(result.stdout);
const upstream = 'ibm-developer-skills-network/expressBookReviews';
if (!metadata.fork || metadata.parent?.full_name !== upstream) {
  console.error('Repository must be a direct fork of ' + upstream + '. No evidence was written.');
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const command = curl + ' --silent --show-error --fail-with-body --location --header "Accept: application/vnd.github+json" ' + url;
fs.writeFileSync(path.join(root, 'githubrepo'), '$ ' + command + '\n\n' + result.stdout.trimEnd() + '\n');
const generalUrl = metadata.html_url + '/blob/' + metadata.default_branch + '/final_project/router/general.js';
fs.writeFileSync(path.join(root, 'general-url.txt'), generalUrl + '\n');
console.log('Verified fork; saved real GitHub API response in githubrepo.');
console.log('Q11 URL (upload files first): ' + generalUrl);
