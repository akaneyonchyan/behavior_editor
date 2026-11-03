import React from 'react'
import ReactDOM from 'react-dom/client'
const App = React.lazy(()=>import('./App'))
const ReadOnlyPage = React.lazy(()=>import('./components/ReadOnlyPage'))
import AuthBoundary from './components/AuthBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthBoundary><React.Suspense fallback={<p>正在加载行为图…</p>}>{new URLSearchParams(location.search).get('view')==='readonly'?<ReadOnlyPage/>:<App />}</React.Suspense></AuthBoundary>
  </React.StrictMode>
)
