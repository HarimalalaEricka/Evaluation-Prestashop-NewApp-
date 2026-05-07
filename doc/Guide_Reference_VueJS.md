# ⚡ GUIDE RÉFÉRENCE RAPIDE — VUE.JS
> Garde ce fichier ouvert pendant que tu codes. Tout ce dont tu as besoin en un seul endroit.

---

## 📁 STRUCTURE DES DOSSIERS D'UN PROJET VUE

```
mon-projet/
│
├── public/                  → fichiers statiques servis directement (favicon, images publiques)
│   └── index.html
│
├── src/                     → TOUT ton code est ici
│   │
│   ├── main.js              → point d'entrée — monte l'app Vue, importe le router et le store
│   ├── App.vue              → composant racine — contient <router-view /> en général
│   │
│   ├── assets/              → images, fonts, fichiers CSS globaux
│   │   └── logo.png
│   │
│   ├── components/          → composants réutilisables (boutons, cartes, modals…)
│   │   ├── BoutonAction.vue
│   │   └── CarteItem.vue
│   │
│   ├── views/               → pages entières (une view = une route)
│   │   ├── Accueil.vue
│   │   ├── Detail.vue
│   │   └── Formulaire.vue
│   │
│   ├── router/              → configuration de Vue Router
│   │   └── index.js         → définit toutes les routes (path → composant)
│   │
│   ├── store/               → état global partagé entre composants (Pinia ou objet réactif)
│   │   └── index.js
│   │
│   ├── services/            → logique des appels API (séparer du composant)
│   │   ├── api.js           → configuration de base (URL, headers communs)
│   │   └── ressourceService.js
│   │
│   └── utils/               → fonctions utilitaires (formatage, validation, parsing CSV…)
│       └── csvHelper.js
│
├── .env                     → variables d'environnement (URL API, token…)
├── vite.config.js           → config Vite (proxy, alias…)
└── package.json             → dépendances et scripts npm
```

---

### 🧭 Règle simple pour savoir où mettre ton code

| Ce que tu codes | Où ça va |
|---|---|
| Une page complète (Accueil, Liste, Détail…) | `src/views/` |
| Un élément réutilisable (bouton, carte, modal…) | `src/components/` |
| Un appel API (fetch, axios…) | `src/services/` |
| Une fonction utilitaire (parser CSV, formater date…) | `src/utils/` |
| Les routes de navigation | `src/router/index.js` |
| Une variable partagée entre plusieurs composants | `src/store/index.js` |
| Une URL d'API ou un token | `.env` |

---

### 📄 Contenu type de main.js

```js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

createApp(App)
  .use(router)
  .mount('#app')
```

### 📄 Contenu type de App.vue

```vue
<template>
  <div>
    <NavBar />          <!-- composant de navigation commun à toutes les pages -->
    <router-view />    <!-- ici s'affiche la page selon la route active -->
  </div>
</template>

<script>
import NavBar from './components/NavBar.vue'
export default {
  components: { NavBar }
}
</script>
```

### 📄 Contenu type d'un service API (src/services/ressourceService.js)

```js
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export async function getTout() {
  const res = await fetch(`${BASE_URL}/ressources`)
  if (!res.ok) throw new Error('Erreur ' + res.status)
  return res.json()
}

export async function creer(donnees) {
  const res = await fetch(`${BASE_URL}/ressources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donnees)
  })
  if (!res.ok) throw new Error('Erreur ' + res.status)
  return res.json()
}
```

```js
// Utilisation dans un composant
import { getTout } from '../services/ressourceService.js'

async mounted() {
  this.liste = await getTout()
}
```

### 📄 Fichier .env (variables d'environnement)

```env
# Les variables DOIVENT commencer par VITE_ pour être accessibles dans Vue
VITE_API_URL=http://localhost:8080
VITE_API_TOKEN=mon_token_secret
```

```js
// Accéder à une variable dans le code
const url = import.meta.env.VITE_API_URL
const token = import.meta.env.VITE_API_TOKEN
```

> ⚠️ Ne jamais commiter le fichier `.env` si il contient des tokens ou mots de passe. Ajoute-le dans `.gitignore`.

---

## 📁 STRUCTURE D'UN COMPOSANT VUE (template de base)

```vue
<template>
  <div>
    <p>{{ message }}</p>
  </div>
</template>

