// The Git hosting sites an account can belong to. Mirrors src/hosts.ts.
// Logins go through Git Credential Manager, which supports all three.

pub struct Host {
    pub id: &'static str,
    pub name: &'static str,
    pub domain: &'static str,
}

pub const HOSTS: [Host; 3] = [
    Host { id: "github", name: "GitHub", domain: "github.com" },
    Host { id: "gitlab", name: "GitLab", domain: "gitlab.com" },
    Host { id: "bitbucket", name: "Bitbucket", domain: "bitbucket.org" },
];

impl Host {
    pub fn url(&self) -> String {
        format!("https://{}", self.domain)
    }

    // The URL-scoped key that tells Git Credential Manager which login to use.
    pub fn credential_key(&self) -> String {
        format!("credential.https://{}.username", self.domain)
    }

    pub fn ssh_target(&self) -> String {
        format!("git@{}", self.domain)
    }
}

// Unknown ids (e.g. from a newer config) fall back to GitHub.
pub fn by_id(id: &str) -> &'static Host {
    HOSTS.iter().find(|h| h.id == id).unwrap_or(&HOSTS[0])
}

// The host a remote URL points at, whether https://gitlab.com/... or
// git@gitlab.com:...
pub fn for_remote(url: &str) -> Option<&'static Host> {
    let lower = url.to_lowercase();
    HOSTS.iter().find(|h| {
        lower.contains(&format!("://{}/", h.domain))
            || lower.contains(&format!("@{}:", h.domain))
            || lower.contains(&format!("@{}/", h.domain))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_host_of_https_and_ssh_remotes() {
        assert_eq!(for_remote("https://github.com/a/b.git").map(|h| h.id), Some("github"));
        assert_eq!(for_remote("git@gitlab.com:group/b.git").map(|h| h.id), Some("gitlab"));
        assert_eq!(for_remote("ssh://git@bitbucket.org/team/b.git").map(|h| h.id), Some("bitbucket"));
        assert_eq!(for_remote("https://user@bitbucket.org/team/b.git").map(|h| h.id), Some("bitbucket"));
        assert_eq!(for_remote("https://example.com/x.git").map(|h| h.id), None);
    }

    #[test]
    fn falls_back_to_github() {
        assert_eq!(by_id("sourcehut").id, "github");
    }
}
