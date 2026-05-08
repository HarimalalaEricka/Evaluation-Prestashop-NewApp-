Réinitialisation de Données PrestaShop

---

## Setup & Architecture

- [x] Configurer les variables d'environnement (URL de l'API PS, clé API, etc.)
- [x] Mettre en place l'authentification vers l'API PrestaShop (Basic Auth / API Key)

---

## API — Récupération des ressources

- [x] Identifier l'endpoint PrestaShop qui liste toutes les ressources disponibles (`/api/` retourne la liste)
- [x] Créer un service/fonction `getResources()` qui appelle cet endpoint
- [x] Parser la réponse pour extraire les noms et URLs de chaque ressource
- [x] Gérer les erreurs (timeout, auth échouée, ressource inaccessible)

---

## UI — Affichage & Sélection

- [x] Créer la page/composant principal "Réinitialisation"
- [x] Afficher la liste des ressources récupérées dynamiquement
- [x] Ajouter une checkbox par ressource
- [x] Ajouter un bouton **Tout sélectionner / Tout désélectionner**
- [x] Désactiver le bouton "Supprimer" si aucune ressource cochée
- [x] Ajouter un indicateur de chargement pendant la récupération de la liste

---

## API — Suppression des données

- [x] Créer un service/fonction `deleteResourceData(resourceName)`
- [x] Implémenter la logique pour récupérer les IDs de chaque ressource sélectionnée
- [x] Appeler l'endpoint de suppression pour chaque item de chaque ressource
- [x] Gérer la suppression en batch ou séquentielle (éviter de surcharger l'API)
- [x] Gérer les erreurs par ressource (certaines peuvent échouer, d'autres réussir)

---

## UX — Confirmation & Feedback

- [x] Ajouter une **modale de confirmation** avant la suppression ("Êtes-vous sûr ?")
- [x] Afficher un rapport de résultat après (succès / échecs par ressource)
- [x] Notifier l'utilisateur en cas d'erreur partielle

---

## 🧪 Tests & Validation

- [ ] Tester sur un environnement PrestaShop de développement
- [ ] Vérifier que les ressources protégées ne sont pas supprimables
- [ ] Tester les cas d'erreur (API down, mauvaise clé, ressource vide)
- [ ] Valider le comportement avec une grande quantité de données

---

## 🚀 Finalisation

- [ ] Ajouter des logs des opérations effectuées
- [ ] Sécuriser l'accès à l'application (login, rôles)
- [ ] Documentation d'utilisation