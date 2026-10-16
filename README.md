# 🎧 Spotify Profile Demo

Application web en **Vite + TypeScript** qui utilise l'**API Web de Spotify** : connexion de l'utilisateur avec OAuth 2.0 (PKCE), affichage du profil, des artistes suivis, recherche de musique paginée avec lecture, et suivi d'artistes.

Projet réalisé dans le cadre du cas pratique « Utiliser l'API de Spotify » du cours sur les API.

> **Objectif :** se familiariser avec le concept d'API en créant une application qui récupère des informations depuis l'API de Spotify.
> Documentation : https://developer.spotify.com/documentation/web-api

---

## 📋 Consignes du cas pratique

| # | Consigne | Réalisation | Statut |
|---|---|---|---|
| 1 | Créer un compte « Spotify for Developers » et récupérer un `client_id` et un `client_secret` | Application créée sur le Spotify Developer Dashboard | ✅ |
| 2 | Tester la récupération de token avec Postman ou Insomnia | `POST https://accounts.spotify.com/api/token` (Client Credentials) | ✅ |
| 3 | Tester le token sur deux requêtes de l'API | `GET /v1/search` et `GET /v1/artists/{id}` | ✅ |
| 4 | Récupérer les informations d'un profil utilisateur Spotify | Connexion PKCE + `GET /v1/me` | ✅ |
| 5 | Sauvegarder le token pour ne pas demander l'authentification systématiquement | `localStorage` | ✅ |
| 6 | Gérer la durée de vie du token | `expires_at` + refresh token | ✅ |
| 7 | Récupérer la liste des artistes suivis avec illustrations et lien vers Spotify | `GET /v1/me/following?type=artist` | ✅ |
| 8 | Recherche de musique avec pagination et lecture | `GET /v1/search?type=track` + lecteur intégré | ✅ |
| 9 | (Optionnel) Rechercher un artiste et le suivre ou ne plus le suivre | `PUT` / `DELETE /v1/me/library` | ✅ |

---

## 🧪 Consignes 2 et 3 : token avec Postman

**Récupérer un token (Client Credentials)**

| Élément | Valeur |
|---|---|
| Méthode | `POST` |
| URL | `https://accounts.spotify.com/api/token` |
| Body | `x-www-form-urlencoded` |
| Champs | `grant_type=client_credentials`, `client_id`, `client_secret` |

Réponse :

```json
{
  "access_token": "BQD...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Tester le token sur deux requêtes** (Authorization → Bearer Token) :

```http
GET https://api.spotify.com/v1/search?q=goldman&type=artist&limit=5
GET https://api.spotify.com/v1/artists/{id}
```

> Ce token représente l'application, pas un utilisateur : il ne permet pas d'appeler `/v1/me`. Pour le profil, l'application web utilise le flux **Authorization Code avec PKCE** (voir plus bas).

---

## ✨ Fonctionnalités

| Fonctionnalité | Route de l'API Spotify |
|---|---|
| Connexion de l'utilisateur (Authorization Code + PKCE) | `GET accounts.spotify.com/authorize`, `POST /api/token` |
| Affichage du profil | `GET /v1/me` |
| Token sauvegardé (pas de reconnexion à chaque visite) | `localStorage` |
| Renouvellement automatique du token après 1 h | `POST /api/token` (`grant_type=refresh_token`) |
| Artistes suivis avec photo et lien Spotify | `GET /v1/me/following?type=artist` |
| Recherche de musique paginée (10 par page) | `GET /v1/search?type=track` |
| Lecture d'un morceau | Lecteur intégré `open.spotify.com/embed` |
| Recherche d'artistes + suivre / ne plus suivre | `GET /v1/search?type=artist`, `PUT` / `DELETE /v1/me/library` |
| Déconnexion | `localStorage.clear()` |

---

## 🧰 Technologies

- [Vite](https://vite.dev/) + TypeScript (template `vanilla-ts`)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- HTML / CSS (thème sombre façon Spotify, police Figtree)

---

## ✅ Prérequis

- **Node.js** 18 ou plus récent et **npm**
- Un **compte Spotify Premium** : depuis 2026, le propriétaire d'une application en mode développement doit avoir un abonnement actif
- Une application créée sur le [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

---

## ⚙️ Configuration de l'application Spotify

1. Sur le [Dashboard](https://developer.spotify.com/dashboard), cliquer sur **Create app**.
2. Ajouter la **Redirect URI** suivante (avec `127.0.0.1`, Spotify refuse `localhost`) :

```
   http://127.0.0.1:5173/callback
