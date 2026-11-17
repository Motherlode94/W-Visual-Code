# WarLike Visual Code (W Visual Code)

Éditeur de code **autonome**, accessible depuis un navigateur, pour les projets WarLike et les autres projets de programmation. Le dépôt est indépendant de WarLike Engine ; aucune connexion n’est requise pour écrire ou organiser des fichiers.

## Première version
- Interface à trois panneaux : explorateur de fichiers et projets, onglets de code au centre, plan de fichier sur la droite.
- WarScript (`.wls`), C#, JS/TS, Python, C/C++, JSON, HTML, CSS et Markdown.
- Monaco Editor chargé de manière facultative ; repli sur un éditeur texte natif lorsque le CDN est indisponible.
- Création, renommage et suppression de fichiers, import de plusieurs fichiers, recherche par nom ou contenu.
- Sauvegarde locale avec `localStorage`, téléchargement de fichier, export/import de projet `.wvc.json` (v1, pas de ZIP ni synchronisation cloud).
- Analyse légère des délimiteurs/chaînes et du JSON ; **pas de compilation complète** dans l’éditeur autonome.
- Aucun script importé n’est exécuté automatiquement.

## Intégration facultative avec WarLike Engine
1. Depuis W Visual Code : **Connecter Engine** puis ouvrir Script Studio.
2. Dans l’onglet Engine, confirmer l'autorisation demandée pour l’origine WVC.
3. Revenir à W Visual Code et utiliser **Envoyer vers Engine** sur un fichier `.wls`, `.cs`, `.js` ou `.ts`, ou **Envoyer les scripts du projet** pour un transfert manuel séquentiel (63 fichiers maximum par lot, accusé de réception et arrêt en cas d'erreur).
4. Le script apparaît comme un document **dans Script Studio**. Il n’est pas automatiquement attaché à une scène, exécuté ou compilé.

Le protocole `postMessage` vérifie l’origine exacte, la fenêtre ouverte, la version de protocole, un identifiant de session et des limites strictes de taille/types. Engine doit déployer sa propre PR d’intégration avant que la connexion fonctionne sur le site public. Aucun accès direct aux autres onglets, projets, fichiers locaux ni à la base de données d’Engine n’est accordé.

**Limites v1 :** les dossiers des fichiers envoyés sont conservés dans W Visual Code mais Script Studio importe les noms de fichiers seulement ; en cas de conflit de nom, il crée une copie suffixée. Les scripts envoyés ne sont pas automatiquement liés à la scène 3D. La validation bout-en-bout doit être effectuée avec les deux sites déployés.\n\n**Limites v1 :** pas de LSP C# opérationnel, pas de debugging/points d’arrêt distants, pas de synchro multi-fichiers bidirectionnelle ni compilation C# dans le navigateur. Le pont natif C# reste géré séparément par Engine. L’utilisateur doit confirmer les scripts et leurs permissions avant exécution.

## Développement et déploiement
```bash
npm run check
npm test
npm run build
```
Cloudflare Pages : répertoire de sortie `dist` ; build `npm run build`. Application statique, sans secret, cookie serveur, compte ou installation sur l'ordinateur.

## Roadmap
Projets multi-dossiers et restauration robuste via IndexedDB, monorepo TS/C#, navigation symbolique et diagnostics WarScript provenant du compilateur réel, synchronisation bidirectionnelle sur demande avec révisions/conflits, LSP local/cloud selon consentement, gestionnaire de packages, Git intégré, diff et débogage distant dans Engine. Les fonctions nécessitant le runtime natif doivent préserver le modèle de confiance d’Engine.
