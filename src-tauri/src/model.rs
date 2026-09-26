// Wire types shared with the frontend (src/types.ts), camelCase in JSON.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub label: String,
    pub name: String,
    pub email: String,
    // github | gitlab | bitbucket (see hosts.rs).
    #[serde(default = "default_host")]
    pub host: String,
    // The login on that host. Read from "githubUser" too: the field's name
    // before GitLab and Bitbucket were supported.
    #[serde(default, alias = "githubUser")]
    pub username: String,
    #[serde(default)]
    pub ssh_key_path: Option<String>,
    // Sign commits and tags with the account's SSH key.
    #[serde(default)]
    pub sign_commits: bool,
    #[serde(default = "default_color")]
    pub color: String,
}

fn default_host() -> String {
    "github".into()
}

fn default_color() -> String {
    "#6d5ae6".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub folder: String,
    pub account_id: String,
}

// What Switchly persists. The git side (account files, includeIf entries,
// global identity) is always rewritten from this.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default)]
    pub accounts: Vec<Account>,
    #[serde(default)]
    pub rules: Vec<Rule>,
    // The UI language ("en", "fr"), sent by the frontend so the tray menu,
    // which Rust draws, matches it from the next launch on.
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalIdentity {
    pub name: Option<String>,
    pub email: Option<String>,
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub accounts: Vec<Account>,
    pub rules: Vec<Rule>,
    pub global: GlobalIdentity,
    pub gh_user: Option<String>,
    pub gh_available: bool,
    // Whether the commit guard hook is installed (see guard.rs).
    pub guard: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigValue {
    pub value: String,
    pub scope: String,
    pub origin: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailCount {
    pub email: String,
    pub count: u32,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoFacts {
    pub is_repo: bool,
    pub top_level: Option<String>,
    pub name: Option<ConfigValue>,
    pub email: Option<ConfigValue>,
    pub ssh_command: Option<ConfigValue>,
    // commit.gpgsign as the repo resolves it.
    pub signing: Option<ConfigValue>,
    pub credential_user: Option<String>,
    pub remote_url: Option<String>,
    // The host id the remote points at, when it's one Switchly knows.
    pub remote_host: Option<String>,
    pub recent_emails: Vec<EmailCount>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTest {
    pub ok: bool,
    pub username: Option<String>,
    pub message: String,
}
