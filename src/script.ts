const clientId = "8a1ae424ec284f3da8fbab114d3b470e"; // Replace with your client id
const params = new URLSearchParams(window.location.search);
const code = params.get("code"); // récupérer le code d'autorisation de l'URL


if (localStorage.getItem("access_token")!== null) { // vérifier si le token d'accès est déjà stocké dans le localStorage
    let accessToken = localStorage.getItem("access_token")!; // récupérer le token d'accès depuis le localStorage
    
    if (isTokenExpired()) {
        accessToken = await refreshAccessToken();
    }

    fetchProfile(accessToken).then(profile => { // récupérer le profil de l'utilisateur
            console.log("Profile:", profile); // afficher le profil de l'utilisateur dans la console
            populateUI(profile); // mettre à jour l'interface utilisateur avec les informations du profil
            showFollowedArtists(accessToken);
        });
} else if (!code) { // vérifier si le code d'autorisation est présent dans l'URL
    if (localStorage.getItem("logged_out")){
        showLoginButton();
    } else {
        redirectToAuthCodeFlow(clientId); // rediriger l'utilisateur vers la page d'autorisation de Spotify pour obtenir un code d'autorisation
    }
} else {
    const accessToken = await getAccessToken(clientId, code); // récupérer le token d'accès en utilisant le code d'autorisation
    localStorage.setItem("access_token", accessToken); // stocker le token d'accès dans le localStorage pour une utilisation future
    const profile = await fetchProfile(accessToken); // récupérer le profil de l'utilisateur en utilisant le token d'accès
    console.log("Profile:", profile); // afficher le profil de l'utilisateur dans la console
    populateUI(profile); // mettre à jour l'interface utilisateur avec les informations du profil
    showFollowedArtists(accessToken);
}



export async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", "http://127.0.0.1:5173/callback");
    params.append("scope", "user-read-private user-read-email user-follow-read user-follow-modify user-library-read user-library-modify");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);
    params.append("show_dialog", "true"); // Spotify affiche toujours la page d'autorisation
    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length: number) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier: string) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export async function getAccessToken(clientId: string, code: string): Promise<string> {
    const verifier = localStorage.getItem("verifier");
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "http://127.0.0.1:5173/callback");
    params.append("code_verifier", verifier!);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token, refresh_token, expires_in } = await result.json();

    // Durée de vie du token : on sauvegarde le refresh token et la date d'expiration
    localStorage.setItem("refresh_token", refresh_token);
    localStorage.setItem("expires_at", String(Date.now() + expires_in * 1000));

    return access_token;
}

async function fetchProfile(token: string): Promise<any> {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

function populateUI(profile: any) {
    document.getElementById("displayName")!.innerText = profile.display_name;
    if (profile.images[0]) {
        const profileImage = new Image(200, 200);
        profileImage.src = profile.images[0].url;
        document.getElementById("avatar")!.appendChild(profileImage);
    }
    document.getElementById("id")!.innerText = profile.id;
    document.getElementById("email")!.innerText = profile.email;
    document.getElementById("uri")!.innerText = profile.uri;
    document.getElementById("uri")!.setAttribute("href", profile.external_urls.spotify);
    document.getElementById("url")!.innerText = profile.href;
    document.getElementById("url")!.setAttribute("href", profile.href);
    document.getElementById("imgUrl")!.innerText = profile.images[0]?.url ?? '(no profile image)';
}

// Vérifie si le token a expiré
function isTokenExpired(): boolean {
    const expiresAt = Number(localStorage.getItem("expires_at"));
    return Date.now() > expiresAt;
}

// Demande un nouveau token à Spotify grâce au refresh token (sans reconnexion)
async function refreshAccessToken(): Promise<string> {
    const refreshToken = localStorage.getItem("refresh_token");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken!);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    // Refresh token absent ou refusé : on vide le stockage et on redemande la connexion
    if (!result.ok) {
        localStorage.clear();
        await redirectToAuthCodeFlow(clientId);
        throw new Error("Refresh token invalide, reconnexion nécessaire");
    }

    const { access_token, refresh_token, expires_in } = await result.json();
    console.log("Token expiré, renouvelé !");

    localStorage.setItem("access_token", access_token);
    if (refresh_token) {
        localStorage.setItem("refresh_token", refresh_token); // Spotify peut en renvoyer un nouveau
    }
    localStorage.setItem("expires_at", String(Date.now() + expires_in * 1000));

    return access_token;
}

