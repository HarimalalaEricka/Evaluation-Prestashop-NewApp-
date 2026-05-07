# 📓 MÉMO PROJET

> Ton fichier de documentation personnel — à compléter pendant les 2 semaines

---

## 🏗️ INFORMATIONS GÉNÉRALES

| Champ | Valeur |
|---|---|
| Nom du projet | Prestashop |
| Langage / Framework | Language php + Symphony pour les dernieres versions |
| Commande pour lancer | Mettre le dossier dans htdocs et le projet et accessible via localhost|
| Port utilisé | 80 |
| URL de base de l'API |/api |
| Auth (token / clé / rien) | |
| Format des réponses | XML|

---

## 📁 STRUCTURE DU PROJET

```
prestashop_edition_classic_version_8.2.6/
├── app/                       → noyau Symfony de l’application, configuration moderne et bootstrap
│   ├── config/                → paramètres, routes, sécurité, services, doctrine
│   ├── Resources/             → ressources Symfony : sécurité, geoip, fichiers de mapping, etc.
│   └── test/                  → tests liés à l’application
├── admin6021cjjlxuxk193zr7t/  → back-office PrestaShop, interface d’administration
│   ├── themes/
│   │   └── new-theme/         → nouveau thème du back-office
│   ├── autoupgrade/           → outils de mise à jour du système
│   ├── backups/               → sauvegardes générées par l’admin
│   ├── export/                → exports de données depuis le back-office
│   ├── filemanager/           → gestionnaire de fichiers de l’administration
│   ├── import/                → import de fichiers, CSV, données produits, etc.
│   └── themes/                → thèmes et assets spécifiques à l’admin
├── bin/                       → scripts exécutables, commandes console
├── cache/                     → fichiers temporaires, cache applicatif, données de compilation
├── classes/                   → couche legacy principale du cœur PrestaShop
│   ├── assets/                → ressources internes pour certaines classes
│   ├── cache/                 → mécanismes de cache legacy
│   ├── checkout/              → logique liée au tunnel de commande
│   ├── container/             → gestion du conteneur et services legacy
│   ├── controller/           → classes de base des contrôleurs legacy
│   ├── db/                    → abstraction et accès base de données
│   ├── exception/             → exceptions métier et techniques
│   ├── form/                  → objets et helpers pour formulaires
│   ├── helper/                → helpers d’interface et d’admin
│   ├── lang/                  → gestion des langues et traductions
│   ├── log/                   → journalisation et logs
│   ├── module/                → abstraction de la gestion des modules
│   ├── order/                 → logique métier des commandes
│   ├── pdf/                   → génération de documents PDF
│   ├── product/               → logique produit, prix, assemblage, présentation
│   ├── proxy/                 → classes de proxy / wrappers
│   ├── range/                 → plages de prix, poids, etc.
│   ├── shop/                  → contexte multiboutique, boutique, groupe de boutiques
│   ├── Smarty/                → intégration moteur de template Smarty
│   ├── stock/                 → gestion des stocks
│   ├── tax/                   → taxes et règles de taxation
│   ├── tree/                  → structures arborescentes, menus, catégories
│   └── webservice/            → API webservice PrestaShop
├── config/                    → configuration globale legacy, bootstrap, constantes, paramètres
├── controllers/               → contrôleurs legacy du front et du back-office
│   ├── admin/                 → contrôleurs d’administration
│   └── front/                 → contrôleurs visibles côté client
├── docs/                      → documentation technique et fonctionnelle
├── download/                  → fichiers téléchargeables pour les produits virtuels
├── img/                       → images système, icônes, visuels et médias
├── js/                        → scripts JavaScript front et back
│   ├── vendor/                → bibliothèques externes intégrées
│   └── tiny_mce/              → éditeur de texte enrichi TinyMCE
├── localization/              → fichiers de localisation, packs de langue, formats régionaux
├── mails/                     → modèles d’e-mails envoyés par la plateforme
├── modules/                   → modules natifs et modules additionnels
├── override/                  → surcharges du core pour modifier le comportement sans toucher au cœur
├── pdf/                       → templates et mises en page des documents PDF
├── src/                       → couche moderne Symfony / Domain / Adapter
│   ├── Adapter/               → adaptation entre legacy et architecture moderne
│   ├── Core/                  → logique centrale, domaines, services, composants métier
│   └── PrestaShopBundle/      → bundle Symfony principal de PrestaShop
├── templates/                 → templates modernes, vues Twig et composants d’affichage
├── themes/                    → thèmes front-office
│   └── classic/               → thème classique par défaut
├── tools/                     → outils internes, scripts utilitaires, helpers système
├── translations/              → traductions de l’application et des modules
├── upload/                    → fichiers uploadés par les utilisateurs ou l’admin
├── var/                       → fichiers de runtime Symfony, cache, logs, données temporaires
├── vendor/                    → dépendances installées via Composer
└── webservice/                → point d’entrée et gestion de l’API webservice
```

