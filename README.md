# Échecs

Jeu d'échecs complet jouable dans le navigateur : **[dchirez.fr/chess](https://dchirez.fr/chess/)**

- **Contre l'ordinateur** : six niveaux, du débutant qui joue presque au hasard à l'expert qui calcule 2,5 s par coup.
- **À deux sur le même écran**, avec pendule optionnelle et retournement automatique de l'échiquier.
- **En ligne avec un lien** : on crée la partie, on envoie le lien, la connexion se fait directement entre
  les deux navigateurs (WebRTC via [PeerJS](https://peerjs.com/)). Pas de compte, pas de serveur de jeu.

Un seul fichier `index.html`, sans étape de build ni image : les pièces sont des glyphes Unicode
(police Noto Sans Symbols 2), les sons sont synthétisés avec Web Audio.

## Fonctionnalités

- Règles complètes : roque, prise en passant, promotion au choix, pat, triple répétition,
  règle des 50 coups, matériel insuffisant, perte au temps (nulle si l'adversaire ne peut plus mater).
- Déplacement au clic ou au glisser-déposer, coups légaux affichés, dernier coup et échec surlignés.
- Liste des coups en notation algébrique, revue de la partie coup par coup, export PGN.
- Annulation de coup (contre l'ordinateur et en local), proposition de nulle, abandon, revanche.
- Partie sauvegardée dans le navigateur et reprise au retour.
- En ligne : reconnexion automatique si l'un des joueurs recharge la page ou perd le réseau.

| Touche | Action |
| --- | --- |
| ← / → | Coup précédent / suivant |
| Origine / Fin | Début / position actuelle |
| F | Retourner l'échiquier |
| M | Couper le son |

## Le moteur

Le moteur est du JavaScript pur, sans DOM, dans le `<script id="engine">` de la page. Le même code
tourne dans un Web Worker (pour que l'interface reste fluide pendant que l'ordinateur réfléchit)
et sous Node pour les tests.

- Génération des coups sur un tableau de 64 cases avec rayons précalculés, hachage de Zobrist incrémental.
- Recherche alpha-bêta (PVS) avec approfondissement itératif, table de transposition, coup nul,
  réductions des coups tardifs, coups tueurs, heuristique d'historique et recherche de calme.
- Évaluation par tables PeSTO (milieu et finale interpolés), bonus de paire de fous, aide au mat en finale.
- Petit répertoire d'ouvertures pour varier les parties.
- Les niveaux 1 à 3 tirent leur coup au sort parmi ceux qui ne sont pas trop mauvais, pour jouer « humain ».

## Tests

```bash
node tools/test.mjs
```

Perft sur six positions de référence (jusqu'à 4,8 millions de positions), notation SAN, cas de fin
de partie, légalité du répertoire, et quelques vérifications de l'IA (mat en un, finale dame contre roi).

## Partie en ligne : fonctionnement

Le créateur de la partie est l'**hôte** : il s'enregistre auprès du service public de signalisation de
PeerJS sous un identifiant tiré au hasard, qui forme le lien d'invitation (`#j=…`). L'invité s'y connecte
et reçoit l'état complet de la partie ; chaque coup reçu est revérifié localement. En cas de
désynchronisation, l'hôte renvoie l'état. Si l'hôte recharge sa page (`#h=…`), la partie est reprise
depuis la sauvegarde locale.

Limite connue : sans serveur relais (TURN), certains réseaux très fermés (4G de certains opérateurs,
réseaux d'entreprise) peuvent empêcher la connexion directe.
