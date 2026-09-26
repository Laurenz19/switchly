// Wire types shared with the frontend (src/types.ts), camelCase in JSON.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub label: String,
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub github_user: String,
    #[serde(default)]
    pub ssh_key_path: Option<String>,
    #[serde(default = "default_color")]
    pub color: String,
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
    pub credential_user: Option<String>,
    pub remote_url: Option<String>,
    pub recent_emails: Vec<EmailCount>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTest {
    pub ok: bool,
    pub github_user: Option<String>,
    pub message: String,
}
