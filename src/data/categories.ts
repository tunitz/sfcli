export const categories = [
  { id: 'all', label: 'All commands' },
  { id: 'org', label: 'Org & auth' },
  { id: 'project', label: 'Projects & source' },
  { id: 'data', label: 'Data & metadata' },
  { id: 'apex', label: 'Apex & code' },
  { id: 'agent', label: 'Agentforce' },
  { id: 'devops', label: 'DevOps Center' },
  { id: 'package', label: 'Packages' },
  { id: 'config', label: 'Config & CLI' },
  { id: 'other', label: 'Other' },
]

// Top-level CLI namespaces grouped into human categories. Anything unmapped falls into "other".
export const categoryMap: Record<string, string> = {
  org: 'org', alias: 'org',
  project: 'project', template: 'project', dev: 'project', lightning: 'project', community: 'project', 'ui-bundle': 'project',
  data: 'data', sobject: 'data', schema: 'data', cmdt: 'data',
  apex: 'apex', 'code-analyzer': 'apex', flow: 'apex', logic: 'apex',
  agent: 'agent',
  devops: 'devops',
  package: 'package', package1: 'package',
  config: 'config', plugins: 'config', force: 'config', api: 'config', update: 'config', version: 'config',
  doctor: 'config', help: 'config', commands: 'config', whatsnew: 'config', which: 'config',
  autocomplete: 'config', info: 'config', search: 'config',
}

export function categoryOf(id: string): string {
  const ns = id.split(':')[0]
  return categoryMap[ns] || 'other'
}

export const workflows = [
  { step: '01', title: 'Authenticate to an org', description: 'Log in through your browser and give your org a memorable alias.', commands: ['sf org login web --alias my-org --set-default'], tags: ['login', 'authenticate', 'browser', 'connect', 'sandbox', 'production'] },
  { step: '02', title: 'Check your org', description: 'See which org you’re connected to and its key details.', commands: ['sf org display --target-org my-org'], tags: ['whoami', 'org info', 'user', 'connected'] },
  { step: '03', title: 'Start a project', description: 'Create a Salesforce DX project in a new folder.', commands: ['sf project generate --name my-project', 'cd my-project'], tags: ['new', 'scaffold', 'setup', 'create'] },
  { step: '04', title: 'Deploy metadata', description: 'Push local metadata to an org, then validate before committing.', commands: ['sf project deploy start --target-org my-org', 'sf project deploy preview --target-org my-org'], tags: ['push', 'release', 'source', 'upload', 'validate'] },
  { step: '05', title: 'Run a SOQL query', description: 'Query records in your org and print the results.', commands: ['sf data query --query "SELECT Id, Name FROM Account LIMIT 10" --target-org my-org'], tags: ['records', 'database', 'soql', 'accounts'] },
  { step: '06', title: 'Open the org', description: 'Launch your default browser straight into Salesforce.', commands: ['sf org open --target-org my-org'], tags: ['browser', 'url', 'visit', 'setup'] },
]
