# 📸 Captures Visuelles - Visite Guidée PROCASSEF

## Table des Matières
1. [Fenêtre de Bienvenue](#fenêtre-de-bienvenue)
2. [Interface de la Visite](#interface-de-la-visite)
3. [Captures par Étape](#captures-par-étape)
4. [États et Interactions](#états-et-interactions)

---

## 🎬 Fenêtre de Bienvenue

### Vue Initiale

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    🧭                                   │
│               ┌───────────┐                            │
│               │  Compass  │                            │
│               │   Icon    │                            │
│               └───────────┘                            │
│                                                         │
│         Bienvenue sur PROCASSEF !                      │
│                                                         │
│    Souhaitez-vous faire une visite guidée              │
│    du tableau de bord ?                                │
│                                                         │
│    Cette visite vous présentera les principales        │
│    fonctionnalités en quelques minutes.                │
│                                                         │
│    ┌──────────────┐    ┌──────────────────────┐       │
│    │  Non merci   │    │ ▶ Commencer la visite │      │
│    └──────────────┘    └──────────────────────┘       │
│                                                         │
│    ☐ Ne plus me demander                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### États des Boutons

**État Normal :**
```
┌──────────────┐    ┌──────────────────────┐
│  Non merci   │    │ ▶ Commencer la visite│
└──────────────┘    └──────────────────────┘
   Gris clair          Bleu gradient + ombre
```

**État Hover :**
```
┌──────────────┐    ┌──────────────────────┐
│  Non merci   │    │ ▶ Commencer la visite│ ↑ 2px
└──────────────┘    └──────────────────────┘
   Gris foncé         Ombre plus prononcée
```

---

## 🎯 Interface de la Visite

### Anatomie Complète

```
                     Overlay Sombre (60% opacité)
    ┌──────────────────────────────────────────────────┐
    │████████████████████████████████████████████████  │
    │████████████████████████████████████████████████  │
    │████████████  SPOTLIGHT  ███████████████████████  │
    │████████████     ↓        ███████████████████████  │
    │████████████ ┌─────────┐ ███████████████████████  │
    │████████████ │Élément  │ ███████████████████████  │
    │████████████ │Ciblé    │ ███████████████████████  │
    │████████████ │Visible  │ ███████████████████████  │
    │████████████ └─────────┘ ███████████████████████  │
    │████████████      ▲       ███████████████████████  │
    │████████████  Halo bleu   ███████████████████████  │
    │████████████  pulsant     ███████████████████████  │
    │█████████████████████████████████████████████████  │
    │                                                   │
    │        ▼ TOOLTIP                                  │
    │   ┌─────────────────────────────────┐            │
    │   │ Titre de l'étape           [×]  │            │
    │   ├─────────────────────────────────┤            │
    │   │                                 │            │
    │   │ Description de la               │            │
    │   │ fonctionnalité expliquée        │            │
    │   │                                 │            │
    │   ├─────────────────────────────────┤            │
    │   │ 5/11  [Passer] [←] [Suivant →] │            │
    │   ├─────────────────────────────────┤            │
    │   │ ☐ Ne plus afficher cette visite │            │
    │   └─────────────────────────────────┘            │
    │                  ▲                                │
    │                  │ Flèche pointant                │
    │                  │ vers l'élément                │
    └──────────────────────────────────────────────────┘
```

### Détails du Tooltip

#### En-tête
```
┌─────────────────────────────────────────┐
│ Navigation Principale               [×] │
└─────────────────────────────────────────┘
  ↑                                     ↑
  Titre en gras                    Bouton fermer
  Police 16px                      Croix 24px
  Couleur #1e293b                  Hover: #475569
```

#### Contenu
```
┌─────────────────────────────────────────┐
│                                         │
│ Utilisez ces onglets pour naviguer     │
│ entre les différentes sections du      │
│ tableau de bord : Vue d'ensemble,      │
│ Analyse Performance, Analyse           │
│ Régionale et Suivi Temporel.           │
│                                         │
└─────────────────────────────────────────┘
  ↑
  Police 14px, line-height 1.6
  Couleur #475569
  Padding 16px 20px
```

#### Pied de page
```
┌─────────────────────────────────────────┐
│ 5 / 11      [Passer] [←] [Suivant →]   │
└─────────────────────────────────────────┘
  ↑   ↑       ↑       ↑    ↑
  │   │       │       │    └─ Bouton Suivant (Bleu)
  │   │       │       └────── Bouton Précédent
  │   │       └────────────── Bouton Passer
  │   └────────────────────── Total
  └────────────────────────── Étape actuelle (Bleu)

  Background: #f8fafc (Gris très clair)
  Border-top: 1px solid #f1f5f9
```

### Positions de la Flèche

#### Flèche en Haut (position: 'bottom')
```
        Élément Ciblé
    ┌─────────────────┐
    │                 │
    │                 │
    └─────────────────┘
            ▲
            │ Flèche (triangle blanc)
    ┌─────────────────┐
    │    Tooltip      │
    │                 │
    └─────────────────┘
```

#### Flèche en Bas (position: 'top')
```
    ┌─────────────────┐
    │    Tooltip      │
    │                 │
    └─────────────────┘
            │ Flèche
            ▼
    ┌─────────────────┐
    │                 │
    │  Élément Ciblé  │
    └─────────────────┘
```

#### Flèche à Gauche (position: 'right')
```
       Élément     ┌─────────────┐
    ┌────────┐ ◄─  │   Tooltip   │
    │        │     │             │
    └────────┘     └─────────────┘
```

#### Flèche à Droite (position: 'left')
```
    ┌─────────────┐    Élément
    │   Tooltip   │  ─► ┌────────┐
    │             │     │        │
    └─────────────┘     └────────┘
```

---

## 📋 Captures par Étape

### Étape 1/11 : Navigation Principale

```
┌──────────────────────────────────────────────────────────┐
│  HEADER                                                  │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │ [Vue d'ensemble] [Analyse Performance] [...] │    │
│  │  ← ÉLÉMENT CIBLÉ AVEC HALO LUMINEUX BLEU      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│           ▼ Flèche du tooltip                            │
│  ┌──────────────────────────────────────────────┐       │
│  │ Navigation Principale                   [×]  │       │
│  ├──────────────────────────────────────────────┤       │
│  │ Utilisez ces onglets pour naviguer          │       │
│  │ entre les différentes sections...           │       │
│  ├──────────────────────────────────────────────┤       │
│  │ 1/11    [Passer] [←] [Suivant →]           │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  [Filtres]  [Région: Toutes ▼]  [Période ▼]            │
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│  │ KPI1 │ │ KPI2 │ │ KPI3 │ │ KPI4 │                   │
│  └──────┘ └──────┘ └──────┘ └──────┘                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Étape 2/11 : Filtres

```
┌──────────────────────────────────────────────────────────┐
│  [Vue d'ensemble] [Analyse Performance] [...]           │
│                                                          │
│  ┌─────────────────────────────────────────────┐        │
│  │ [Région: Toutes ▼] [Période: Quotidien ▼] │        │
│  │     ← ÉLÉMENT CIBLÉ                         │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│           ▼ Flèche du tooltip                            │
│  ┌──────────────────────────────────────────────┐       │
│  │ Filtres                                 [×]  │       │
│  ├──────────────────────────────────────────────┤       │
│  │ Filtrez les données par région et           │       │
│  │ par période pour une analyse précise         │       │
│  ├──────────────────────────────────────────────┤       │
│  │ 2/11    [Passer] [←] [Suivant →]           │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Étape 3/11 : Indicateurs Clés (KPI)

```
┌──────────────────────────────────────────────────────────┐
│  [Filtres]                                               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐               │   │
│  │  │📈 92%  │ │📦 LOT15│ │❌ 12   │               │   │
│  │  │Réussite│ │Prochain│ │Pertes  │ ...            │   │
│  │  └────────┘ └────────┘ └────────┘               │   │
│  │   ↑ ÉLÉMENT CIBLÉ AVEC HALO                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│           ▼ Flèche du tooltip                            │
│  ┌──────────────────────────────────────────────┐       │
│  │ Indicateurs Clés                        [×]  │       │
│  ├──────────────────────────────────────────────┤       │
│  │ Ces cartes affichent les métriques          │       │
│  │ essentielles. Survolez-les pour voir        │       │
│  │ les détails de calcul.                      │       │
│  ├──────────────────────────────────────────────┤       │
│  │ 3/11    [Passer] [←] [Suivant →]           │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Étape 4/11 : Date Fin Objectif

```
┌──────────────────────────────────────────────────────────┐
│  [KPI Cards]                                             │
│                                                          │
│  ┌─────────────┐                                        │
│  │ Performance │    ┌──────────────────────┐            │
│  │ Journalière │    │ Date Fin Objectif    │◄─ Tooltip │
│  └─────────────┘    │                      │            │
│                     │  📅 28 janvier 2026  │            │
│  ┌─────────────┐    │                      │            │
│  │ Objectif    │    │  🟢 Dans les temps   │            │
│  │ Mensuel     │    │                      │            │
│  └─────────────┘    └──────────────────────┘            │
│                       ↑ ÉLÉMENT CIBLÉ                    │
│  [Graphiques]                                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Étape 7/11 : Évolution Quotidienne

```
┌──────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐       │
│  │ Évolution Quotidienne - 30 Derniers Jours    │       │
│  │                                              │       │
│  │  50├─────────────────────────────────────   │       │
│  │    │     █                                   │       │
│  │  40├─────█─█─────────────────────────────   │       │
│  │    │   █ █ █   █     █                       │       │
│  │  30├─█─█─█─█───█─█───█───────────────────   │       │
│  │    │ █ █ █ █ █ █ █ █ █ █                     │       │
│  │  20├─█─█─█─█─█─█─█─█─█─█─────────────────   │       │
│  │    │ █ █ █ █ █ █ █ █ █ █                     │       │
│  │  10├─█─█─█─█─█─█─█─█─█─█─────────────────   │       │
│  │    │ █ █ █ █ █ █ █ █ █ █                     │       │
│  │   0└─────────────────────────────────────   │       │
│  │      1 3 5 7 9 11 13 15 17 19 21 23 25 27    │       │
│  │      --- Objectif quotidien (ligne rouge)    │       │
│  └──────────────────────────────────────────────┘       │
│                 ↑ ÉLÉMENT CIBLÉ                          │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │ Évolution Quotidienne                   [×]  │◄ Tooltip│
│  │ Ce graphique montre l'évolution...          │       │
│  └──────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

### Étape 8/11 : Projection Fin de Mois

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ┌──────────────────────────────────┐                   │
│  │ PROJECTION FIN DE MOIS           │  ◄── Tooltip      │
│  ├──────────────────────────────────┤                   │
│  │                                  │                   │
│  │ 📊 Taux Requis:      45/jour     │                   │
│  │ 📈 Taux Actuel:      48/jour     │                   │
│  │                                  │                   │
│  │ 🎯 Objectif atteignable          │                   │
│  │    le 28 janvier 2026            │                   │
│  │                                  │                   │
│  │ ✅ Avance: +90 parcelles         │                   │
│  │                                  │                   │
│  │ Progrès: [████████░░] 85%        │                   │
│  │                                  │                   │
│  └──────────────────────────────────┘                   │
│           ↑ ÉLÉMENT CIBLÉ                                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Étape 9/11 : Statut du Pipeline

```
┌──────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐       │
│  │ STATUT DU PIPELINE                           │       │
│  ├──────────────────────────────────────────────┤       │
│  │                                              │       │
│  │   NICAD      →     CTASF     →   Délibérées │       │
│  │  ┌─────┐         ┌─────┐        ┌─────┐     │       │
│  │  │ 850 │   ───►  │ 700 │  ───►  │ 450 │     │       │
│  │  └─────┘         └─────┘        └─────┘     │       │
│  │    85%             70%            45%        │       │
│  │                                              │       │
│  │  [████████] [███████ ] [█████   ]           │       │
│  │                                              │       │
│  └──────────────────────────────────────────────┘       │
│           ↑ ÉLÉMENT CIBLÉ                                │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │ Statut du Pipeline    │                 [×]  │◄ Tooltip│
│  │ Visualisez la progression des parcelles...  │       │
│  └──────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

### Étape 11/11 : Actualisation (Finale)

```
┌──────────────────────────────────────────────────────────┐
│  PROCASSEF Dashboard              ┌──────────────┐      │
│                                   │ 🔄 Actualiser│◄ Ciblé│
│                                   └──────────────┘      │
│                                                          │
│           ▼ Flèche du tooltip                            │
│  ┌──────────────────────────────────────────────┐       │
│  │ Actualisation des Données           [×]      │       │
│  ├──────────────────────────────────────────────┤       │
│  │ Les données sont automatiquement             │       │
│  │ actualisées toutes les 5 minutes.            │       │
│  │ Cliquez ici pour forcer une                  │       │
│  │ actualisation immédiate.                     │       │
│  ├──────────────────────────────────────────────┤       │
│  │ 11/11   [Passer] [←] [Terminer]             │       │
│  │                        ↑ Bouton vert         │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 🎨 États et Interactions

### État des Boutons

#### Bouton Normal
```
┌──────────┐
│ Suivant  │
└──────────┘
Background: #2563eb (Bleu)
Color: white
Border: 1px solid #2563eb
```

#### Bouton Hover
```
┌──────────┐
│ Suivant  │ ← Curseur
└──────────┘
Background: #1d4ed8 (Bleu foncé)
Transition: 0.2s
```

#### Bouton Désactivé
```
┌──────────┐
│ ← Préc.  │
└──────────┘
Opacity: 0.5
Cursor: not-allowed
Disabled: true
```

#### Bouton Terminer (dernière étape)
```
┌──────────┐
│ Terminer │
└──────────┘
Background: #10b981 (Vert)
Border-color: #10b981
```

### Animation du Spotlight

```
Frame 1 (0s):
┌─────────────┐
│  Élément    │ ← Halo: 4px, opacity 0.3
└─────────────┘

Frame 2 (1s):
┌─────────────┐
│  Élément    │ ← Halo: 8px, opacity 0.2
└─────────────┘

Frame 3 (2s):
┌─────────────┐
│  Élément    │ ← Halo: 4px, opacity 0.3
└─────────────┘

Animation: Pulse 2s ease-in-out infinite
```

### Toast de Complétion

```
                                    ┌─────────────────────┐
                                    │  ✓  Visite terminée!│
                                    │                     │
                                    │  Vous pouvez        │
                                    │  relancer à tout    │
                                    │  moment...          │
                                    └─────────────────────┘
                                    Position: fixed
                                    Bottom: 24px
                                    Right: 24px
                                    Duration: 4s
```

### Transition entre Étapes

```
Étape N:
┌─────────────┐
│ Visible     │ Opacity: 1
└─────────────┘

↓ 100ms

Fade Out:
┌─────────────┐
│ Disparaît   │ Opacity: 0
└─────────────┘

↓ Switch Tab (500ms si nécessaire)

Wait Element:
[Attente élément...] Max 3000ms

↓ 100ms

Scroll & Spotlight:
┌─────────────┐
│ Nouveau     │ Scroll + Z-index
└─────────────┘

↓ 250ms

Fade In Tooltip:
┌─────────────┐
│ Tooltip     │ Opacity: 1
└─────────────┘
```

---

## 📱 Vue Responsive

### Desktop (> 1024px)
```
┌────────────────────────────────────────┐
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│ │KPI1│ │KPI2│ │KPI3│ │KPI4│ │KPI5│   │
│ └────┘ └────┘ └────┘ └────┘ └────┘   │
│                                        │
│ ┌──────────────┐  ┌──────────────┐   │
│ │ Graphique 1  │  │ Graphique 2  │   │
│ └──────────────┘  └──────────────┘   │
└────────────────────────────────────────┘
Tooltip: 380px width
```

### Tablet (640px - 1024px)
```
┌────────────────────────────┐
│ ┌────┐ ┌────┐ ┌────┐       │
│ │KPI1│ │KPI2│ │KPI3│       │
│ └────┘ └────┘ └────┘       │
│ ┌────┐ ┌────┐ ┌────┐       │
│ │KPI4│ │KPI5│ │KPI6│       │
│ └────┘ └────┘ └────┘       │
│                             │
│ ┌─────────────────────────┐ │
│ │    Graphique 1          │ │
│ └─────────────────────────┘ │
└────────────────────────────┘
Tooltip: calc(100vw - 32px)
```

### Mobile (< 640px)
```
┌──────────────┐
│ ┌──────────┐ │
│ │  KPI 1   │ │
│ └──────────┘ │
│ ┌──────────┐ │
│ │  KPI 2   │ │
│ └──────────┘ │
│              │
│ ┌──────────┐ │
│ │ Graph 1  │ │
│ └──────────┘ │
└──────────────┘
Tooltip: Full width - 32px
Buttons: Stack vertical
```

---

## 🎭 Thème et Couleurs

### Palette de Couleurs

```
┌─────────────────────────────────────────┐
│ OVERLAY                                 │
│ rgba(0, 0, 0, 0.6) ████████████████     │
├─────────────────────────────────────────┤
│ SPOTLIGHT HALO                          │
│ rgba(37, 99, 235, 0.3) ░░░░ (Bleu)     │
├─────────────────────────────────────────┤
│ TOOLTIP BACKGROUND                      │
│ #ffffff ▓▓▓▓▓▓▓▓▓▓▓▓▓ (Blanc)           │
├─────────────────────────────────────────┤
│ TITRE                                   │
│ #1e293b ▓▓▓▓▓▓▓▓▓▓▓▓▓ (Gris foncé)      │
├─────────────────────────────────────────┤
│ TEXTE                                   │
│ #475569 ▓▓▓▓▓▓▓▓▓▓▓▓▓ (Gris moyen)      │
├─────────────────────────────────────────┤
│ BOUTON PRIMAIRE                         │
│ #2563eb → #1d4ed8 ████████ (Gradient)   │
├─────────────────────────────────────────┤
│ BOUTON TERMINER                         │
│ #10b981 → #059669 ████████ (Vert)       │
├─────────────────────────────────────────┤
│ ÉTAPE ACTUELLE                          │
│ #2563eb ████████████ (Bleu)             │
└─────────────────────────────────────────┘
```

### Ombres

```
TOOLTIP:
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2),
            0 0 0 1px rgba(0, 0, 0, 0.05)

MODAL:
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)

BOUTON PRIMAIRE:
box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3)

HOVER BOUTON:
box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4)
```

---

## 🔄 Cycle de Vie Complet

```
1. INITIALISATION
   ├─ Page chargée
   ├─ Dashboard prêt
   └─ Check préférences
      ├─ Jamais vu → Afficher modal
      └─ Déjà vu → Ne rien faire

2. MODAL DE BIENVENUE
   ├─ User: "Commencer" → startTour()
   └─ User: "Non merci" → Sauvegarder préf

3. DÉMARRAGE TOUR
   ├─ createOverlay()
   ├─ createTooltip()
   ├─ overlay.visible = true
   └─ showStep(0)

4. AFFICHAGE ÉTAPE
   ├─ Click tab si nécessaire
   ├─ waitForElement(target)
   ├─ highlightElement(target)
   │  ├─ scrollIntoView()
   │  ├─ Position spotlight
   │  └─ Set z-index
   └─ positionTooltip(target, position)
      ├─ Calculate position
      ├─ Check viewport bounds
      └─ tooltip.visible = true

5. NAVIGATION
   ├─ User: "Suivant" → nextStep()
   ├─ User: "Précédent" → prevStep()
   ├─ User: "Passer" → skipTour()
   └─ User: "×" → endTour()

6. DERNIÈRE ÉTAPE
   ├─ Bouton devient "Terminer"
   └─ User: "Terminer" → completeTour()
      ├─ Sauvegarder préf
      └─ showCompletionMessage()

7. FIN DU TOUR
   └─ endTour()
      ├─ isActive = false
      ├─ cleanup styles
      ├─ Remove overlay (300ms)
      ├─ Remove tooltip (300ms)
      └─ Remove event listeners
```

---

*Document de captures créé le : 14 janvier 2026*  
*Version : 1.0*
