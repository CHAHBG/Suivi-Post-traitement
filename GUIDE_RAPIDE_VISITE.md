# 🚀 Guide Rapide - Visite Guidée PROCASSEF

## Démarrage Rapide

### Lancer la visite
```javascript
window.guidedTour.start();
```

### Réinitialiser les préférences
```javascript
window.guidedTour.reset();
location.reload();
```

### Afficher la fenêtre de bienvenue
```javascript
window.guidedTour.showWelcome();
```

---

## Raccourcis Clavier

| Touche | Action |
|--------|--------|
| `→` ou `Entrée` | Suivant |
| `←` | Précédent |
| `Échap` | Quitter |

---

## Les 11 Étapes

1. **Navigation** - Onglets principaux
2. **Filtres** - Région et période
3. **KPI** - 6 indicateurs clés
4. **Date d'Objectif** - Projection d'atteinte
5. **Performance Jour** - Progression quotidienne
6. **Objectif Mois** - Vue mensuelle
7. **Graphique** - Évolution quotidienne
8. **Projection** - Fin de mois
9. **Pipeline** - NICAD → CTASF → Délibérées
10. **Performance** - Burn-up & vélocité
11. **Actualisation** - Rafraîchir les données

---

## Résolution Rapide

### Visite ne démarre pas
```javascript
// Vérifier la disponibilité
console.log(window.guidedTour);
// Attendre le chargement complet du dashboard
```

### Élément mal centré
- Attendez la fin du scroll
- Passez à l'étape suivante puis revenez
- Réinitialisez le zoom (Ctrl+0)

### Préférences non sauvegardées
- Vérifiez que localStorage est activé
- Ne pas utiliser le mode navigation privée
- Cochez "Ne plus afficher" avant de terminer

---

## API Complète

```javascript
// Démarrer la visite
window.guidedTour.start();

// Arrêter la visite
window.guidedTour.end();

// Réinitialiser
window.guidedTour.reset();

// Fenêtre de bienvenue
window.guidedTour.showWelcome();
```

---

## Amélioration de la Précision du Focus

### Nouvelles fonctionnalités (v1.0)

✅ **Scroll amélioré** - Centrage parfait des éléments  
✅ **Attente intelligente** - Vérifie que l'élément est visible  
✅ **Timeout de 3 secondes** - Passe à l'étape suivante si élément introuvable  
✅ **Z-index automatique** - Élève l'élément au-dessus des autres  
✅ **Nettoyage automatique** - Restaure les styles après la visite  
✅ **Transitions fluides** - Animations de 400ms  

### Paramètres de Focus

```javascript
// Dans guidedTour.js
const SCROLL_OPTIONS = {
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
};

const SPOTLIGHT_PADDING = 10; // px autour de l'élément
const TOOLTIP_PADDING = 20;   // px de l'élément au tooltip
const ELEMENT_WAIT_TIMEOUT = 3000; // ms avant de passer
const TRANSITION_DELAY = 250; // ms entre spotlight et tooltip
```

---

## Structure du Code

### Fichiers Modifiés

- `js/guidedTour.js` - Logique de la visite
- `css/guidedTour.css` - Styles de la visite

### Fonctions Clés

```javascript
// Attendre qu'un élément soit disponible
waitForElement(selector, callback, timeout)

// Mettre en évidence un élément
highlightElement(targetEl)

// Positionner le tooltip
positionTooltip(targetEl, position)

// Afficher une étape
showStep(stepIndex)

// Nettoyer les styles
cleanupElementStyles()
```

---

## Tests Recommandés

### Checklist de Test

- [ ] La visite démarre automatiquement au premier chargement
- [ ] Tous les éléments sont correctement centrés
- [ ] Les transitions entre onglets fonctionnent
- [ ] Les raccourcis clavier répondent
- [ ] Les préférences sont sauvegardées
- [ ] Le mode responsive fonctionne
- [ ] Aucune erreur dans la console
- [ ] Le nettoyage des styles fonctionne

### Tester un Élément Spécifique

```javascript
// Vérifier si un élément est visible
const el = document.querySelector('#elementId');
console.log('Visible:', el.offsetParent !== null);
console.log('Position:', el.getBoundingClientRect());
```

---

## Performance

### Métriques Cibles

- **Temps de chargement** : < 500ms
- **Transition entre étapes** : 400ms
- **Attente après tab switch** : 500ms
- **Timeout élément** : 3000ms max

### Optimisations Appliquées

✅ Débounce sur window.resize  
✅ setTimeout pour animations asynchrones  
✅ Nettoyage des event listeners  
✅ Transitions CSS hardware-accelerated  

---

*Guide rapide mis à jour : 14 janvier 2026*
