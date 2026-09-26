import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'

// Updates come from the latest GitHub release's latest.json; the updater only
// installs packages signed with the key whose public half is in
// tauri.conf.json.
//
// A dev build never looks: it would offer to replace itself with the
// installed release.
export const updatesEnabled = !import.meta.env.DEV

export async function findUpdate(): Promise<Update | null> {
  if (!updatesEnabled) return null
  return check()
}

// Downloads and runs the installer (passive mode: a progress bar, no
// questions), then restarts into the new version.
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall()
  await relaunch()
}
