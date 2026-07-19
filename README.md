# Le Cercle des Joueurs Paresseux — V2.0

Cette archive remplace entièrement la V1 du site.

## Contenu

```text
index.html
assets/
├── css/
│   └── style.css
├── js/
│   └── script.js
└── images/
    ├── logo.png
    ├── galerie/
    └── jeux/
README.md
```

## Mise à jour sur GitHub

1. Décompressez l'archive.
2. Dans le dépôt GitHub, supprimez les anciens fichiers de la V1 ou remplacez-les.
3. Importez **le contenu du dossier `LCDJP_V2.0`**, et non le dossier lui-même.
4. Vérifiez que `index.html` est directement visible à la racine du dépôt.
5. Cliquez sur **Commit changes**.
6. GitHub Pages republiera automatiquement le site après quelques minutes.

## Ajouter les liens Facebook et Instagram

Dans `index.html`, recherchez :

```html
data-social="facebook"
data-social="instagram"
```

Remplacez le `href="#"` correspondant par l'adresse complète de la page.

## Ajouter des photos à la galerie

Placez vos images dans :

```text
assets/images/galerie/
```

Puis remplacez par exemple :

```html
<figure class="gallery-tile">
  <span>Jeux de société</span>
</figure>
```

par :

```html
<figure class="gallery-tile gallery-photo">
  <img src="assets/images/galerie/soiree-jeux.jpg"
       alt="Des membres réunis autour d'un jeu de société">
</figure>
```

Ajoutez ensuite à la fin de `assets/css/style.css` :

```css
.gallery-photo {
  overflow: hidden;
  padding: 0;
}

.gallery-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

## Modifier le jeu du moment

Dans `index.html`, recherchez :

```text
Le jeu du moment
```

Vous pourrez remplacer le titre, le texte et les informations.

## Adresse du club

La V2.0 utilise :

```text
Salle de l'Âge d'Or
19 Route de Montarnaud
34570 Vailhauquès
```

## Important

Ne renommez pas les dossiers `assets`, `css`, `js` ou `images` sans mettre à jour les chemins dans `index.html`.
