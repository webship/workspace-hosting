# @webship.co/workspace-hosting

The hosting family's shared base for [Webship Workspace](https://github.com/webship/workspace)
plugins. A hosting plugin (`@webship.co/workspace-upsun`, `-cpanel`, `-digitalocean`, `-aws`, `-azure`,
`-acquia`, `-godaddy`) is one call plus its provider:

```ts
import { registerHosting } from '@webship.co/workspace-hosting';
export function register(api: PluginApi) { registerHosting(api, provider); }
```

`registerHosting` gives the provider its row menu (linked / unlinked, with the link step), the
live-site chip, the environments modal and the list inside the menu, the get-database-and-files
flow (environment, database / files, switching the code, the safety export, confirmation; run as a
screen session), the branch-and-data command block, every tool verb as a screen session on the
project, the `/<id>-site/<ws>/<project>` jump, and the New-folder section. The `HostingProvider`
says what differs between hosts: how a project is detected as linked, the CLI and its token, how
environments and their URLs are listed, which tool verbs the per-workspace command carries, the
pull flags, the console URL.

The row carries the provider's button and its caption (`linked` / `not linked`); the dropdown's body
is a fragment (`/fragments/p/<provider>/menu/<ws>/<project>`) fetched when the menu opens, so a page
of fifty rows with seven providers carries 350 buttons and not 350 menus. On a dashboard older than
that form (no `row-menu-body` capability) the whole menu is drawn inline, as before.
