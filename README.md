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
