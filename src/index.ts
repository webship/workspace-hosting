/**
 * registerHosting(api, provider): the whole surface of a hosting plugin, from a provider's facts.
 *
 * The row menu (linked / unlinked), the live-site chip, the environments modal, the get-database-
 * and-files flow, the branch-and-data command block, the tool verbs as screen sessions, the
 * `/<id>-site/<ws>/<project>` jump, and the New-folder section. Each hosting plugin is this call
 * plus its provider; what differs between hosts is in the provider, what is the same is here.
 */

import fs from 'fs';
import path from 'path';
import type { ActionContext, FolderSetupContext, Form, PluginApi, RowContext } from '@webship.co/workspace-plugin-api';

import type { EnvInfo, HostingLink, HostingProvider } from './provider';

export * from './provider';
export * from './cli';

const registeredCss = new WeakSet<object>();

export function registerHosting(api: PluginApi, p: HostingProvider): void {
  const { esc, workspaceDir, listProjects, isValidWorkspace, screenAction, iconHtml, NAME_RE, ROOT, run, startInScreen, screenStartedHtml, cliError, commandBlock } = api.lib;
  const post = (name: string) => `/actions/p/${api.name}/${name}`;
  const fragment = (rest: string) => `/fragments/p/${api.name}/${rest}`;
  const typeAction = p.typeAction || p.id;
  const can = (allowed: Set<string>, dir: string) => allowed.has(typeAction) && fs.existsSync(path.join(dir, p.script));
  const shq = (v: unknown) => `'${String(v).replace(/'/g, `'\\''`)}'`;

  // The family's stylesheet, once however many providers register.
  if (typeof api.addCss === 'function' && !registeredCss.has(api.addCss)) {
    registeredCss.add(api.addCss);
    api.addCss(path.join(__dirname, '..', '..', 'css', 'hosting.css'));
  }

  // A page of thirty rows must not stat the same files thirty times: the link is memoised briefly.
  let cache = new Map<string, HostingLink | null>();
  let cacheAt = 0;
  const linkOf = (dir: string, project: string): HostingLink | null => {
    const now = Date.now();
    if (now - cacheAt > 5000) { cache = new Map(); cacheAt = now; }
    const k = `${dir}/${project}`;
    if (!cache.has(k)) { try { cache.set(k, p.detect(path.join(dir, project))); } catch (_) { cache.set(k, null); } }
    return cache.get(k) || null;
  };

  const errorText = (out: { stdout?: string; stderr?: string }) => {
    const msg = cliError(String(out.stderr || out.stdout || ''));
    return p.errorHint ? p.errorHint(msg) : msg;
  };

  // The environments and their live URLs, cached: a row cannot pay for CLI calls per render.
  const envCache = new Map<string, EnvInfo>();
  async function environments(dir: string, project: string): Promise<EnvInfo | null> {
    const u = linkOf(dir, project);
    if (!u || !u.id) return null;
    const hit = envCache.get(u.id);
    if (hit) return hit;
    if (!p.environments) return { id: u.id, rows: [], branch: u.branch, env: u.env, why: 'no list' };
    const env = p.jobEnv();
    if (!env) return { id: u.id, rows: [], branch: u.branch, env: u.env, why: 'no token' };
    let info: EnvInfo;
    try { info = await p.environments(u, api.lib, env); } catch (_) { info = { id: u.id, rows: [], why: 'list failed' }; }
    const answer: EnvInfo = { ...info, branch: u.branch, env: u.env };
    envCache.set(u.id, answer);
    // Five minutes: long enough to render a page many times, short enough that a new environment shows.
    setTimeout(() => envCache.delete(u.id as string), 5 * 60 * 1000).unref?.();
    return answer;
  }

  // ---- The menu on a project row ---------------------------------------------------------------

  api.addRowMenu(p.id, { label: p.label, row: 0 }, ({ key, project, dir, allowed, vals }: RowContext) => {
    if (!can(allowed, dir)) return null;
    const u = linkOf(dir, project);
    const caption = !u ? 'not linked' : 'linked';
    const status = p.tools.status;
    if (!u) {
      return `<span class="act-with-status"><div class="uk-inline act-menu act-menu-${esc(p.id)} act-menu-hosting">
          <button class="uk-button uk-button-default uk-button-small hosting-unlinked" type="button" title="Not linked to ${esc(p.title)}"><span uk-icon="icon: cloud-upload; ratio: .7"></span> ${esc(p.label)} <span uk-icon="icon: chevron-down; ratio: .6"></span></button>
          <div uk-dropdown="mode: click; pos: bottom-right"><ul class="uk-nav uk-dropdown-nav">
            <li class="uk-nav-header">Not linked to ${esc(p.title)}</li>
            ${status ? `<li><a href hx-post="${post('tool-status')}" ${vals()}><span uk-icon="icon: info; ratio: .7"></span> ${esc(status.label)}</a></li>` : ''}
            <li class="uk-nav-divider"></li>
            <li class="uk-nav-header hosting-menu-note" data-group="how to link">Link it from ${esc(key)}:<br><code>${esc(p.linkHint(project))}</code></li>
          </ul></div>
        </div><span class="act-status uk-text-meta">${esc(caption)}</span></span>`;
    }
    const idLine = `${esc(u.id || '(no id)')}${u.branch ? ` · <span title="the branch the local code is on">${esc(u.branch)}</span>` : ''}`
      + `${u.mismatch ? ` <span class="uk-label uk-label-danger hosting-mismatch" title="${esc(u.mismatchNote || 'the link and the git remote disagree')}">mismatch</span>` : ''}`;
    const toolItems = Object.entries(p.tools).filter(([k]) => k !== 'status').map(([k, t]) =>
      `<li><a href hx-post="${post(`tool-${k}`)}" ${vals()}><span uk-icon="icon: ${esc(t.icon)}; ratio: .7"></span> ${esc(t.label)}</a></li>`).join('');
    const console = p.consoleUrl ? p.consoleUrl(u) : null;
    return `<span class="act-with-status"><div class="uk-inline act-menu act-menu-${esc(p.id)} act-menu-hosting">
        <button class="uk-button uk-button-default uk-button-small" type="button" title="${esc(p.label)}"><span uk-icon="icon: cloud-upload; ratio: .7"></span> ${esc(p.label)} <span uk-icon="icon: chevron-down; ratio: .6"></span></button>
        <div uk-dropdown="mode: click; pos: bottom-right"><ul class="uk-nav uk-dropdown-nav">
          <li class="uk-nav-header hosting-menu-id" data-group="link">${idLine}</li>
          ${p.environments ? `<li><a href hx-post="${post('envs')}" hx-vals='{"workspace":"${esc(key)}","projectName":"${esc(project)}"}' hx-target="#editor-modal-body" hx-swap="innerHTML"><span uk-icon="icon: world; ratio: .7"></span> Environments and live sites</a></li>
          <li class="uk-nav-header" data-group="live sites">Live sites</li>
          <li data-entry="live sites list"><ul class="uk-nav-sub" hx-get="${fragment(`envs/${encodeURIComponent(key)}/${encodeURIComponent(project)}`)}" hx-trigger="revealed" hx-swap="innerHTML"><li class="uk-nav-header">Loading…</li></ul></li>` : ''}
          ${status ? `<li><a href hx-post="${post('tool-status')}" ${vals()}><span uk-icon="icon: info; ratio: .7"></span> ${esc(status.label)}</a></li>` : ''}
          ${toolItems}
          ${p.pull && (p.pull.db || p.pull.files) ? `<li class="uk-nav-divider"></li>
          <li><a href hx-post="${post('pull-form')}" hx-vals='{"workspace":"${esc(key)}","projectName":"${esc(project)}"}' hx-target="#editor-modal-body" hx-swap="innerHTML"><span uk-icon="icon: cloud-download; ratio: .7"></span> Get ${p.pull.db && p.pull.files ? 'database &amp; files' : p.pull.db ? 'database' : 'files'}…</a></li>
          <li><a href hx-post="${post('environments')}" ${vals()}><span uk-icon="icon: git-branch; ratio: .7"></span> Branch and data…${u.env ? ` <span class="uk-text-meta">(${esc(u.env)})</span>` : ''}</a></li>` : ''}
          ${console ? `<li class="uk-nav-divider"></li><li><a href="${esc(console)}" target="_blank"><span uk-icon="icon: link-external; ratio: .7"></span> Open in the ${esc(p.title)} console</a></li>` : ''}
          ${p.menuNote ? `<li class="uk-nav-header hosting-menu-note">${esc(p.menuNote)}</li>` : ''}
        </ul></div>
      </div><span class="act-status uk-text-meta">${esc(caption)}</span></span>`;
  });

  // ---- The live-site chip on the card ----------------------------------------------------------

  api.addProjectChip(({ key, project, dir }) => {
    const u = linkOf(dir, project);
    if (!u || !p.environments) return null;
    return `<a class="proj-alias proj-plugin-link proj-hosting-link proj-${esc(p.id)}-link" href="/${encodeURIComponent(p.id)}-site/${encodeURIComponent(key)}/${encodeURIComponent(project)}" target="_blank" rel="noopener"
      title="The live ${esc(p.title)} site for the environment this code is on">${iconHtml('tabler:cloud-upload', 0.7)}<span class="pcard-chip-text">${esc(u.branch || u.env || u.id || p.title)}</span></a>`;
  });

  // ---- Tool verbs: the per-workspace command, run as a screen session ---------------------------

  const guard = ({ form, send, workspace }: ActionContext) => {
    const dir = workspaceDir(workspace);
    if (!fs.existsSync(path.join(dir, p.script))) { send(`<div class="msg error">This workspace has no ${esc(p.title)} tool.</div>`, 400); return null; }
    const project = String(form.projectName || '');
    if (!NAME_RE.test(project) || !listProjects(dir).includes(project)) { send('<div class="msg error">Unknown project.</div>', 400); return null; }
    return { dir, project };
  };

  for (const [name, t] of Object.entries(p.tools)) {
    api.addAction(`tool-${name}`, (ctx: ActionContext) => {
      const g = guard(ctx); if (!g) return;
      return screenAction(ctx.send, { workspace: ctx.workspace, project: g.project, projectDir: g.dir,
        ownerDir: path.join(g.dir, g.project), verb: t.verb,
        cmdLine: `bash ${p.script} ${g.project}${t.args.length ? ` ${t.args.join(' ')}` : ''}`,
        label: `${p.id} ${t.label.toLowerCase()}` });
    });
  }

  // ---- Environments: the modal, the list inside the menu, the site jump -------------------------

  api.addAction('envs', async (ctx: ActionContext) => {
    const g = guard(ctx); if (!g) return;
    const u = linkOf(g.dir, g.project);
    if (!u || !u.id) return ctx.send(`<div class="msg error">This project is not linked to a ${esc(p.title)} project.</div>`, 409);
    if (!p.environments) return ctx.send(`<div class="msg error">${esc(p.title)} lists no environments from here.</div>`, 409);
    if (!p.jobEnv()) return ctx.send(`<div class="msg error">No ${esc(p.title)} API token configured (${esc(p.tokenHint)}).</div>`, 409);
    envCache.delete(u.id);
    const info = await environments(g.dir, g.project);
    const rows = (info && info.rows) || [];
    const list = rows.map((r) => `
      <div class="uk-margin-small-bottom">
        ${/^active$/i.test(r.status) ? '<span class="uk-label uk-label-success">active</span>' : `<span class="uk-label">${esc(r.status.toLowerCase())}</span>`}
        <strong>${esc(r.title)}</strong>${r.title !== r.envId ? ` <span class="uk-text-meta">(${esc(r.envId)})</span>` : ''}
        ${r.envId === u.branch ? '<span class="uk-text-meta">· the local code is on this branch</span>' : ''}
        ${r.url ? `· <a href="${esc(r.url)}" target="_blank">${esc(r.url)}</a>` : ''}
      </div>`).join('');
    return ctx.send(`
      <div class="editor-card">
        <h3 class="uk-margin-small-bottom">Environments — ${esc(g.project)}</h3>
        <p class="uk-text-meta">${esc(p.title)} project <code>${esc(u.id)}</code>. Each active environment with its live site.</p>
        ${list || `<div class="msg error">No environments${info && info.why ? ` (${esc(info.why)})` : ''}.</div>`}
      </div>`);
  });

  api.addFragment(async ({ send, rest }) => {
    const m = rest.match(/^envs\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
    if (!m || !isValidWorkspace(m[1])) return send('', 404);
    const info = await environments(workspaceDir(m[1]), m[2]);
    const rows = (info && info.rows) || [];
    const items = rows.map((r) => {
      const here = r.envId === (info!.branch || info!.env);
      return r.url
        ? `<li><a href="${esc(r.url)}" target="_blank" title="${esc(r.url)}"><span uk-icon="icon: link-external; ratio: .7"></span> ${esc(r.title)}${here ? ' <span class="uk-text-meta">(this code)</span>' : ''}</a></li>`
        : `<li><span class="uk-text-meta"><span uk-icon="icon: ban; ratio: .7"></span> ${esc(r.title)} — ${esc((r.status || '').toLowerCase())}</span></li>`;
    }).join('');
    send(items || `<li class="uk-nav-header">${info && info.why === 'no token' ? `No ${esc(p.title)} API token (${esc(p.tokenHint)})` : 'No environments'}</li>`);
  });

  api.addPage(new RegExp(`^\\/${p.id}-site\\/([a-z0-9_-]+)\\/([a-zA-Z0-9_-]+)$`), async ({ res, match }) => {
    if (!isValidWorkspace(match[1])) { res.writeHead(404); return res.end(); }
    const info = await environments(workspaceDir(match[1]), match[2]);
    const want = info && (info.branch || info.env || 'main');
    const row = info && (info.rows.find((r) => r.envId === want && r.url) || info.rows.find((r) => r.url));
    if (row) { res.writeHead(302, { Location: row.url as string }); return res.end(); }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<p>No live ${esc(p.title)} URL for ${esc(match[2])}${info && info.why ? ` (${esc(info.why)})` : ''}.</p>`);
  });

  // ---- Branch and data: the commands, shown rather than run --------------------------------------

  api.addAction('environments', (ctx: ActionContext) => {
    const g = guard(ctx); if (!g) return;
    const u = linkOf(g.dir, g.project);
    if (!u || !u.id) return ctx.send(`<div class="msg error">This project is not linked to a ${esc(p.title)} project.</div>`, 409);
    const cd = `cd ${ROOT}/${ctx.workspace}`;
    const lines = [`${cd} && bash ${p.script} ${g.project} --environments`, `${cd} && bash ${p.script} ${g.project} --select <environment>`];
    if (p.pull && p.pull.db) lines.push(`${cd} && bash ${p.script} ${g.project} --pull-db`);
    if (p.pull && p.pull.files) lines.push(`${cd} && bash ${p.script} ${g.project} --pull-files`);
    return ctx.send(commandBlock(`Branch and data for ${g.project} on ${p.title} ${u.id}`, lines,
      `${u.env ? `Currently working against <strong>${esc(u.env)}</strong>. ` : 'No environment selected yet — a pull refuses to guess which branch it takes data from. '}`
      + 'Run these <strong>on the host</strong>: these are cloud credentials for client projects. A database pull REPLACES the local database '
      + '(the current one is exported to <code>backups/</code> first) and a files pull adds and overwrites the public files mount. '
      + 'Both bring client data onto this machine — sanitize before sharing.'));
  });

  // ---- Get database and files -------------------------------------------------------------------

  if (p.pull && (p.pull.db || p.pull.files)) {
    const pull = p.pull;
    api.addAction('pull-form', async (ctx: ActionContext) => {
      const g = guard(ctx); if (!g) return;
      const u = linkOf(g.dir, g.project);
      if (!u || !u.id) return ctx.send(`<div class="msg error">This project is not linked to a ${esc(p.title)} project.</div>`, 409);
      const env = p.jobEnv();
      if (!env) return ctx.send(`<div class="msg error">No ${esc(p.title)} API token configured — ${esc(p.tokenHint)}.</div>`, 409);
      envCache.delete(u.id);
      const info = await environments(g.dir, g.project);
      const all = (info && info.rows) || [];
      const envs = all.filter((r) => /^active$/i.test(r.status)).map((r) => r.envId);
      const inactive = all.length - envs.length;
      if (!envs.length) return ctx.send(`<div class="msg error">No ACTIVE environments on this project${all.length ? ` (${all.length} inactive)` : ''}${info && info.why ? ` — ${esc(info.why)}` : ''}.</div>`, 409);
      const isGit = fs.existsSync(path.join(g.dir, g.project, '.git'));
      return ctx.send(`
    <div class="editor-card">
      <h3 class="uk-margin-small-bottom">Get ${pull.db && pull.files ? 'database &amp; files' : pull.db ? 'database' : 'files'} — ${esc(g.project)}</h3>
      <p class="uk-text-meta">From ${esc(p.title)} project <code>${esc(u.id)}</code> into the local DDEV site.
        ${pull.db ? 'The local database is REPLACED (the current one is exported to <code>backups/</code> first); ' : ''}${pull.files ? 'files are added and overwritten, never deleted. ' : ''}Client data lands on this machine.</p>
      <form hx-post="${post('pull')}" hx-target="#editor-modal-body" hx-swap="innerHTML">
        <input type="hidden" name="workspace" value="${esc(ctx.workspace)}">
        <input type="hidden" name="projectName" value="${esc(g.project)}">
        <label class="uk-form-label">Active environment to sync from
          <select class="uk-select uk-margin-small-bottom" name="environment">
            ${envs.map((e) => `<option value="${esc(e)}"${e === (u.env || u.branch || 'main') ? ' selected' : ''}>${esc(e)}</option>`).join('')}
          </select>
          ${inactive ? `<span class="uk-text-meta">${inactive} inactive environment${inactive > 1 ? 's' : ''} not offered.</span>` : ''}
        </label>
        ${pull.db ? '<label><input class="uk-checkbox" type="checkbox" name="db" checked> Database</label>' : ''}
        ${pull.files ? '<label class="uk-margin-left"><input class="uk-checkbox" type="checkbox" name="files" checked> Files</label>' : ''}
        ${isGit && pull.gitRemote
    ? `<label class="uk-margin-left"><input class="uk-checkbox" type="checkbox" name="switch" checked> Switch the local code to this branch</label>
             <div class="uk-text-meta">Uncommitted local changes are stashed first (recover with <code>git stash pop</code>), then the code switches. After the pull, caches are rebuilt and the local site is checked.</div>`
    : '<div class="uk-text-meta">The code stays as it is; caches are rebuilt and the local site checked after the pull.</div>'}
        ${pull.db && pull.noSafetyBackupArg ? `<label class="uk-margin-small uk-display-block">
          <input class="uk-checkbox" type="checkbox" name="backup" value="yes" checked>
          Back up the local database into <code>backups/${esc(ctx.workspace)}/${esc(g.project)}/</code> first
        </label>` : ''}
        <label class="uk-margin-small uk-display-block">
          <input class="uk-checkbox" type="checkbox" name="confirm" value="yes" required>
          I confirm: data from <strong>${esc(p.title)}</strong> replaces this local DDEV site's data
        </label>
        <div class="uk-margin-small-top">
          <button type="submit" class="uk-button uk-button-primary"><span uk-icon="icon: cloud-download; ratio: .8"></span> Get it</button>
        </div>
      </form>
    </div>`);
    });

    api.addAction('pull', async (ctx: ActionContext) => {
      const g = guard(ctx); if (!g) return;
      const { form, send, workspace } = ctx;
      const environment = String(form.environment || '').trim();
      const wantDb = pull.db && form.db !== undefined;
      const wantFiles = pull.files && form.files !== undefined;
      if (!/^[a-zA-Z0-9._\/-]+$/.test(environment)) return send('<div class="msg error">Not an environment name.</div>', 400);
      const u = linkOf(g.dir, g.project);
      if (!u || !u.id) return send(`<div class="msg error">This project is not linked to a ${esc(p.title)} project.</div>`, 409);
      const env = p.jobEnv();
      if (!env) return send(`<div class="msg error">No ${esc(p.title)} API token configured (${esc(p.tokenHint)}).</div>`, 409);
      if (p.environmentActive && !(await p.environmentActive(u, environment, api.lib, env))) {
        return send(`<div class="msg error">${esc(environment)} is not active — nothing running to sync from.</div>`, 409);
      }
      if (!wantDb && !wantFiles) return send('<div class="msg error">Pick the database, the files, or both.</div>', 400);
      const confirmed = ([] as unknown[]).concat(form.confirm || '').includes('yes');
      if (!confirmed) return send('<div class="msg error">Syncing replaces local data — it requires confirmation.</div>', 400);
      const wantSwitch = !!pull.gitRemote && form.switch !== undefined && fs.existsSync(path.join(g.dir, g.project, '.git'));
      const parts = [
        `echo "Starting DDEV for ${g.project}…" && (cd ${g.project} && ddev start -y > /dev/null && ddev describe > /dev/null) && echo "DDEV is up and healthy."`,
      ];
      if (wantSwitch) {
        parts.push([
          `cd ${g.project}`,
          `if [ -n "$(git status --porcelain)" ]; then STASH_NAME="${p.id}-pull $(date +%Y-%m-%d-%H%M%S)" && git stash push --include-untracked -m "$STASH_NAME" && echo "Local changes stashed as: $STASH_NAME (git stash pop brings them back)"; fi`,
          `echo "Switching the code to ${environment}…"`,
          `git fetch ${pull.gitRemote} ${environment}`,
          `(git checkout ${environment} 2>/dev/null || git checkout -b ${environment} ${pull.gitRemote}/${environment})`,
          `git pull --ff-only ${pull.gitRemote} ${environment}`,
          `echo "Code is on ${environment}."`,
          'cd ..',
        ].join(' && '));
      }
      const noSafety = pull.noSafetyBackupArg && form.backup === undefined ? ` ${pull.noSafetyBackupArg}` : '';
      if (wantDb) parts.push(`bash ${p.script} ${g.project} ${pull.dbArgs(environment).join(' ')}${noSafety}`);
      if (wantFiles) parts.push(`bash ${p.script} ${g.project} ${pull.filesArgs(environment).join(' ')}`);
      parts.push([
        `cd ${g.project}`,
        'echo "Rebuilding caches (drush cr)…"',
        'ddev drush cr > /dev/null 2>&1 || echo "drush cr failed — not a Drupal site, or the codebase does not match the database"',
        `for i in 1 2 3 4 5 6 7 8 9 10; do code=$(curl -sk -o /dev/null -w "%{http_code}" "https://${g.project}.ddev.site/"); case "$code" in 200|301|302|303) break ;; esac; sleep 3; done`,
        `echo "Local site check: https://${g.project}.ddev.site/ answered $code"`,
        'case "$code" in 200|301|302|303) echo "✅ The local site is working." ;; *) echo "⚠️ The local site did not answer cleanly (${code:-no response after 30s}) — check ddev logs." ;; esac',
      ].join(' && '));
      const started = await startInScreen({ workspace, project: g.project, projectDir: g.dir, ownerDir: path.join(g.dir, g.project),
        verb: `${p.id}-pull-${environment}`, cmdLine: parts.join(' && '),
        label: `get ${wantDb ? 'database' : ''}${wantDb && wantFiles ? ' + ' : ''}${wantFiles ? 'files' : ''} from ${environment}` });
      return send(screenStartedHtml(started, `${p.id} pull from ${environment}`, g.project), started.ok ? 200 : (started.already ? 409 : 500));
    });
    void run; void errorText;
  }

  // ---- New folder: link it to a project, or create one with AI ----------------------------------

  if (p.folder) {
    const f = p.folder;
    api.addFolderSetup({
      html: (ws: string, { allowed }: FolderSetupContext) => {
        if (!can(allowed, workspaceDir(ws))) return '';
        return `<div class="uk-margin-small-top folder-hosting folder-${esc(p.id)}">
            <span class="uk-text-meta">${esc(p.title)}:</span>
            <label class="uk-margin-small-right"><input class="uk-radio" type="radio" name="${esc(p.id)}" value="none" checked> Not now</label>
            <label class="uk-margin-small-right"><input class="uk-radio" type="radio" name="${esc(p.id)}" value="link"> Link to an existing project</label>
            ${f.createPrompt ? `<label><input class="uk-radio" type="radio" name="${esc(p.id)}" value="create"> Create a new project and deploy it, with AI (it asks before creating anything billed)</label>` : ''}
            <div class="folder-hosting-id uk-margin-small-top">
              <label class="uk-form-label" for="folder-${esc(p.id)}-id">${esc(p.title)} project id</label>
              <input class="uk-input uk-form-small uk-form-width-medium" id="folder-${esc(p.id)}-id" name="${esc(p.id)}_id"
                     pattern="${esc(f.idPattern.source)}" placeholder="${esc(f.idPlaceholder)}">
            </div>
          </div>`;
      },
      steps: (ws: string, name: string, form: Form, { allowed }: FolderSetupContext) => {
        if (form[p.id] !== 'link' || !can(allowed, workspaceDir(ws))) return [];
        return [`( cd ${shq(name)} && { git rev-parse --git-dir >/dev/null 2>&1 || git init -q; } )`,
          `bash ${p.script} ${shq(name)} --link ${shq(form[`${p.id}_id`])}`];
      },
      prompt: (_ws: string, _name: string, form: Form) => (form[p.id] === 'create' && f.createPrompt ? [f.createPrompt] : []),
      problem: (ws: string, form: Form, { allowed }: FolderSetupContext) => {
        if (form[p.id] !== 'link' && form[p.id] !== 'create') return '';
        if (!can(allowed, workspaceDir(ws))) return `This workspace does not link projects to ${p.title}.`;
        if (form[p.id] === 'link' && !f.idPattern.test(String(form[`${p.id}_id`] || ''))) return f.idHelp;
        return '';
      },
    });
  }
}
