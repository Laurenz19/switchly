// The Git hosting sites an account can belong to. Mirrors src-tauri/src/hosts.rs.
export type HostId = 'github' | 'gitlab' | 'bitbucket'

export interface HostInfo {
  id: HostId
  name: string
  domain: string
  // Where the user pastes a public SSH key.
  sshKeysUrl: string
}

export const HOSTS: HostInfo[] = [
  { id: 'github', name: 'GitHub', domain: 'github.com', sshKeysUrl: 'https://github.com/settings/ssh/new' },
  { id: 'gitlab', name: 'GitLab', domain: 'gitlab.com', sshKeysUrl: 'https://gitlab.com/-/user_settings/ssh_keys' },
  { id: 'bitbucket', name: 'Bitbucket', domain: 'bitbucket.org', sshKeysUrl: 'https://bitbucket.org/account/settings/ssh-keys/' }
]

export function hostInfo(id: string | null | undefined): HostInfo {
  return HOSTS.find((h) => h.id === id) ?? HOSTS[0]
}