<script>
export default {
  name: 'MonComposant',

  // Données réactives
  data() {
    return {
      message: 'Bonjour',
      liste: [],
      loading: false,
      erreur: null,
    }
  },

  // Calculées automatiquement depuis data
  computed: {
    messageEnMajuscules() {
      return this.message.toUpperCase()
    }
  },

  // Surveille un changement dans data
  watch: {
    message(nouvelleValeur) {
      console.log('message a changé :', nouvelleValeur)
    }
  },

  // Lancé au chargement du composant
  mounted() {
    this.chargerDonnees()
  },

  methods: {
    chargerDonnees() {
      // ton code ici
    }
  }
}
</script>

<style scoped>
/* styles uniquement pour ce composant */
</style>
```

---

## 🔗 LES DIRECTIVES ESSENTIELLES

```vue
<!-- Afficher une variable -->
<p>{{ maVariable }}</p>

<!-- Lier un attribut HTML à une variable -->
<img :src="imageUrl" :alt="imageAlt" />
<input :value="monChamp" />

<!-- Écouter un événement -->
<button @click="maFonction">Cliquer</button>
<input @input="maFonction" @keyup.enter="valider" />
<form @submit.prevent="soumettre">...</form>

<!-- Condition -->
<div v-if="estConnecte">Contenu si vrai</div>
<div v-else-if="estAdmin">Autre condition</div>
<div v-else>Sinon</div>

<!-- Afficher/masquer (reste dans le DOM) -->
<div v-show="estVisible">Contenu</div>

<!-- Boucle -->
<ul>
  <li v-for="item in liste" :key="item.id">
    {{ item.nom }}
  </li>
</ul>

<!-- Double liaison (input ↔ data) -->
<input v-model="monChamp" />
<select v-model="valeurSelectionnee">
  <option value="a">Option A</option>
</select>
```

---

## 🌐 APPELS API AVEC FETCH

### GET — Récupérer des données
```js
methods: {
  async chargerDonnees() {
    this.loading = true
    this.erreur = null
    try {
      const response = await fetch('https://api.exemple.com/ressources')
      if (!response.ok) throw new Error('Erreur HTTP : ' + response.status)
      const data = await response.json()
      this.liste = data
    } catch (e) {
      this.erreur = e.message
      console.error(e)
    } finally {
      this.loading = false
    }
  }
}
```

### POST — Envoyer des données
```js
async envoyerDonnees() {
  this.loading = true
  try {
    const response = await fetch('https://api.exemple.com/ressources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.token   // si auth nécessaire
      },
      body: JSON.stringify({
        nom: this.nom,
        valeur: this.valeur
      })
    })
    if (!response.ok) throw new Error('Erreur HTTP : ' + response.status)
    const data = await response.json()
    console.log('Réponse :', data)
  } catch (e) {
    this.erreur = e.message
  } finally {
    this.loading = false
  }
}
```

### PUT — Modifier une ressource
```js
async modifierRessource(id) {
  const response = await fetch(`https://api.exemple.com/ressources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: this.nom })
  })
  const data = await response.json()
}
```

### DELETE — Supprimer
```js
async supprimerRessource(id) {
  await fetch(`https://api.exemple.com/ressources/${id}`, {
    method: 'DELETE'
  })
  // retirer de la liste locale
  this.liste = this.liste.filter(item => item.id !== id)
}
```

---

## 📂 IMPORT ET LECTURE CSV

### Avec PapaParse (librairie recommandée)
```bash
npm install papaparse
```

```js
import Papa from 'papaparse'

methods: {
  // Lire un fichier CSV uploadé par l'utilisateur
  lireFichierCSV(event) {
    const fichier = event.target.files[0]
    Papa.parse(fichier, {
      header: true,          // première ligne = noms des colonnes
      skipEmptyLines: true,
      complete: (resultat) => {
        console.log('Données :', resultat.data)
        this.donnees = resultat.data
      },
      error: (erreur) => {
        console.error('Erreur CSV :', erreur)
      }
    })
  },

  // Lire un CSV depuis une URL
  async lireCSVDepuisURL() {
    Papa.parse('https://exemple.com/data.csv', {
      download: true,
      header: true,
      complete: (resultat) => {
        this.donnees = resultat.data
      }
    })
  }
}
```

```vue
<!-- Dans le template -->
<input type="file" accept=".csv" @change="lireFichierCSV" />
```

### Sans librairie (CSV simple)
```js
lireCSVManuellement(contenu) {
  const lignes = contenu.split('\n')
  const entetes = lignes[0].split(',')
  const donnees = lignes.slice(1).map(ligne => {
    const valeurs = ligne.split(',')
    return entetes.reduce((obj, entete, i) => {
      obj[entete.trim()] = valeurs[i]?.trim()
      return obj
    }, {})
  })
  this.donnees = donnees
}
```

---

## 📡 COMMUNICATION ENTRE COMPOSANTS

### Parent → Enfant (props)
```vue
<!-- Parent : envoie une valeur -->
<MonComposant :titre="monTitre" :liste="maListe" />