// Récupère TOUS les artistes suivis (Spotify renvoie au maximum 50 artistes par page)
async function fetchFollowedArtists(token: string): Promise<any[]> {
    let artists: any[] = [];
    let url: string | null = "https://api.spotify.com/v1/me/following?type=artist&limit=50";

    while (url) {
        const result = await fetch(url, {
            method: "GET", headers: { Authorization: `Bearer ${token}` }
        });
        const data = await result.json();

        artists = artists.concat(data.artists.items); // on ajoute la page courante
        url = data.artists.next;                       // page suivante (null s'il n'y en a plus)
    }

    return artists;
}

// Affiche les artistes suivis avec leur image et un lien vers Spotify
async function showFollowedArtists(token: string) {
    const artists = await fetchFollowedArtists(token);
    const container = document.getElementById("artistsList")!;
    container.innerHTML = "";

    if (artists.length === 0) {
        container.innerText = "Vous ne suivez aucun artiste.";
        return;
    }

    for (const artist of artists) {
        const card = document.createElement("div");
        card.className = "artist-card";

        const image = artist.images[0]?.url ?? "";
        card.innerHTML = `
            <img src="${image}" alt="${artist.name}">
            <p>${artist.name}</p>
            <a href="${artist.external_urls.spotify}" target="_blank">Ouvrir dans Spotify</a>
        `;

        container.appendChild(card);
    }
}

// Recherche de musique avec pagination et lecture
const LIMIT = 10;          // Spotify : 10 résultats maximum par page
let currentQuery = "";
let currentOffset = 0;

// Renvoie un token valable (renouvelé s'il a expiré)
async function getToken(): Promise<string> {
    if (isTokenExpired()) {
        return await refreshAccessToken();
    }
    return localStorage.getItem("access_token")!;
}

// Appelle l'API de recherche de Spotify
async function searchTracks(query: string, offset: number): Promise<any> {
    const token = await getToken();
    const params = new URLSearchParams({
        q: query,
        type: "track",
        limit: String(LIMIT),
        offset: String(offset),
    });

    const result = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    const data = await result.json();
    return data.tracks; // { items, total, offset, next, previous }
}

// Affiche une page de résultats
async function showSearchPage(offset: number) {
    currentOffset = offset;
    const tracks = await searchTracks(currentQuery, offset);
    const list = document.getElementById("searchResults")!;
    list.innerHTML = "";

    if (tracks.items.length === 0) {
        list.innerHTML = "<li>Aucun résultat.</li>";
    }

    for (const track of tracks.items) {
        const li = document.createElement("li");
        const image = track.album.images[0]?.url ?? "";
        const artists = track.artists.map((a: any) => a.name).join(", ");

        li.innerHTML = `
            <img src="${image}" alt="${track.album.name}">
            <div>
                <strong>${track.name}</strong><br>
                ${artists}
            </div>
            <button>▶ Écouter</button>
        `;

        // Lecture : on charge le lecteur officiel Spotify pour ce morceau
        li.querySelector("button")!.addEventListener("click", () => playTrack(track.id));
        list.appendChild(li);
    }

    // Pagination
    const page = Math.floor(offset / LIMIT) + 1;
    const totalPages = Math.ceil(tracks.total / LIMIT);
    document.getElementById("pageInfo")!.innerText = `Page ${page} / ${totalPages}`;
    (document.getElementById("prevPage") as HTMLButtonElement).disabled = tracks.previous === null;
    (document.getElementById("nextPage") as HTMLButtonElement).disabled = tracks.next === null;
}

// Affiche le lecteur Spotify intégré
function playTrack(trackId: string) {
    document.getElementById("player")!.innerHTML = `
        <iframe src="https://open.spotify.com/embed/track/${trackId}?autoplay=1"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"></iframe>
    `;
}

