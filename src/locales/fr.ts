import type { Messages } from './en'

const folderCount = (n: number): string => (n <= 1 ? `${n} dossier` : `${n} dossiers`)

export const fr: Messages = {
  languageName: 'Français',

  common: {
    cancel: 'Annuler',
    checking: 'Vérification…'
  },

  nav: {
    accounts: 'Comptes',
    addAccount: 'Ajouter un compte',
    checkRepo: 'Vérifier un repo',
    settings: 'Paramètres',
    global: 'Global',
    folderCount
  },

  account: {
    sections: 'Sections du compte',
    identity: 'Identité',
    folders: (n) => `Dossiers (${n})`,
    connections: 'Connexions',
    globalPill: '✓ Compte global',
    globalPillTitle: "Utilisé dans tous les repos qu'aucun dossier ne couvre",
    makeGlobal: 'Rendre global',
    makeGlobalTitle: "Utiliser ce compte dans tous les repos qu'aucun dossier ne couvre"
  },

  folders: {
    title: 'Dossiers',
    intro:
      "Chaque repository de ces dossiers commit et push en tant que {label}. Quand des dossiers sont imbriqués, c'est le plus profond qui l'emporte.",
    emptyTitle: 'Aucun dossier pour le moment',
    emptyHint: "Ce compte n'est utilisé que lorsqu'il est le compte global.",
    remove: 'Retirer',
    removeLabel: (folder) => `Retirer ${folder}`,
    add: 'Ajouter un dossier',
    outside: 'En dehors de ces dossiers : {label} (global)',
    noIdentity: 'aucune identité',
    chooseTitle: (label) => `Choisir un dossier pour ${label}`,
    alreadyHere: (folder) => `${folder} fait déjà partie des dossiers de ce compte.`,
    moveTitle: 'Déplacer le dossier',
    moveBody: (folder, other, label) => `${folder} utilise actuellement ${other}.\n\nUtiliser ${label} à la place ?`,
    moveOk: 'Déplacer',
    anotherAccount: 'un autre compte'
  },

  editor: {
    newTitle: 'Nouveau compte',
    title: 'Identité',
    label: 'Nom du compte',
    labelPlaceholder: 'Perso, Client A…',
    name: 'Nom des commits',
    namePlaceholder: 'Jeanne Dupont',
    email: 'Email des commits',
    emailPlaceholder: 'jeanne@exemple.com',
    platform: 'Plateforme',
    username: (host) => `Nom d'utilisateur ${host}`,
    usernamePlaceholder: 'Facultatif : choisit la connexion HTTPS (et gh sur GitHub)',
    color: 'Couleur',
    colorLabel: (c) => `Couleur ${c}`,
    add: 'Ajouter le compte',
    save: 'Enregistrer',
    saved: 'Enregistré',
    delete: 'Supprimer le compte',
    deleteTitle: 'Supprimer le compte',
    deleteBody: (label) =>
      `Supprimer « ${label} » ?\n\nSes dossiers sont retirés aussi. Sa clé SSH reste sur le disque, et l'identité git globale ne change pas.`,
    deleteOk: 'Supprimer'
  },

  ssh: {
    title: 'Clé SSH',
    hint: (domain, host) => `Pour les remotes git@${domain}:… Chaque compte ${host} a besoin de sa propre clé.`,
    key: 'Clé',
    uses: 'Utilise',
    defaultKey: 'ta clé par défaut (~/.ssh/id_*)',
    copy: 'Copier',
    copied: 'Copiée',
    addOnHost: (host) => `Ajouter sur ${host}`,
    addOnHostTitle: (host, user) => `Connecte-toi d'abord à ${host} en tant que ${user}`,
    create: 'Créer une clé',
    test: 'Tester',
    testing: 'Test en cours…',
    addWhileSignedIn: (host, user) => `Ajoute-la en étant connecté à ${host} en tant que ${user}.`,
    useAnother: 'Utiliser une autre clé…',
    useDefault: 'Utiliser la clé par défaut',
    pickTitle: 'Choisir une clé SSH privée',
    thisAccount: 'ce compte',
    belongsTo: (actual, expected) => ` Cette clé appartient à ${actual}, pas à ${expected}.`
  },

  signing: {
    title: 'Signature des commits',
    hint: (host) => `Ajoute un badge « Verified » à tes commits sur ${host} : la preuve qu'ils viennent bien de toi.`,
    toggle: 'Signer les commits de ce compte',
    needsKey: "Nécessite une clé SSH : crée-en une ou choisis-en une dans la carte Clé SSH.",
    onHint: (host) => `Signe avec la même clé SSH. Ajoute-la une seconde fois sur ${host}, comme clé de signature.`,
    githubTip: 'Sur GitHub, choisis « Signing Key » comme type de clé.',
    addKey: (host) => `Ajouter la clé de signature sur ${host}`,
    off: 'Désactivé : les commits de ce compte ne sont pas signés, même si le compte global signe.'
  },

  https: {
    title: 'Connexion HTTPS',
    hint: (domain) => `Pour les remotes https://${domain}/…, via Git Credential Manager.`,
    noUser: (host) => `Ajoute un nom d'utilisateur ${host} dans Identité pour fixer la connexion de ce compte.`,
    signedIn: (user) => `Connecté en tant que ${user}`,
    notSignedIn: (user) => `Pas encore connecté en tant que ${user}`,
    signIn: (user) => `Se connecter en tant que ${user}`,
    waiting: 'En attente de la connexion…',
    switchBrowser: (host) => `Si ton navigateur est connecté à un autre compte ${host}, change de compte d'abord.`
  },

  diagnose: {
    title: 'Vérifier un repository',
    hint: 'Voir quelle identité les commits et les push de ce repository vont utiliser, et pourquoi.',
    choose: 'Choisir un repository…',
    again: 'Vérifier à nouveau',
    pickTitle: 'Choisir un repository',
    details: 'Détails',
    name: 'Nom',
    email: 'Email',
    sshCommand: 'Commande SSH',
    httpsLogin: 'Connexion HTTPS',
    remote: 'Remote',
    signing: 'Signature',
    defaultSsh: 'par défaut (~/.ssh/id_*)',
    notPinned: 'non fixée',
    none: 'aucun',
    notSet: 'non défini',
    from: (source) => ` · depuis ${source}`,
    originRule: (label) => `dossier (${label})`,
    deletedAccount: 'compte supprimé',
    originLocal: 'ce repo (.git/config)',
    originGlobal: 'global (~/.gitconfig)'
  },

  findings: {
    notRepo: "Ce dossier n'est pas un repository git.",
    noEmail: "Aucun email de commit n'est défini.",
    noEmailDetail: 'Git refusera de commiter tant que user.email ne sera pas défini.',
    localOverride: (email) => `Ce repo remplace l'email en local (${email}).`,
    localOverrideRule: (label) =>
      `Son propre .git/config l'emporte sur le dossier de ${label}. Pour le retirer : git config --unset user.email`,
    localOverrideNoRule: "Son propre .git/config définit user.email : aucun dossier ni switch global ne s'applique ici.",
    ruleOk: (label, email, folder) => `Les commits utilisent ${label} (${email}), grâce au dossier ${folder}.`,
    ruleLoses: (label, email) => `Un dossier indique ${label}, mais les commits utiliseraient ${email}.`,
    ruleLosesDetail: "Un autre fichier de config l'emporte sur le dossier. Regarde l'origine ci-dessous.",
    noRule: (who) => `Aucun dossier ne couvre ce repo : les commits utilisent l'identité globale (${who}).`,
    noRuleDetail: 'Ajoute ce dossier à un compte pour le lier à ce repo.',
    otherEmails: "Des commits récents utilisent d'autres emails.",
    otherEmailsDetail: (list) =>
      `${list}. Normal sur un repo partagé ; sur ton propre repo, ils ont été faits avec la mauvaise identité.`,
    sshDedicated: 'Les push SSH utilisent une clé dédiée.',
    sshDefaultNotAccount: 'Les push SSH utilisent ta clé par défaut, pas celle de ce compte.',
    sshDefault: 'Les push SSH utilisent ta clé par défaut (~/.ssh/id_*).',
    httpsWrongUser: (user, expected) => `Les push se connectent en tant que ${user}, mais la connexion de ce compte est ${expected}.`,
    httpsOk: (user) => `Les push HTTPS se connectent en tant que ${user}.`,
    httpsNone: "Aucun compte GitHub n'est fixé pour les push HTTPS.",
    httpsNoneDetail: "Git Credential Manager utilisera son compte par défaut, ou demandera s'il en a plusieurs.",
    noRemote: "Ce repo n'a pas de remote « origin ».",
    signed: 'Les commits sont signés.',
    signingOff: 'Ce compte signe ses commits, mais ils ne seront pas signés dans ce repo.'
  },

  settings: {
    appearance: 'Apparence',
    theme: 'Thème',
    dark: 'Sombre',
    light: 'Clair',
    matchWindows: 'Comme Windows',
    language: 'Langue',
    windowsLanguage: 'Langue de Windows',
    startup: 'Démarrage',
    startWithWindows: 'Lancer Switchly avec Windows, dans la barre des tâches',
    guardTitle: 'Garde des commits',
    guardToggle: 'Refuser les commits faits avec le mauvais compte',
    guardHint:
      "Git refuse un commit dont l'email n'est pas celui du compte propriétaire du dossier du repository, par exemple un repo qui remplace user.email. Les hooks propres à chaque repository continuent de s'exécuter.",
    guardSkip: 'Pour le passer une fois : {command}',
    gcmTitle: 'Git Credential Manager',
    gcmHint: "Les connexions GitHub enregistrées dans Git Credential Manager. Celles de GitLab et Bitbucket s'affichent dans l'onglet Connexions de chaque compte.",
    gcmNone: 'Aucun compte GitHub pour le moment.',
    addGithub: 'Ajouter un compte GitHub',
    waitingWindow: 'En attente de la fenêtre de connexion…',
    ghTitle: 'GitHub CLI',
    ghHint: 'Changer le compte global change aussi gh, quand gh est connecté à ce compte.',
    ghActive: 'Compte actif : {user}',
    ghNotLoggedIn: 'non connecté',
    ghMissing: "gh n'est pas installé. Tout le reste fonctionne sans.",
    changesTitle: 'Ce que Switchly modifie',
    changesGitconfig:
      "{file} : le nom, l'email, la commande SSH et le compte GitHub globaux, plus une entrée {includeIf} par dossier.",
    changesSwitchly: '{file} : un fichier de config par compte.',
    changesHooks: '{file} : les hooks de la garde des commits, utilisés via le {hooksPath} global quand la garde est activée.',
    changesKeys: '{file} : les clés que tu crées ici. Supprimer un compte ne supprime jamais sa clé.'
  },

  gh: {
    notSignedIn: (user) =>
      `Git est passé sur ${user}. Seul GitHub CLI (gh) n'a pas suivi : il n'est pas encore connecté en tant que ${user}.`,
    signIn: (user) => `Connecter gh en tant que ${user}`,
    starting: 'Demande du code de connexion à GitHub…',
    enterCode: (user) => `GitHub s'est ouvert dans ton navigateur. Connecté en tant que ${user}, saisis ce code :`,
    openPage: 'Rouvrir la page',
    waiting: 'En attente de ta confirmation sur GitHub…',
    done: (user) => `gh est connecté en tant que ${user}. Il suivra désormais tes changements de compte.`
  },

  requirements: {
    title: 'Prérequis',
    hint: 'Les outils sur lesquels Switchly s’appuie.',
    blockingHint: "Switchly a besoin de Git pour Windows : c'est lui que Switchly configure. Installe-le pour commencer.",
    names: { git: 'Git pour Windows', gcm: 'Git Credential Manager', ssh: 'OpenSSH', gh: 'GitHub CLI (gh)' },
    optional: 'Facultatif',
    installed: 'Installé',
    missing: {
      git: 'Manquant : Switchly en a besoin pour tout.',
      gcm: 'Manquant : il gère les connexions HTTPS et est livré avec Git pour Windows. Réinstalle Git avec ses options par défaut.',
      ssh: 'Manquant : utile seulement pour les remotes git@… Ajoute « Client OpenSSH » dans Paramètres Windows → Fonctionnalités facultatives.',
      gh: "Non installé : changer de compte global peut aussi changer gh, si tu l'utilises."
    },
    install: 'Installer',
    installing: 'Installation…',
    download: 'Télécharger',
    adminPrompt: "Windows peut demander l'autorisation administrateur : accepte-la pour continuer. Cela peut prendre une minute.",
    recheck: 'Vérifier à nouveau'
  },

  updates: {
    title: 'Mises à jour',
    version: (v) => `Switchly ${v}`,
    check: 'Rechercher des mises à jour',
    upToDate: 'Switchly est à jour.',
    available: (v) => `Switchly ${v} est disponible.`,
    install: 'Mettre à jour et redémarrer',
    installing: 'Mise à jour…',
    devNote: 'Les mises à jour sont désactivées en développement.'
  },

  popup: {
    globalAccount: 'Compte global',
    noGlobal: "Aucune identité globale n'est définie.",
    noAccounts: 'Aucun compte pour le moment. Ouvre Switchly pour en ajouter un.',
    switchTo: 'Passer à',
    open: 'Ouvrir Switchly',
    folderCount
  }
}
