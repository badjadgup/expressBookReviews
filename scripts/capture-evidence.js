// Run from final_project with npm run evidence. Starts a fresh in-memory server.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const app = require('../final_project');
const root = path.resolve(__dirname, '..');
const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
const cookie = '.evidence-cookies';
async function capture(name, args, expected) {
  const commandArgs = ['--silent', '--show-error', '--fail-with-body', ...args, '--write-out', '\nHTTP_STATUS:%{http_code}\n'];
  const child = spawn(curl, commandArgs, { cwd: root });
  let output = '', error = '';
  child.stdout.on('data', chunk => output += chunk);
  child.stderr.on('data', chunk => error += chunk);
  const [code] = await once(child, 'close');
  if (code !== 0 || !output.includes('HTTP_STATUS:' + expected)) throw new Error(name + ': ' + output + error);
  const quote = value => /[\s"{}]/.test(value) ? JSON.stringify(value) : value;
  // Render a pasteable PowerShell command. The write-out format stays literal.
  const rendered = commandArgs.map(arg => arg === '\nHTTP_STATUS:%{http_code}\n' ? '"\\nHTTP_STATUS:%{http_code}\\n"' : quote(arg));
  return '$ ' + curl + ' ' + rendered.join(' ') + '\n\n' + output.trimEnd() + '\n';
}
async function main() {
  const server = app.listen(Number(process.env.PORT || 5000), '127.0.0.1');
  try {
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    const save = async (name, args, code = 200) => fs.writeFileSync(path.join(root, name), await capture(name, args, code));
    await save('getallbooks', [base + '/']);
    await save('getbooksbyISBN', [base + '/isbn/1']);
    await save('getbooksbyauthor', [base + '/author/Unknown']);
    await save('getbooksbytitle', [base + '/title/Things%20Fall%20Apart']);
    await save('getbookreview', [base + '/review/1']);
    const json = ['--header', 'Content-Type: application/json'];
    await save('register', ['--request', 'POST', ...json, '--data-binary', '@scripts/payloads/register.json', base + '/register'], 201);
    await save('login', ['--request', 'POST', ...json, '--data-binary', '@scripts/payloads/register.json', '--cookie-jar', cookie, base + '/customer/login']);
    let reviewEvidence = await capture('reviewadded', ['--request', 'PUT', ...json, '--cookie', cookie, '--data-binary', '@scripts/payloads/review.json', base + '/customer/auth/review/1'], 200);
    reviewEvidence += '\n' + await capture('reviewadded', ['--request', 'PUT', ...json, '--cookie', cookie, '--data-binary', '@scripts/payloads/modified-review.json', base + '/customer/auth/review/1'], 200);
    reviewEvidence += '\n' + await capture('reviewadded', [base + '/review/1'], 200);
    fs.writeFileSync(path.join(root, 'reviewadded'), reviewEvidence);
    let deletion = await capture('deletereview', ['--request', 'DELETE', '--cookie', cookie, base + '/customer/auth/review/1'], 200);
    deletion += '\n' + await capture('deletereview', [base + '/review/1'], 200);
    fs.writeFileSync(path.join(root, 'deletereview'), deletion);
    console.log('Captured real cURL command/output files for questions 2-10.');
  } finally {
    fs.rmSync(path.join(root, cookie), { force: true });
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
