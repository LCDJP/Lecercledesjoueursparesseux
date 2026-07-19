# Le Cercle des joueurs paresseux

Site vitrine statique de l'association, section du Foyer Rural de Vailhauquès.

## Structure

- `index.html` : page d'accueil
- `css/style.css` : mise en forme
- `js/script.js` : menu mobile et animations
- `images/logo.png` : logo
- `images/galerie/` : vos photos

## Ajouter vos photos

1. Placez vos fichiers dans `images/galerie/`.
2. Dans `index.html`, remplacez un bloc :

```html
<figure class="gallery-placeholder">
  <span>Soirée jeux de société</span>
</figure>
```

par :

```html
<figure>
  <img src="images/galerie/nom-de-la-photo.jpg" alt="Description de la photo">
</figure>
```

Vous pouvez ajouter dans `css/style.css` :

```css
.gallery-grid figure {
  margin: 0;
  overflow: hidden;
  border-radius: 18px;
}

.gallery-grid img {
  width: 100%;
  height: 220px;
  object-fit: cover;
}
```

## Liens Facebook et Instagram

Dans `index.html`, recherchez :

```html
href="#"
```

et remplacez les deux liens par les adresses de vos pages.

## Mise en ligne sur GitHub Pages

1. Créez un dépôt GitHub.
2. Importez tous les fichiers en conservant les dossiers.
3. Ouvrez `Settings` puis `Pages`.
4. Choisissez la branche `main` et le dossier `/root`.
5. Enregistrez.

Le site sera ensuite accessible à une adresse de type :

`https://votre-compte.github.io/nom-du-depot/`
