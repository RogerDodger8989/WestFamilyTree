import React from 'react'
import ReactDOM from 'react-dom/client'
import './design-tokens.css'
import './index.css'
import './tree-view.css'
import App from './App.jsx'
import { AppProvider } from './AppContext.jsx'
import { WindowFrameProvider } from './WindowFrameContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppProvider>
    <WindowFrameProvider>
      <App />
    </WindowFrameProvider>
  </AppProvider>
)
