import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/styles.css'

import JSZip from 'jszip'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Écoute les changements de localStorage provenant d'autres onglets.
// Si la clé `userConnected` est supprimée ailleurs, rediriger vers la page de login.
window.addEventListener('storage', (event) => {
	if (event.key === 'userConnected' && !event.newValue) {
		try {
			router.push('/')
		} catch (err) {
			// ignore if router non disponible
			console.error('Erreur lors de la redirection après storage event', err)
		}
	}
})
window.JSZip = JSZip
app.mount('#app')
