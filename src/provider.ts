/**
 * What a hosting provider is, to the dashboard.
 *
 * A project lives on one host. A provider knows how to tell that a project is linked to it (a file
 * the CLI wrote, a git remote), what its environments are and where they answer, how to fetch a
 * database and the files, how to deploy, and how to read its logs. The row menu, the modal, the
 * actions and the New-folder section are the family's (registerHosting); the provider supplies the
 * facts and the commands. Upsun is the reference implementation.
 */

import type { PluginLib } from '@webship/workspace-plugin-api';

/** A project's link to the host: what the provider's CLI or config says it is. */
export interface HostingLink {
  /** The project's id on the host (an Upsun project id, an Acquia application uuid, a DO app id…). */
  id: string | null;
  /** The environment the local tooling works against, when one was selected. */
  env?: string | null;
  /** The branch the local code is on, when the project is a git clone. */
  branch?: string | null;
  host?: string | null;
  remote?: string | null;
  /** The link and the git remote disagree (a deploy would go somewhere other than the id says). */
  mismatch?: boolean;
  mismatchNote?: string;
}

export interface EnvRow {
  title: string;
  envId: string;
  /** 'active' means running; anything else is listed without a link. */
  status: string;
  url?: string;
}

export interface EnvInfo {
  id: string | null;
  rows: EnvRow[];
  branch?: string | null;
  env?: string | null;
  /** Why there are no rows: 'no token', 'list failed', 'not linked'. */
  why?: string;
}

/** A verb the per-workspace command carries, run in a screen session on the project. */
export interface ToolVerb {
  /** The screen verb suffix (`upsun-logs`). */
  verb: string;
  /** What the menu calls it. */
  label: string;
  /** An icon name for the menu (`file-text`). */
  icon: string;
  /** The flags appended to `bash <script> <project>`. */
  args: string[];
}

export interface PullSpec {
  /** The provider can bring the database down. */
  db: boolean;
  /** The provider can bring the public files down. */
  files: boolean;
  /** The flags of the per-workspace command for each pull, given the environment. */
  dbArgs: (env: string) => string[];
  filesArgs: (env: string) => string[];
  /** The git remote the local code may be switched to the environment's branch from, if any. */
  gitRemote?: string;
  /** The flag that skips the safety export of the local database before --pull-db, if the command has one. */
  noSafetyBackupArg?: string;
}

export interface HostingProvider {
  /** The slot, the settings key and the route namespace: 'upsun'. */
  id: string;
  /** The button's text: 'UPSUN'. */
  label: string;
  /** The product's name in sentences: 'Upsun'. */
  title: string;
  /** The CLI the actions run inside the dashboard container, when there is one. */
  cli?: string;
  /** The per-workspace command the plugin installs: 'cmd-tools-upsun.sh'. */
  script: string;
  /** The type action a workspace must allow: usually the id. */
  typeAction?: string;
  /** Whether a project is linked, and to what. Memoised by the caller per render. */
  detect: (projectDir: string) => HostingLink | null;
  /** How to link an unlinked project, from the workspace folder. */
  linkHint: (project: string) => string;
  /** The provider's console page for a linked project, or null. */
  consoleUrl?: (link: HostingLink) => string | null;
  /** The environment the actions inject (an API token from the plugin's settings), or null when there is none. */
  jobEnv: () => NodeJS.ProcessEnv | null;
  /** Where the token goes, for the message when there is none. */
  tokenHint: string;
  /** The environments and their live URLs. Omitted: the provider lists none. */
  environments?: (link: HostingLink, lib: PluginLib, env: NodeJS.ProcessEnv) => Promise<EnvInfo>;
  /** Whether an environment is active, before a pull; omitted: assumed. */
  environmentActive?: (link: HostingLink, envId: string, lib: PluginLib, env: NodeJS.ProcessEnv) => Promise<boolean>;
  /** The verbs the menu offers through the per-workspace command (status, activities, logs, deploy…). */
  tools: Record<string, ToolVerb>;
  /** Getting a database and files down, when the provider can. */
  pull?: PullSpec;
  /** The provider's own reading of a CLI failure, for the one message that matters. */
  errorHint?: (message: string) => string;
  /** The New-folder section: link an existing project (id pattern), or create one with AI. */
  folder?: { idPattern: RegExp; idPlaceholder: string; idHelp: string; createPrompt?: string };
  /** A line the menu ends with, for what stays on the command line. */
  menuNote?: string;
}