// Formulaire de recherche : on repart toujours de la page 1
document.getElementById("searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault(); // empêche le rechargement de la page
    currentQuery = (document.getElementById("searchInput") as HTMLInputElement).value;
    showSearchPage(0);
});

// Boutons de pagination
document.getElementById("prevPage")?.addEventListener("click", () => showSearchPage(currentOffset - LIMIT));
document.getElementById("nextPage")?.addEventListener("click", () => showSearchPage(currentOffset + LIMIT));

// Déconnexion : on oublie les tokens et on mémorise que l'utilisateur s'est déconnecté
document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.clear();
    localStorage.setItem("logged_out", "true");
    window.location.href = "/";
});

// Après une déconnexion : on cache la page et on affiche un bouton de connexion
function showLoginButton() {
    document.querySelectorAll("section").forEach(section => {
        (section as HTMLElement).style.display = "none";
    });
    document.getElementById("logout")!.style.display = "none";

    const loginButton = document.createElement("button");
    loginButton.innerText = "Se connecter avec Spotify";
    loginButton.addEventListener("click", () => {
        localStorage.removeItem("logged_out");
        redirectToAuthCodeFlow(clientId);
    });

    document.querySelector("h1")!.after(loginButton);
}

// (Optionnel) Rechercher un artiste, le suivre / ne plus le suivre

// Vérifie si l'utilisateur suit déjà l'artiste
async function isFollowingArtist(artistId: string): Promise<boolean> {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const uri = encodeURIComponent(`spotify:artist:${artistId}`);

    // Nouvelle route (2026), puis ancienne route en secours
    let result = await fetch(`https://api.spotify.com/v1/me/library/contains?uris=${uri}`, { headers });
    if (!result.ok) {
        result = await fetch(`https://api.spotify.com/v1/me/following/contains?type=artist&ids=${artistId}`, { headers });
    }

    const data = await result.json(); // ex. [true] ou [false]
    return data[0] === true;
}

// Suit (PUT) ou ne suit plus (DELETE) un artiste
async function setFollowArtist(artistId: string, follow: boolean) {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const method = follow ? "PUT" : "DELETE";
    const uri = encodeURIComponent(`spotify:artist:${artistId}`);

    // Nouvelle route (2026), puis ancienne route en secours
    let result = await fetch(`https://api.spotify.com/v1/me/library?uris=${uri}`, { method, headers });
    if (!result.ok) {
        result = await fetch(`https://api.spotify.com/v1/me/following?type=artist&ids=${artistId}`, { method, headers });
    }

    if (!result.ok) {
        throw new Error(`Impossible de modifier le suivi (code ${result.status})`);
    }
}

// Recherche des artistes et affiche un bouton Suivre / Ne plus suivre
async function searchArtists(query: string) {
    const token = await getToken();
    const params = new URLSearchParams({ q: query, type: "artist", limit: "10" });

    const result = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    const data = await result.json();

    const list = document.getElementById("artistResults")!;
    list.innerHTML = "";

    for (const artist of data.artists.items) {
        const following = await isFollowingArtist(artist.id);
        const li = document.createElement("li");
        const image = artist.images[0]?.url ?? "";

        li.innerHTML = `
            <img src="${image}" alt="${artist.name}">
            <a href="${artist.external_urls.spotify}" target="_blank">${artist.name}</a>
            <button>${following ? "Ne plus suivre" : "Suivre"}</button>
        `;

        const button = li.querySelector("button")!;
        let isFollowed = following;

        button.addEventListener("click", async () => {
            button.disabled = true;
            await setFollowArtist(artist.id, !isFollowed);
            isFollowed = !isFollowed;
            button.innerText = isFollowed ? "Ne plus suivre" : "Suivre";
            button.disabled = false;

            // Met à jour la liste des artistes suivis plus haut dans la page
            showFollowedArtists(await getToken());
        });

        list.appendChild(li);
    }
}

document.getElementById("artistSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = (document.getElementById("artistSearchInput") as HTMLInputElement).value;
    searchArtists(query);
});