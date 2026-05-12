# To-Do List — Fonctionnalité Import de Données PrestaShop

> Format : CSV | Destination : API PrestaShop directement | Conflit : Écraser (update)

---

## 🏗️ Setup & Architecture

- [ ] Définir la structure du module import dans l'application externe
- [ ] Réutiliser le service d'authentification API PrestaShop existant (Basic Auth / API Key)
- [ ] Identifier les endpoints disponibles pour chaque ressource (`GET /api/` pour la liste)

---

## 📂 UI — Upload du fichier CSV

- [ ] Créer la page/composant "Import de données"
- [ ] Ajouter un champ d'upload de fichier (drag & drop + bouton)
- [ ] Valider le format du fichier (extension `.csv` obligatoire)
- [ ] Afficher un aperçu des premières lignes du fichier après upload
- [ ] Afficher le nom du fichier et le nombre de lignes détectées

---

## 🔍 Détection automatique de la ressource cible

- [ ] Lire les headers (colonnes) du CSV uploadé
- [ ] Récupérer la liste des ressources disponibles via `GET /api/`
- [ ] Implémenter une logique de détection automatique de la table cible basée sur les colonnes
- [ ] Afficher la ressource détectée à l'utilisateur avec possibilité de correction manuelle
- [ ] Gérer le cas où aucune ressource ne correspond (message d'erreur clair)

---

## 🔄 Mapping des colonnes

- [ ] Récupérer les champs disponibles de la ressource cible via `GET /api/{resource}?schema=synopsis`
- [ ] Afficher une interface de mapping colonne CSV ↔ champ API
- [ ] Pré-remplir le mapping automatiquement si les noms correspondent
- [ ] Identifier et signaler les champs obligatoires non mappés
- [ ] Permettre d'ignorer certaines colonnes du CSV

---

## ⚙️ Logique d'import

- [ ] Parser le CSV ligne par ligne (gestion de l'encodage UTF-8, séparateurs `,` ou `;`)
- [ ] Pour chaque ligne, vérifier si la ressource existe déjà (`GET /api/{resource}/{id}`)
- [ ] Si elle existe → appeler `PUT /api/{resource}/{id}` (écrasement)
- [ ] Si elle n'existe pas → appeler `POST /api/{resource}`
- [ ] Gérer l'import en séquentiel ou batch pour ne pas surcharger l'API
- [ ] Construire le payload XML attendu par l'API PrestaShop à partir des données CSV

---

## ✅ UX — Progression & Feedback

- [ ] Afficher une barre de progression pendant l'import (lignes traitées / total)
- [ ] Afficher un rapport final : nb succès, nb échecs, nb mis à jour
- [ ] Lister les lignes en erreur avec le message d'erreur correspondant
- [ ] Permettre d'exporter le rapport d'import en CSV

---

## 🛡️ Gestion des erreurs

- [ ] Gérer les erreurs API (401, 404, 422, 500) par ligne sans stopper tout l'import
- [ ] Valider les types de données avant envoi (ex: champ numérique, date…)
- [ ] Gérer les CSV mal formés (colonnes manquantes, lignes vides)
- [ ] Afficher un message clair si la ressource cible n'est pas accessible en écriture

---

## 🧪 Tests & Validation

- [ ] Tester avec différentes ressources (produits, clients, commandes…)
- [ ] Tester avec un CSV de grande taille (performance)
- [ ] Tester les cas de conflit (update sur données existantes)
- [ ] Tester avec des colonnes inconnues ou mal nommées
- [ ] Valider le comportement avec des caractères spéciaux dans le CSV

---

## 🚀 Finalisation

- [ ] Ajouter un historique des imports effectués (date, ressource, nb lignes)
- [ ] Documentation d'utilisation avec exemple de CSV attendu par ressource