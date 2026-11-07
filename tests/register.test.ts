import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { registerHosting } from '../src/index';
import type { HostingProvider } from '../src/index';

function fakeApi(root: string) {
  const calls: Record<string, any> = { rowMenus: {}, chips: [], actions: {}, fragments: [], pages: [], setups: [], css: [] as string[] };
  const api: any = {
    name: 'acme',
    config: {},
    settings: { file: 'plugin.acme.settings.yml', read: () => ({}), set() {}, setList() {} },
    lib: {
      esc: (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)),
      ROOT: root,
      workspaceDir: (ws: string) => path.join(root, ws),
      listProjects: (dir: string) => fs.readdirSync(dir),
      isValidWorkspace: (ws: string) => /^[a-z0-9_-]+$/.test(ws),
      screenAction: (send: any, o: any) => { calls.screen = o; send('started'); },
      iconHtml: (name: string) => `<i data-icon="${name}"></i>`,
      NAME_RE: /^[a-zA-Z0-9_-]+$/,
      run: async () => ({ ok: true, code: 0, stdout: '', stderr: '' }),
      startInScreen: async (o: any) => { calls.started = o; return { ok: true, session: 's' }; },
      screenStartedHtml: (s: any) => `started:${s.ok}`,
      cliError: (s: string) => s,
      commandBlock: (title: string, lines: string[]) => `<pre>${title}\n${lines.join('\n')}</pre>`,
    },
    addRowMenu: (slot: string, spec: any, fn: any) => { calls.rowMenus[slot] = { spec, fn }; },
    addProjectChip: (fn: any) => calls.chips.push(fn),
    addAction: (name: string, fn: any) => { calls.actions[name] = fn; },
    addFragment: (fn: any) => calls.fragments.push(fn),
    addPage: (re: RegExp, fn: any) => calls.pages.push({ re, fn }),
    addFolderSetup: (s: any) => calls.setups.push(s),
    addCss: (f: string) => calls.css.push(f),
  };
  return { api, calls };
}

