import React from 'react'
import ReactDOM from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { MainApp } from './MainApp'
import { Popup } from './Popup'
import './styles.css'

// One bundle for both windows declared in tauri.conf.json.
const isPopup = getCurrentWindow().label === 'popup'
document.documentElement.dataset.window = isPopup ? 'popup' : 'main'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isPopup ? <Popup /> : <MainApp />}</React.StrictMode>
)
