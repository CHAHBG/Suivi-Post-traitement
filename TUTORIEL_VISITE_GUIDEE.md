# 🎯 Tutoriel de la Visite Guidée - PROCASSEF Dashboard

## 📋 Table des Matières
1. [Introduction](#introduction)
2. [Démarrage de la Visite](#démarrage-de-la-visite)
3. [Navigation dans la Visite](#navigation-dans-la-visite)
4. [Étapes de la Visite](#étapes-de-la-visite)
5. [Raccourcis Clavier](#raccourcis-clavier)
6. [Résolution des Problèmes](#résolution-des-problèmes)

---

## 🎓 Introduction

La visite guidée du tableau de bord PROCASSEF est un outil interactif conçu pour vous aider à découvrir toutes les fonctionnalités de l'application. Cette visite vous accompagne étape par étape à travers les différentes sections du tableau de bord.

### Caractéristiques Principales
- ✨ **11 étapes interactives** couvrant toutes les fonctionnalités
- 🎯 **Focus automatique** sur chaque élément
- ⌨️ **Raccourcis clavier** pour une navigation rapide
- 💾 **Préférences sauvegardées** pour ne pas répéter la visite
- 🔄 **Possibilité de reprendre** la visite à tout moment

---

## 🚀 Démarrage de la Visite

### Première Visite Automatique

Lors de votre première connexion au tableau de bord, une fenêtre de bienvenue apparaît automatiquement :

```
┌─────────────────────────────────────────┐
│         🧭 Bienvenue sur PROCASSEF !    │
│                                          │
│  Souhaitez-vous faire une visite        │
│  guidée du tableau de bord ?            │
│                                          │
│  Cette visite vous présentera les       │
│  principales fonctionnalités en         │
│  quelques minutes.                      │
│                                          │
│  [ Non merci ]  [ ▶ Commencer ]         │
│                                          │
│  ☐ Ne plus me demander                  │
└─────────────────────────────────────────┘
```

**Options disponibles :**
- **▶ Commencer la visite** : Lance immédiatement la visite guidée
- **Non merci** : Ferme la fenêtre et accède directement au tableau de bord
- **☐ Ne plus me demander** : Désactive l'affichage automatique de cette fenêtre

### Relancer la Visite Manuellement

Vous pouvez relancer la visite à tout moment en utilisant la console du navigateur :

```javascript
// Ouvrir la console (F12) et taper :
window.guidedTour.start();
```

Ou afficher de nouveau la fenêtre de bienvenue :

```javascript
window.guidedTour.showWelcome();
```

### Réinitialiser les Préférences

Pour réinitialiser toutes vos préférences de visite :

```javascript
window.guidedTour.reset();
// Puis recharger la page
location.reload();
```

---

## 🧭 Navigation dans la Visite

### Interface de la Visite

Chaque étape de la visite comprend :

```
┌───────────────────────────────────────┐
│ [Titre de l'étape]              [×]   │
├───────────────────────────────────────┤
│                                       │
│  Description détaillée de             │
│  l'élément et de son utilité          │
│                                       │
├───────────────────────────────────────┤
│ 3 / 11            [ Passer ] [ ← ] [→]│
└───────────────────────────────────────┘
│
└─→ (Élément surligné avec halo lumineux)
```

**Composants de l'interface :**

1. **En-tête** :
   - **Titre** : Nom de l'élément expliqué
   - **Bouton × (Fermer)** : Arrête la visite

2. **Contenu** :
   - **Description** : Explication détaillée de la fonctionnalité

3. **Pied de page** :
   - **Compteur** : Étape actuelle / Total des étapes
   - **Bouton "Passer"** : Termine la visite sans la compléter
   - **Bouton "←" (Précédent)** : Retourne à l'étape précédente (désactivé à la première étape)
   - **Bouton "→" (Suivant)** : Passe à l'étape suivante (devient "Terminer" à la dernière étape)

4. **Case à cocher** :
   - **☐ Ne plus afficher cette visite** : Option pour désactiver la visite

### Effet de Surbrillance

L'élément actuellement expliqué est mis en évidence par :
- 🔦 **Un halo lumineux pulsant** bleu autour de l'élément
- 🎯 **Un assombrissement du reste de la page** (overlay noir transparent)
- 📍 **Scroll automatique** pour centrer l'élément dans la fenêtre
- ⬆️ **Élévation visuelle** (z-index élevé) pour le faire ressortir

---

## 📚 Étapes de la Visite

### Onglet "Vue d'ensemble" (7 étapes)

#### Étape 1/11 : Navigation Principale
**Élément ciblé** : `.nav-tabs`  
**Position** : En bas de l'élément  

**Description** :
Découvrez les onglets de navigation qui vous permettent d'accéder aux quatre sections principales :
- 🏠 Vue d'ensemble
- 📊 Analyse Performance
- 🗺️ Analyse Régionale
- ⏱️ Suivi Temporel

**Capture** :
```
┌─────────────────────────────────────┐
│ [Vue d'ensemble] [Analyse Performance] │
│  ▼ (Halo lumineux)                   │
└──────────────────────────────────────┘
```

---

#### Étape 2/11 : Filtres
**Élément ciblé** : `#regionFilter`  
**Position** : En bas de l'élément  

**Description** :
Apprenez à utiliser les filtres pour affiner vos données :
- **Filtre Région** : Sélectionnez une région spécifique ou "Toutes les régions"
- **Filtre Période** : Choisissez entre Quotidien, Hebdomadaire ou Mensuel

**Exemple d'utilisation** :
```
[Région: Toutes ▼]  [Période: Quotidien ▼]
```

---

#### Étape 3/11 : Indicateurs Clés (KPI)
**Élément ciblé** : `.kpi-card:first-child`  
**Position** : En bas de l'élément  

**Description** :
Découvrez les 6 cartes KPI qui affichent les métriques essentielles :

1. **📈 Taux de Réussite** : Pourcentage de parcelles traitées avec succès
2. **📦 Prochain Lot** : Numéro du prochain lot à traiter
3. **❌ Pertes** : Nombre de parcelles perdues
4. **⚡ Cadence Requise** : Rythme nécessaire pour atteindre l'objectif
5. **📊 Écart Cumulé** : Différence entre objectif et réalisé
6. **📅 Date Fin Objectif** : Date estimée d'atteinte de l'objectif

**Astuce** : Survolez chaque carte pour voir le détail des calculs !

---

#### Étape 4/11 : Date Fin Objectif
**Élément ciblé** : `#completionConfidence`  
**Position** : À gauche de l'élément  

**Description** :
Cette date indique quand l'objectif mensuel sera atteint au rythme actuel.

**Calcul** :
```
Date d'Objectif = Aujourd'hui + (Parcelles Restantes / Moyenne Quotidienne)
```

**Codes couleur** :
- 🟢 **Vert** : Objectif atteignable dans les temps
- 🟡 **Jaune** : Objectif difficile mais possible
- 🔴 **Rouge** : Objectif probablement non atteignable

---

#### Étape 5/11 : Performance Journalière
**Élément ciblé** : `#dailyStat`  
**Position** : À gauche de l'élément  

**Description** :
Suivez votre progression quotidienne en temps réel.

**Affichage** :
```
Aujourd'hui
─────────────────────
45 / 50 parcelles
[████████░░] 90%
```

La barre de progression et le pourcentage indiquent où vous en êtes par rapport à l'objectif du jour.

---

#### Étape 6/11 : Objectif Mensuel
**Élément ciblé** : `#monthlyStat`  
**Position** : À gauche de l'élément  

**Description** :
Vue d'ensemble de la progression vers l'objectif du mois.

**Éléments affichés** :
- Nombre actuel / Objectif total
- Pourcentage de complétion
- Graphique sparkline montrant la tendance récente (7 derniers jours)

---

#### Étape 7/11 : Évolution Quotidienne
**Élément ciblé** : `#overviewDailyYieldsChart`  
**Position** : En haut de l'élément  

**Description** :
Ce graphique montre l'évolution des levées jour par jour sur les 30 derniers jours.

**Légende** :
- 📊 **Barres bleues** : Levées réelles par jour
- 📈 **Ligne rouge pointillée** : Objectif quotidien
- **Zone verte** : Au-dessus de l'objectif
- **Zone rouge** : En-dessous de l'objectif

---

#### Étape 8/11 : Projection Fin de Mois
**Élément ciblé** : `#forecastContent`  
**Position** : À gauche de l'élément  

**Description** :
Cette section calcule si l'objectif mensuel est atteignable au rythme actuel.

**Informations affichées** :
- **Taux Requis vs Taux Actuel** : Comparaison des cadences
- **Parcelles Restantes** : Nombre à traiter
- **Date Estimée** : Projection d'atteinte de l'objectif
- **Écart** : Différence entre objectif et prévision

---

#### Étape 9/11 : Statut du Pipeline
**Élément ciblé** : `#monitoringIndicators`  
**Position** : En haut de l'élément  

**Description** :
Visualisez la progression des parcelles à travers les différentes étapes du processus.

**Étapes du pipeline** :
1. **NICAD** : Première étape de traitement
2. **CTASF** : Validation technique
3. **Délibérées** : Décision finale

**Visualisation** :
```
NICAD → CTASF → Délibérées
 85%     70%        45%
```

---

### Onglet "Analyse Performance" (1 étape)

#### Étape 10/11 : Analyse Performance
**Élément ciblé** : `[data-panel="performance"]`  
**Position** : En bas de l'élément  
**Action** : Clic automatique sur l'onglet

**Description** :
Cet onglet offre une vue détaillée des performances avec :
- 📈 **Graphique Burn-Up** : Progression cumulée vers l'objectif
- ⚡ **Vélocité** : Vitesse de traitement au fil du temps
- 📊 **Analyse des tendances** : Prédictions et analyses statistiques

---

### Onglet "Analyse Régionale" (Étape intégrée)

**Élément ciblé** : `[data-panel="regional"]`  
**Position** : En bas de l'élément  
**Action** : Clic automatique sur l'onglet

**Description** :
Comparez les performances par commune et région :
- 🗺️ **Vue par région** : Performances agrégées
- 🏘️ **Vue par commune** : Détails pour chaque commune
- 📅 **Chronogramme** : Ligne de temps détaillée des activités

---

### Onglet "Suivi Temporel" (Étape intégrée)

**Élément ciblé** : `[data-panel="temporal"]`  
**Position** : En bas de l'élément  
**Action** : Clic automatique sur l'onglet

**Description** :
Analysez les données sur différentes périodes :
- 📅 **Vue journalière** : Détail jour par jour
- 📊 **Vue hebdomadaire** : Agrégation par semaine
- 📈 **Vue mensuelle** : Tendances mensuelles
- 📋 **Tableaux détaillés** : Export et analyse approfondie

---

### Étape Finale (11/11) : Actualisation des Données

#### Étape 11/11 : Actualisation
**Élément ciblé** : `#refreshBtn`  
**Position** : En bas de l'élément  
**Action** : Retour automatique sur l'onglet "Vue d'ensemble"

**Description** :
Les données sont automatiquement actualisées toutes les 5 minutes, mais vous pouvez forcer une actualisation immédiate.

**Utilisation** :
```
[🔄 Actualiser]  ← Cliquez pour rafraîchir manuellement
```

**Indicateurs d'actualisation** :
- 🔄 **Icône en rotation** : Actualisation en cours
- ✓ **Icône statique** : Données à jour
- **Timestamp** : Heure de la dernière actualisation

---

## ⌨️ Raccourcis Clavier

Naviguez plus rapidement dans la visite avec ces raccourcis :

| Touche | Action |
|--------|--------|
| **→** ou **Entrée** | Étape suivante |
| **←** | Étape précédente |
| **Échap** | Quitter la visite |

**Astuce** : Ces raccourcis fonctionnent même quand un bouton n'a pas le focus !

---

## 🔧 Résolution des Problèmes

### L'élément n'est pas bien centré

**Cause** : L'élément peut être masqué par un autre élément ou hors de la fenêtre.

**Solution** :
1. Attendez que le scroll automatique se termine
2. Si le problème persiste, passez à l'étape suivante puis revenez
3. Essayez de zoomer/dézoomer le navigateur (Ctrl + 0 pour réinitialiser)

### La visite ne démarre pas

**Cause** : Les éléments du tableau de bord ne sont pas encore chargés.

**Solutions** :
1. Attendez que le tableau de bord soit complètement chargé (indicateur de chargement terminé)
2. Actualisez la page (F5)
3. Vérifiez la console du navigateur pour les erreurs :
   ```javascript
   // Ouvrir la console (F12)
   // Vérifier si la visite est disponible
   console.log(window.guidedTour);
   ```

### Le tooltip est mal positionné

**Cause** : La fenêtre est trop petite ou l'élément est proche du bord.

**Solutions** :
1. Agrandissez la fenêtre du navigateur
2. La visite ajuste automatiquement la position si possible
3. Sur mobile, passez en mode paysage

### La visite s'affiche à chaque visite

**Cause** : Le localStorage n'est pas activé ou a été vidé.

**Solution** :
1. Cochez "☐ Ne plus afficher cette visite" avant de terminer
2. Vérifiez que les cookies/localStorage sont autorisés dans votre navigateur
3. Si vous utilisez un mode privé, les préférences ne seront pas sauvegardées

### Un élément n'est pas trouvé

**Message d'erreur** : `Tour element not found after 3000ms: #elementId`

**Solutions** :
1. L'élément n'existe peut-être pas dans votre version
2. Actualisez la page et relancez la visite
3. Vérifiez que tous les onglets se chargent correctement
4. La visite passera automatiquement à l'étape suivante après le délai d'attente

---

## 💡 Conseils et Astuces

### Pour une Expérience Optimale

1. **📱 Utilisez un grand écran** : La visite est optimisée pour les écrans de 1024px minimum
2. **🖱️ Laissez faire les animations** : Ne cliquez pas trop rapidement, laissez les transitions se terminer
3. **🔊 Concentrez-vous** : Prenez le temps de lire chaque étape, la visite dure environ 5-7 minutes
4. **💾 Explorez après** : Après la visite, explorez librement les fonctionnalités pour les mémoriser

### Rejouer une Étape

Pour revoir une étape spécifique :
1. Terminez la visite normalement
2. Relancez-la avec `window.guidedTour.start()`
3. Naviguez jusqu'à l'étape souhaitée avec les boutons Suivant/Précédent

### Désactiver la Visite Définitivement

Si vous ne souhaitez plus jamais voir la visite :
1. Cochez "☐ Ne plus afficher cette visite" lors de la première étape
2. Ou cliquez sur "Non merci" avec la case cochée dans la fenêtre de bienvenue
3. Ou utilisez : `window.guidedTour.reset()` puis ne plus lancer la visite

### Réactiver la Visite

Pour réactiver la visite après l'avoir désactivée :
```javascript
// Ouvrir la console (F12)
window.guidedTour.reset();
location.reload();
```

---

## 📞 Support

Si vous rencontrez des problèmes avec la visite guidée :

1. **Vérifiez cette documentation** : La plupart des problèmes sont résolus ici
2. **Console du navigateur** : Ouvrez la console (F12) pour voir les messages d'erreur
3. **Réinitialisez** : Utilisez `window.guidedTour.reset()` et rechargez
4. **Contactez le support** : Si le problème persiste, contactez l'équipe technique

---

## 🎉 Félicitations !

Vous êtes maintenant prêt à utiliser la visite guidée du tableau de bord PROCASSEF !

**Prochaines étapes** :
1. Lancez votre première visite guidée
2. Explorez chaque fonctionnalité en détail
3. Utilisez les filtres et les différents onglets
4. Consultez les rapports et graphiques

**Bon travail avec PROCASSEF ! 🚀**

---

*Document mis à jour le : 14 janvier 2026*  
*Version de la visite guidée : 1.0*
