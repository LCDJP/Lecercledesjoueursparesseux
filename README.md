# Correctif V2.0.1 — Galerie automatique

Ce correctif permet au site de détecter automatiquement les images déposées dans :

```text
assets/images/galerie/
```

## Fichiers contenus dans le ZIP

```text
assets/js/script.js
assets/data/gallery.json
.github/workflows/gallery.yml
```

## Installation sur GitHub

Importez le contenu du ZIP à la racine du dépôt en conservant exactement les dossiers.

- `assets/js/script.js` remplace le fichier existant.
- `assets/data/gallery.json` est ajouté.
- `.github/workflows/gallery.yml` est ajouté.

Cliquez ensuite sur **Commit changes**.

## Première génération

Après le commit :

1. Ouvrez l'onglet **Actions** du dépôt.
2. Cliquez sur **Mettre à jour la galerie**.
3. Attendez que l'action devienne verte.
4. Rechargez le site après le redéploiement de GitHub Pages.

L'action détecte automatiquement les extensions :

```text
.jpg .jpeg .png .webp .gif .avif
```

## Utilisation ensuite

Pour ajouter ou supprimer une photo, modifiez seulement le dossier :

```text
assets/images/galerie/
```

Le fichier `gallery.json` sera régénéré automatiquement.

## Important

Le dossier doit s'appeler exactement :

```text
assets/images/galerie
```

avec `galerie` en minuscules.

Les noms avec espaces et accents sont pris en charge, mais des noms simples restent recommandés.