```

3. Cocher **Web API**, puis **Save**.
4. Dans **Settings**, copier le **Client ID**.
5. Dans `src/script.ts`, remplacer la valeur de `clientId` par ce Client ID.
6. Dans **User Management**, ajouter l'adresse e-mail des comptes Spotify qui testeront l'application (5 maximum).

> ⚠️ Le **Client secret** n'est **pas** utilisé par l'application : grâce à PKCE, il ne doit jamais apparaître dans le code ni dans le dépôt.

---

## 🚀 Installation et lancement

```bash
git clone <url-du-depot> spotify-profile-demo
cd spotify-profile-demo
npm install
npm run dev
```

Ouvrir **http://127.0.0.1:5173** (et non `localhost`), puis se connecter avec son compte Spotify et accepter les permissions.

---

## 🔐 Permissions demandées (scopes)

| Scope | Utilisé pour |
|---|---|
| `user-read-private`, `user-read-email` | Profil de l'utilisateur |
| `user-follow-read` | Liste des artistes suivis |
| `user-follow-modify`, `user-library-read`, `user-library-modify` | Suivre / ne plus suivre un artiste |

> Après l'ajout d'un nouveau scope, il faut se reconnecter : `localStorage.clear()` dans la console du navigateur, puis F5.

---

## 🔄 Fonctionnement de l'authentification

1. L'application génère un `code_verifier` aléatoire et son empreinte SHA-256, le `code_challenge`.
2. L'utilisateur est redirigé vers `accounts.spotify.com/authorize` avec le `client_id`, les scopes et le `code_challenge`.
3. Après acceptation, Spotify renvoie sur `/callback?code=...`.
4. L'application échange le `code` et le `code_verifier` contre un **access token** (1 h) et un **refresh token**.
5. Les tokens et leur date d'expiration (`expires_at`) sont enregistrés dans le `localStorage`.
6. Avant chaque appel, `getToken()` vérifie l'expiration et renouvelle le token si besoin.

---

## 📄 Pagination

| Type | Utilisé pour | Principe |
|---|---|---|
| Par curseur | Artistes suivis | On suit le champ `next` jusqu'à ce qu'il vaille `null` |
| Par offset | Recherche de musique | `offset = (page - 1) × 10` (10 résultats max par page depuis 2026) |

---

## 📁 Structure du projet

```
spotify-profile-demo/
├── index.html        # page de l'application (profil, artistes, recherche)
├── style.css         # thème sombre façon Spotify
├── src/
│   ├── script.ts     # tout le code de l'application
│   └── main.ts       # page d'exemple Vite (non utilisée)
├── package.json
└── README.md
```

---

## 🧪 Tester

| Test | Résultat attendu |
|---|---|
| Première visite | Redirection vers la page de connexion Spotify |
| Après connexion, F5 | Le profil s'affiche sans reconnexion |
| `localStorage.setItem("expires_at", "0")` dans la console, puis F5 | « Token expiré, renouvelé ! » dans la console, sans reconnexion |
| Recherche « daft punk », bouton Suivant | Page 2, résultats 11 à 20 |
| Clic sur Écouter | Le lecteur Spotify apparaît et lance le morceau |
| Suivre un artiste | Il apparaît dans « Artistes suivis » |
| Bouton Déconnexion | Retour à la page de connexion |

---

## ⚠️ Changements de l'API Spotify en 2026

- Le propriétaire de l'application doit être **Premium**, et l'application est limitée à **5 utilisateurs** en mode développement.
- La recherche renvoie **10 résultats maximum** par page.
- Les routes `PUT/DELETE /me/following` sont **dépréciées** : l'application utilise `PUT/DELETE /me/library` (avec des URI `spotify:artist:ID`) et garde l'ancienne route comme solution de secours.
- Les extraits audio `preview_url` ne sont plus fournis : la lecture passe par le lecteur intégré officiel.
- `localhost` n'est plus accepté dans les Redirect URI : utiliser `127.0.0.1`.

---

## 🛠️ Problèmes fréquents

| Problème | Solution |
|---|---|
| `INVALID_CLIENT: Invalid redirect URI` | La Redirect URI du Dashboard doit être exactement `http://127.0.0.1:5173/callback` |
| Erreur 401 ou profil « undefined » après un F5 | Aller sur `http://127.0.0.1:5173/`, `localStorage.clear()`, puis F5 |
| Erreur 403 sur les artistes ou le suivi | Scope manquant ou utilisateur non ajouté dans User Management : se reconnecter |
| Les modifications du code n'ont pas d'effet | Le code est dans `src/script.ts`, pas dans `src/main.ts` |