# 🗺️ PROCASSEF - Dashboard Cadastre Sénégal

Dashboard moderne et performant pour le suivi des opérations cadastrales au Sénégal (BETPLUSAUDETAG).

## ✨ Fonctionnalités

- 📊 **Visualisation en temps réel** des KPI (levées, affichage, CTASF, post-traitement)
- 📈 **Graphiques interactifs** avec Chart.js (séries temporelles, barres, heatmap, radar)
- 🗂️ **Tableaux détaillés** avec filtres dynamiques (région, commune, date)
- 🎯 **Visite guidée interactive** - Découverte des fonctionnalités pour nouveaux utilisateurs
- 📱 **Progressive Web App** - Installable sur mobile et desktop
- 🎨 **Interface moderne** avec Tailwind CSS et animations fluides
- ⚡ **Performance optimisée** - Service Worker v2.0 avec stratégie Network-First
- ♿ **Accessible** - WCAG 2.1 AA compliant
- 🔄 **Rafraîchissement automatique** toutes les 5 minutes

## 🚀 Démarrage rapide

### Prérequis
- Serveur web local (http-server, Live Server, ou similaire)
- Navigateur moderne (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Installation

```bash
# Cloner le dépôt
git clone [repository-url]
cd Suivi-Post-traitement

# Démarrer un serveur local
npx http-server -p 8080

# Ouvrir dans le navigateur
open http://localhost:8080
```

## 🎓 Documentation de la Visite Guidée

La visite guidée offre une introduction interactive aux fonctionnalités du dashboard :

- 📖 **[Tutoriel Complet](TUTORIEL_VISITE_GUIDEE.md)** - Guide détaillé avec explications de chaque étape
- 🚀 **[Guide Rapide](GUIDE_RAPIDE_VISITE.md)** - Référence rapide et API complète
- 📸 **[Captures Visuelles](CAPTURES_VISUELLES_VISITE.md)** - Diagrammes ASCII et visualisations
- 🔧 **[Guide de Dépannage](DEBUG_FOCUS_VISITE.md)** - Résolution des problèmes de focus

### Lancement de la visite

```javascript
// Depuis la console du navigateur (F12)
window.guidedTour.start();

// Réinitialiser les préférences
window.guidedTour.reset();
```

## 📁 Structure du projet

```
Suivi-Post-traitement/
├── index.html              # Page principale du dashboard
├── communes.html           # Page détails communes
├── styles.css             # Styles personnalisés
├── manifest.webmanifest   # Configuration PWA avec SVG icons
├── sw.js                  # Service Worker v2.0
├── TUTORIEL_VISITE_GUIDEE.md      # Documentation visite guidée
├── GUIDE_RAPIDE_VISITE.md         # Référence rapide visite
├── CAPTURES_VISUELLES_VISITE.md   # Captures visuelles
├── DEBUG_FOCUS_VISITE.md          # Guide dépannage focus
├── js/
│   ├── config.js                      # Configuration Google Sheets (2 spreadsheets)
│   ├── enhancedDashboard.js          # Logique principale du dashboard
│   ├── enhancedGoogleSheetsService.js # Service récupération données (multi-spreadsheet)
│   ├── guidedTour.js                  # Système de visite guidée interactive
│   ├── chartService.js                # Gestion des graphiques Chart.js
│   ├── dataAggregation.js             # Calculs KPI et agrégation
│   ├── statCardService.js             # Cartes statistiques
│   ├── forecastCard.js                # Prévisions et projections
│   ├── tubeProgress.js                # Indicateurs de progression (tube style)
│   ├── communePanel.js                # Panneau détails communes
│   ├── chronogramIntegration.js       # Gestion du chronogramme
│   └── ...
├── css/
│   ├── charts.css         # Styles graphiques
│   └── tubeProgress.css   # Styles indicateurs tube
└── templates/
    └── dashboard-template.html # Template HTML pour le dashboard
```


## 🔧 Configuration

Les données proviennent de deux Google Spreadsheets configurés dans [js/config.js](js/config.js):

### Spreadsheet Principal (1IbV-vzaby_xwdzeENu7qgsZyqb7eWKQSHmp1hw3nPvg)
- **Daily Levee Source** - Levées quotidiennes par équipe
- **Overview** - Vue d'ensemble du projet
- **Processing Details** - Détails du traitement
- **Commune Analysis** - Analyse par commune
- **Collection/Display/CTASF Projections** - Projections par zone

### Spreadsheet Monitoring (1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW)
- **Public Display Follow-up** - Suivi affichage public
- **CTASF Follow-up** - Suivi CTASF
- **Post Process Follow-up** - Suivi post-traitement
- **Yields Projections** - Rendements par équipe

Le service `enhancedGoogleSheetsService` supporte les deux spreadsheets via la méthode `fetchSheetByURL()`.

## 🌐 Technologies

| Catégorie | Technologies |
|-----------|-------------|
| **Frontend** | Vanilla JavaScript ES6+, HTML5, CSS3 |
| **Styles** | Tailwind CSS 3.3.0, Custom CSS Animations |
| **Graphiques** | Chart.js 3.9.1 (Line, Bar, Doughnut, Radar) |
| **Icons** | Font Awesome 6.4.0 |
| **PWA** | Service Worker API, Web App Manifest |
| **Data Source** | Google Sheets (CSV Export via GID) |
| **Analytics** | Custom analytics service |

## 📊 Sources de données

### Feuilles Google Sheets
Le dashboard récupère les données depuis plusieurs feuilles:
- **Levées quotidiennes** (Daily Levee Source) - 📈 Données de terrain
- **Suivi affichage** (Public Display Follow-up) - 📋 Étapes d'affichage
- **Suivi CTASF** (CTASF Follow-up) - ✅ Validation CTASF
- **Post-traitement** (Post Process Follow-up) - 🔧 Traitement final
- **Projections** (Collection/Display/CTASF Projections) - 📊 Prévisions
- **Rendements** (Yields Projections) - 👥 Productivité par équipe
- **Analyse communes** (Commune Analysis) - 🗺️ Détails géographiques

### Stratégie de cache
- **Données dynamiques** (KPI, tableaux): Network-First (toujours les données les plus récentes)
- **Assets statiques** (CSS, JS, images): Cache-First avec fallback réseau
- **Durée de vie**: 5 minutes pour les données, 1 jour pour les assets

## 🎯 Objectifs et KPI

### Objectifs mensuels
- **Janvier 2026**: 12 000 levées
- **Objectif quotidien**: ~479 levées/jour (basé sur jours ouvrables)
- **Objectif total projet**: 75 000 levées

### KPI suivis
- ✅ **Levées terrain**: Nombre de parcelles levées
- 📋 **Affichage public**: Étapes complétées
- 🔍 **CTASF**: Validation technique
- 🖨️ **Post-traitement**: Production finale

## 🔄 Fonctionnement

### Rafraîchissement automatique
- **Intervalle**: 5 minutes
- **Mode**: Automatique avec indicateur visuel
- **Contrôle**: Bouton manuel disponible

### Filtres disponibles
- **Date**: Sélection de période (début/fin)
- **Région**: Filtrage par région administrative
- **Commune**: Filtrage par commune spécifique

### Onglets de données
1. **Levées** - Données terrain quotidiennes (161+ entrées)
2. **Affichage** - Suivi affichage public
3. **CTASF** - Validation technique
4. **Traitement** - Post-traitement et production

## 📱 Installation PWA

### Sur Desktop (Chrome/Edge)
1. Ouvrir le dashboard dans Chrome/Edge
2. Cliquer sur l'icône d'installation (➕) dans la barre d'adresse
3. Confirmer l'installation
4. L'application apparaît comme app native

### Sur Mobile (iOS/Android)
1. Ouvrir dans Safari (iOS) ou Chrome (Android)
2. Menu → "Ajouter à l'écran d'accueil"
3. Confirmer
4. Icône installée sur l'écran d'accueil

### Avantages PWA
- ⚡ Chargement rapide (cache)
- 📱 Accès hors ligne aux données en cache
- 🔔 Notifications (à venir)
- 💾 Installation sans app store

## 🛠️ Développement

### Scripts disponibles

```bash
# Démarrer serveur de développement
npx http-server -p 8080

# Avec live reload
npx live-server --port=8080

# Python simple server
python3 -m http.server 8080
```

### Bonnes pratiques
- ✅ Code modulaire et réutilisable (services séparés)
- ✅ Commentaires en français pour clarté métier
- ✅ Gestion d'erreurs robuste (try/catch, retry logic)
- ✅ Debug logs conditionnels (console.log en développement)
- ✅ Performance optimisée (lazy loading, caching, debouncing)
- ✅ Responsive design mobile-first
- ✅ Accessibilité WCAG 2.1 AA

### Architecture

```
Couche Présentation (UI)
    ↓
Contrôleur (enhancedDashboard.js)
    ↓
Services (chartService, dataAggregation, statCardService)
    ↓
Données (enhancedGoogleSheetsService)
    ↓
Google Sheets (CSV Export)
```

## 🐛 Debug et troubleshooting

### Console développeur (F12)
Logs disponibles:
- ✅ Chargement des données (timestamps, tailles)
- 📊 État des KPI (calculs, agrégations)
- ❌ Erreurs de récupération (HTTP status, messages)
- ⚙️ Service Worker (cache hits/misses)
- 🔍 Filtres appliqués (région, commune, dates)

### Problèmes courants

**Données ne se chargent pas**
- Vérifier la connexion internet
- Vérifier les URLs dans config.js
- Vérifier la console pour erreurs HTTP 400/403/404
- Force refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

**Graphiques vides**
- Vérifier que les données sont bien chargées (onglet Network)
- Vérifier les noms de colonnes dans les sheets
- Vérifier les filtres (peuvent masquer toutes les données)

**PWA ne s'installe pas**
- Vérifier que le site est servi en HTTPS (ou localhost)
- Vérifier manifest.webmanifest (JSON valide)
- Vérifier service worker (sw.js accessible)

## 📈 Performance

### Métriques cibles
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Lighthouse Score**: > 90

### Optimisations implémentées
- Service Worker avec cache stratégique
- Lazy loading des graphiques
- Debouncing des filtres (500ms)
- Minification CSS/JS (à faire)
- Compression Gzip (serveur)

## 🔐 Sécurité

- ✅ Pas de données sensibles en local storage
- ✅ Content Security Policy (CSP) headers
- ✅ HTTPS requis en production
- ✅ Pas d'API keys dans le code (données publiques Google Sheets)

## 📄 Licence

Propriétaire - BETPLUSAUDETAG © 2026

## 👥 Support

Pour toute question, problème ou suggestion:
- 📧 Email: [support@betplusaudetag.com]
- 📞 Téléphone: [À définir]
- 🐛 Issues: [GitHub Issues URL]

## 🚀 Roadmap

### Version 1.1 (Q1 2026)
- [ ] Export PDF des rapports
- [ ] Notifications push PWA
- [ ] Mode sombre
- [ ] Comparaison périodes

### Version 2.0 (Q2 2026)
- [ ] Authentification utilisateurs
- [ ] Gestion des droits
- [ ] API REST backend
- [ ] Base de données temps réel

## Recent Updates
- September 10, 2025: Consolidated to enhanced dashboard implementation
- Removed legacy dashboard components (dashboard.js, liquidProgress.js)
- Simplified codebase and improved performance
- See `dashboard_changes.md` for detailed changelog

## License
MIT
#   S u i v i - P o s t - t r a i t e m e n t 
 
 