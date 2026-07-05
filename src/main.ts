import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'

// Check for a new build on every launch and reload as soon as it activates —
// iOS PWAs are otherwise slow to pick up deployed updates (docs/BACKLOG.md).
registerSW({ immediate: true })

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
