# AURAPEPT · Calculateur de reconstitution

Calculateur de reconstitution au thème japonais : concentration, graduation à prélever sur seringue U-100, seringue animée, étiquette de flacon imprimable, thème clair/sombre, version mobile.

En ligne : https://aurapept.github.io/

## Structure
- `index.html` : la page
- `assets/style.css`, `assets/app.js`, `assets/theme.js` : styles et scripts (aucun code en ligne, pour la politique de sécurité)
- `assets/fonts/` : polices Shippori Mincho et Zen Kaku Gothic New, hébergées sur le site (sous-ensembles des caractères utilisés), sous licence SIL Open Font License 1.1 (`OFL-*.txt`)
- `assets/og-share.png`, `assets/apple-touch-icon.png`, `assets/favicon-32.png` : image de partage et icônes

## Sécurité et vie privée
- Aucune requête vers un autre site : polices hébergées localement, aucun traceur, aucune donnée envoyée.
- Politique de sécurité (CSP) en balise meta : seuls les fichiers du site peuvent être chargés.
- Seul le choix de thème est gardé dans le navigateur (`localStorage`).

## Mise en ligne avec GitHub Pages
Ce dépôt est le site principal du compte : GitHub Pages publie la branche `main` sur https://aurapept.github.io/. Vérifier au besoin dans Settings → Pages → Source : « Deploy from a branch » → `main`, dossier `/ (root)`.

Si l'adresse du site change (nouveau dépôt ou nom de domaine), mettre à jour `canonical`, `og:url` et `og:image` dans `index.html`.

Outil informatif uniquement. Ce n'est pas un avis médical et aucune quantité n'est recommandée.