<!-- Enfant : reçoit la valeur -->
<script>
export default {
  props: {
    titre: String,
    liste: Array,
  }
}
</script>
```

### Enfant → Parent (emit)
```vue
<!-- Enfant : envoie un événement -->
<button @click="$emit('valider', monObjet)">Valider</button>

<!-- Parent : écoute l'événement -->
<MonComposant @valider="recevoirDonnees" />

<script>
methods: {
  recevoirDonnees(donnees) {
    console.log('Reçu du composant enfant :', donnees)
  }
}
</script>
```

---

## 🔄 CYCLE DE VIE DU COMPOSANT

```js
export default {
  beforeCreate()  { /* avant tout — data pas encore dispo */ },
  created()       { /* data dispo, pas encore dans le DOM — bon pour fetch */ },
  mounted()       { /* composant dans le DOM — le plus utilisé */ },
  updated()       { /* après chaque mise à jour de data */ },
  beforeUnmount() { /* juste avant destruction — nettoyer les listeners */ },
  unmounted()     { /* composant détruit */ },
}
```

> 💡 **Dans 90% des cas tu utiliseras juste `mounted()`** pour lancer tes appels API au chargement.

---

## 🗺️ VUE ROUTER — NAVIGATION

### Installation et configuration de base
```bash
npm install vue-router
```

```js
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import Accueil from '../views/Accueil.vue'
import Detail from '../views/Detail.vue'

const routes = [
  { path: '/',          component: Accueil },
  { path: '/detail/:id', component: Detail },
]

export default createRouter({
  history: createWebHistory(),
  routes
})
```

### Utilisation dans un composant
```vue
<!-- Lien de navigation -->
<router-link to="/">Accueil</router-link>
<router-link :to="'/detail/' + item.id">Voir détail</router-link>

<!-- Zone d'affichage de la page -->
<router-view />
```

```js
// Naviguer depuis le code
this.$router.push('/')
this.$router.push('/detail/' + id)
this.$router.back()

// Récupérer un paramètre d'URL (/detail/:id)
const id = this.$route.params.id

// Récupérer un query param (?page=2)
const page = this.$route.query.page
```

---

## 💾 GESTION D'ÉTAT LOCAL (sans Vuex/Pinia)

```js
// Partager des données entre composants via un objet réactif simple
// fichier : store/etat.js
import { reactive } from 'vue'

export const etat = reactive({
  utilisateur: null,
  token: null,
  donnees: [],
})
```

```js
// Dans n'importe quel composant
import { etat } from '../store/etat.js'

export default {
  data() {
    return { etat }
  },
  methods: {
    connexion(user) {
      etat.utilisateur = user
    }
  }
}
```

---

## 🐛 ERREURS FRÉQUENTES ET SOLUTIONS

| Erreur | Cause probable | Solution |
|---|---|---|
| `Cannot read properties of undefined` | Variable pas encore chargée | Vérifier avec `v-if` avant d'afficher |
| `v-for` sans `:key` | Oubli de la key | Toujours ajouter `:key="item.id"` |
| Données qui ne se mettent pas à jour | Mutation directe d'un objet/tableau | Utiliser `this.liste = [...this.liste, nouvelItem]` |
| CORS error | L'API bloque les requêtes du front | Configurer le proxy dans `vite.config.js` |
| Props non reçues | Mauvais nom ou oubli du `:` | `:maProp="valeur"` et non `maProp="valeur"` |
| `this` undefined dans une fonction | Utilisation de `function()` dans une callback | Utiliser les arrow functions `() =>` |

---

## ⚙️ PROXY POUR ÉVITER LES ERREURS CORS (vite.config.js)

```js
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',  // URL de ton backend
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
}
```

```js
// Ensuite dans ton code, au lieu de :
fetch('http://localhost:8080/ressources')

// Tu écris :
fetch('/api/ressources')
```

---

## 📋 COMMANDES UTILES

```bash
# Créer un projet Vue
npm create vue@latest

# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Builder pour la production
npm run build

# Installer une librairie
npm install papaparse
npm install axios          # alternative à fetch
npm install vue-router
```

---

## ✅ CHECKLIST AVANT DE RENDRE

- [ ] Tous les `v-for` ont un `:key`
- [ ] Les appels API ont un `try/catch`
- [ ] Les états `loading` et `erreur` sont gérés
- [ ] Pas de données sensibles (token, mot de passe) dans le code
- [ ] Les props sont bien définies avec leur type
- [ ] Le projet tourne sans erreur dans la console