function provider(linked: boolean, token = true): HostingProvider {
  return {
    id: 'acme', label: 'ACME', title: 'Acme Cloud', script: 'cmd-tools-acme.sh',
    detect: () => (linked ? { id: 'app-1', branch: 'main', env: 'staging' } : null),
    linkHint: (p) => `bash cmd-tools-acme.sh ${p} --link <id>`,
    consoleUrl: (l) => `https://console.acme.test/${l.id}`,
    jobEnv: () => (token ? { ...process.env, ACME_TOKEN: 't' } : null),
    tokenHint: 'token in plugin.acme.settings.yml',
    environments: async () => ({ id: 'app-1', rows: [{ title: 'Staging', envId: 'staging', status: 'active', url: 'https://staging.acme.test' }, { title: 'Dev', envId: 'dev', status: 'paused' }] }),
    tools: { status: { verb: 'acme', label: 'Link and environments', icon: 'info', args: [] }, logs: { verb: 'acme-logs', label: 'Most recent deploy log', icon: 'file-text', args: ['--logs'] } },
    pull: { db: true, files: true, dbArgs: (e) => ['--environment', e, '--pull-db'], filesArgs: (e) => ['--environment', e, '--pull-files'], gitRemote: 'acme', noSafetyBackupArg: '--no-safety-backup' },
    folder: { idPattern: /^[a-z0-9]{8,20}$/, idPlaceholder: 'abcdefgh1234', idHelp: 'An Acme project id is 8 to 20 lowercase letters and digits.', createPrompt: 'Create a new Acme project and deploy it.' },
    menuNote: 'Deploying stays on the command line',
  };
}

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-'));
  fs.mkdirSync(path.join(root, 'dev', 'site1'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dev', 'cmd-tools-acme.sh'), '#!/usr/bin/env bash\n');
  return root;
}

const row = (root: string) => ({ key: 'dev', project: 'site1', dir: path.join(root, 'dev'), meta: {}, allowed: new Set(['acme']), vals: () => "hx-vals='{}'" });

test('the provider gets the whole surface: menu slot, chip, actions, fragment, page, folder section', () => {
  const { api, calls } = fakeApi(tree());
  registerHosting(api, provider(true));
  assert.deepStrictEqual(Object.keys(calls.rowMenus), ['acme']);
  assert.deepStrictEqual(calls.rowMenus.acme.spec, { label: 'ACME', row: 0 });
  assert.deepStrictEqual(Object.keys(calls.actions).sort(), ['environments', 'envs', 'pull', 'pull-form', 'tool-logs', 'tool-status']);
  assert.strictEqual(calls.chips.length, 1);
  assert.strictEqual(calls.fragments.length, 1);
  assert.ok(calls.pages[0].re.test('/acme-site/dev/site1'));
  assert.strictEqual(calls.setups.length, 1);
  assert.ok(calls.css[0].endsWith('/css/hosting.css') && fs.existsSync(calls.css[0]), 'the family stylesheet is registered and ships');
});

test('an unlinked project gets the menu with the link step; a linked one gets environments, tools, pull and the console', () => {
  const root = tree();
  const un = fakeApi(root); registerHosting(un.api, provider(false));
  const html = un.calls.rowMenus.acme.fn(row(root));
  assert.match(html, /Not linked to Acme Cloud/);
  assert.match(html, /bash cmd-tools-acme\.sh site1 --link &lt;id&gt;/);
  assert.match(html, /not linked/);
  const li = fakeApi(root); registerHosting(li.api, provider(true));
  const linked = li.calls.rowMenus.acme.fn(row(root));
  assert.match(linked, /app-1/);
  assert.match(linked, /\/actions\/p\/acme\/envs/);
  assert.match(linked, /\/actions\/p\/acme\/tool-logs/);
  assert.match(linked, /Get database &amp; files/);
  assert.match(linked, /https:\/\/console\.acme\.test\/app-1/);
  assert.match(linked, /Deploying stays on the command line/);
  assert.strictEqual(li.calls.rowMenus.acme.fn({ ...row(root), allowed: new Set() }), null, 'a type that does not allow it gets nothing');
});

test('the environments fragment and the site jump come from the provider, and a missing token is said', async () => {
  const root = tree();
  const { api, calls } = fakeApi(root); registerHosting(api, provider(true));
  let out = '';
  await calls.fragments[0]({ send: (h: string) => { out = h; }, rest: 'envs/dev/site1' });
  assert.match(out, /https:\/\/staging\.acme\.test/);
  assert.match(out, /Dev — paused/);
  let location = '';
  await calls.pages[0].fn({ res: { writeHead: (_c: number, h: any) => { location = (h && h.Location) || ''; }, end() {} }, match: ['', 'dev', 'site1'] });
  assert.strictEqual(location, 'https://staging.acme.test', 'the environment the local tooling works against');
  const none = fakeApi(root); registerHosting(none.api, provider(true, false));
  await none.calls.fragments[0]({ send: (h: string) => { out = h; }, rest: 'envs/dev/site1' });
  assert.match(out, /No Acme Cloud API token \(token in plugin\.acme\.settings\.yml\)/);
});

test('a tool verb runs the per-workspace command in a screen on the project', async () => {
  const root = tree();
  const { api, calls } = fakeApi(root); registerHosting(api, provider(true));
  let out = '';
  await calls.actions['tool-logs']({ form: { projectName: 'site1' }, send: (h: string) => { out = h; }, workspace: 'dev' });
  assert.strictEqual(out, 'started');
  assert.strictEqual(calls.screen.cmdLine, 'bash cmd-tools-acme.sh site1 --logs');
  assert.strictEqual(calls.screen.verb, 'acme-logs');
  await calls.actions['tool-logs']({ form: { projectName: 'nope' }, send: (h: string) => { out = h; }, workspace: 'dev' });
  assert.match(out, /Unknown project/);
});

test('the pull needs an active environment, a choice and a confirmation, then runs the provider\'s flags', async () => {
  const root = tree();
  fs.mkdirSync(path.join(root, 'dev', 'site1', '.git'));
  const { api, calls } = fakeApi(root); registerHosting(api, provider(true));
  let out = '';
  const send = (h: string) => { out = h; };
  await calls.actions['pull-form']({ form: { projectName: 'site1' }, send, workspace: 'dev' });
  assert.match(out, /<option value="staging" selected>/);
  assert.match(out, /name="switch"/);
  await calls.actions.pull({ form: { projectName: 'site1', environment: 'staging', db: '', files: '' }, send, workspace: 'dev' });
  assert.match(out, /requires confirmation/);
  await calls.actions.pull({ form: { projectName: 'site1', environment: 'staging', db: '', files: '', confirm: 'yes', switch: '', backup: 'yes' }, send, workspace: 'dev' });
  assert.strictEqual(out, 'started:true');
  assert.match(calls.started.cmdLine, /git fetch acme staging/);
  assert.match(calls.started.cmdLine, /bash cmd-tools-acme\.sh site1 --environment staging --pull-db && bash cmd-tools-acme\.sh site1 --environment staging --pull-files/);
  assert.doesNotMatch(calls.started.cmdLine, /--no-safety-backup/, 'the backup was asked for');
  assert.strictEqual(calls.started.verb, 'acme-pull-staging');
});

test('the New-folder section links by id, creates with AI, and refuses a bad id', () => {
  const root = tree();
  const { api, calls } = fakeApi(root); registerHosting(api, provider(true));
  const [s] = calls.setups;
  const ctx = { allowed: new Set(['acme']) };
  assert.match(s.html('dev', ctx), /name="acme" value="link"/);
  assert.match(s.html('dev', ctx), /value="create"/);
  assert.deepStrictEqual(s.steps('dev', 'n', { acme: 'link', acme_id: 'abcdefgh1234' }, ctx).slice(-1), ["bash cmd-tools-acme.sh 'n' --link 'abcdefgh1234'"]);
  assert.deepStrictEqual(s.prompt('dev', 'n', { acme: 'create' }), ['Create a new Acme project and deploy it.']);
  assert.match(s.problem('dev', { acme: 'link', acme_id: 'BAD' }, ctx), /8 to 20 lowercase/);
  assert.strictEqual(s.problem('dev', {}, ctx), '');
});

test('findCli looks in the host mount, ~/.local/bin and PATH; configured() refuses the placeholder', () => {
  const { findCli, configured } = require('../src/cli');
  assert.ok(findCli('sh'), 'sh is on PATH');
  assert.strictEqual(findCli('no-such-cli-xyz'), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'));
  fs.writeFileSync(path.join(dir, 'acme'), '#!/bin/sh\n', { mode: 0o755 });
  assert.strictEqual(findCli('acme', [path.join(dir, 'acme')]), path.join(dir, 'acme'));
  assert.strictEqual(configured('CHANGE_ME'), null);
  assert.strictEqual(configured(' tok '), 'tok');
});
