import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
if (!stdin.isTTY) { console.error('Execute em um terminal interativo para definir o acesso sem exibir a senha.'); process.exit(1); }
let muted = false;
const output = new Writable({ write(chunk, encoding, done) { if (!muted) stdout.write(chunk, encoding); done(); } });
const rl = createInterface({ input: stdin, output, terminal: true });
async function passwordQuestion(prompt) {
  stdout.write(prompt); muted = true;
  try { return await rl.question(''); } finally { muted = false; stdout.write('\n'); }
}
try {
  const path = new URL('../.env.local', import.meta.url);
  let existing = '';
  try { existing = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (/^ESCALA_(ADMIN_EMAIL|ADMIN_PASSWORD_HASH|SESSION_SECRET)=/m.test(existing)) {
    const confirm = await rl.question('Já existe um acesso local. Substituir e invalidar as sessões? [s/N] ');
    if (confirm.toLowerCase() !== 's') process.exit(0);
  }
  const email = (await rl.question('E-mail do administrador: ')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  const password = await passwordQuestion('Senha (12 a 256 caracteres; não será exibida): ');
  if (password.length < 12 || password.length > 256) throw new Error('A senha precisa ter entre 12 e 256 caracteres.');
  const confirm = await passwordQuestion('Confirme a senha: ');
  if (password !== confirm) throw new Error('As senhas não coincidem.');
  const salt = randomBytes(16).toString('hex');
  const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
  // Next.js expands dollar signs in .env files; escape them in the stored hash.
  const retained = existing.split('\n').filter(line => !/^ESCALA_(ADMIN_EMAIL|ADMIN_PASSWORD_HASH|SESSION_SECRET)=/.test(line)).join('\n').trimEnd();
  const entries = `ESCALA_ADMIN_EMAIL=${JSON.stringify(email).replace(/\$/g, '\\$')}\nESCALA_ADMIN_PASSWORD_HASH="${hash.replace(/\$/g, '\\$')}"\nESCALA_SESSION_SECRET="${randomBytes(32).toString('hex')}"\n`;
  await writeFile(path, (retained ? retained + '\n' : '') + entries, { mode: 0o600 });
  await chmod(path, 0o600);
  console.log('Acesso configurado em .env.local. Reinicie o servidor. Nenhuma senha em texto puro foi salva.');
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { rl.close(); }