---

## 🔌 ENDPOINTS DE L'API EXPOSÉE

Base URL :
`/api/{resource}`

---

## 📌 ENDPOINTS GÉNÉRAUX

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api` | Liste des ressources disponibles |
| `GET /api/{resource}` | Liste des éléments (pagination possible) |
| `GET /api/{resource}/{id}` | Détail d’un élément |
| `POST /api/{resource}` | Body XML/JSON → création |
| `PUT /api/{resource}/{id}` | Body XML/JSON → mise à jour |
| `DELETE /api/{resource}/{id}` | Suppression |

---

## 🛍️ PRODUCTS

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api/products` | Liste des produits |
| `GET /api/products/{id}` | Détail produit |
| `POST /api/products` | Création produit |
| `PUT /api/products/{id}` | Mise à jour produit |
| `DELETE /api/products/{id}` | Supprimer produit |

---

## 📂 CATEGORIES

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api/categories` | Liste catégories |
| `GET /api/categories/{id}` | Détail catégorie |
| `POST /api/categories` | Création catégorie |
| `PUT /api/categories/{id}` | Mise à jour catégorie |
| `DELETE /api/categories/{id}` | Suppression catégorie |

---

## 👤 CUSTOMERS

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api/customers` | Liste clients |
| `GET /api/customers/{id}` | Détail client |
| `POST /api/customers` | Création client |
| `PUT /api/customers/{id}` | Mise à jour client |
| `DELETE /api/customers/{id}` | Suppression client |

---

## 📦 ORDERS

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api/orders` | Liste commandes |
| `GET /api/orders/{id}` | Détail commande |
| `POST /api/orders` | Création commande |
| `PUT /api/orders/{id}` | Mise à jour commande |
| `DELETE /api/orders/{id}` | Suppression commande |

---

## 🚚 CARRIERS

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api/carriers` | Liste transporteurs |
| `GET /api/carriers/{id}` | Détail transporteur |
| `POST /api/carriers` | Création transporteur |
| `PUT /api/carriers/{id}` | Mise à jour transporteur |
| `DELETE /api/carriers/{id}` | Suppression transporteur |

---

## 🛒 CARTS

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api/carts` | Liste paniers |
| `GET /api/carts/{id}` | Détail panier |
| `POST /api/carts` | Création panier |
| `PUT /api/carts/{id}` | Mise à jour panier |
| `DELETE /api/carts/{id}` | Suppression panier |

---

## ⚙️ CONFIGURATIONS

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api/configurations` | Liste configuration shop |
| `PUT /api/configurations/{id}` | Mise à jour configuration |

---

## 🌍 LANGUAGES

| Méthode + URL | Paramètres / Réponse |
|---|---|
| `GET /api/languages` | Liste langues |
| `GET /api/languages/{id}` | Détail langue |

---

## 📦 STOCK AVAILABILITY

| Méthode + URL | Paramètres / Body / Réponse |
|---|---|
| `GET /api/stock_availables` | Liste stock |
| `GET /api/stock_availables/{id}` | Détail stock |
| `PUT /api/stock_availables/{id}` | Mise à jour stock |

---

## 🔎 SEARCH

| Méthode + URL | Paramètres / Réponse |
|---|---|
| `GET /api/search?q=xxx` | Recherche globale |

---

## 🧠 NOTE IMPORTANTE

- Certaines ressources peuvent être **read-only**
- Certaines utilisent `specific_management = true`
- Le format de données est souvent **XML (par défaut)** ou JSON (optionnel)
- Tout est géré par `ObjectModel` côté backend

---

## 📂 IMPORT CSV

**Librairie utilisée :** `_______________`

**Format du fichier :**

| Propriété | Valeur |
|---|---|
| Séparateur | `,` ou `;` ou `\t` |
| Encodage | UTF-8 / ISO-8859-1 |
| Colonnes | col1, col2, col3… |
| Ligne d'en-tête | Oui / Non |

**Snippet qui fonctionne :**

```js
// Coller ici ton code d'import CSV
```

---

## 🌐 APPELS API DEPUIS MON CODE

**Librairie utilisée :** `_______________`

**Auth :** Bearer Token / API Key / Basic / Aucune

**Header :** `Authorization: Bearer _______________`

**Snippet GET :**

```js
// Coller ici ton snippet GET qui fonctionne
```

**Snippet POST :**

```js
// Coller ici ton snippet POST qui fonctionne
```

---

## 🐛 ERREURS RENCONTRÉES ET SOLUTIONS

| Problème | Solution |
|---|---|
| | |
| | |
| | |

---

## ⚙️ COMMANDES IMPORTANTES

| Action | Commande |
|---|---|
| Installer les dépendances | |
| Lancer le projet | |
| Lancer les tests | |
| Builder | |

---

## 📌 NOTES PERSO / RAPPELS

<!-- Espace libre — noter tout ce que tu veux te rappeler le jour de l'aléa -->
