export type Locale = "en" | "es" | "pt";

type Dict = Record<string, string>;

export const LOCALES: readonly Locale[] = ["en", "es", "pt"] as const;

const LOCALE_STORAGE_KEY = "gridlore:locale";
const LOCALE_CHANGED_EVENT = "gridlore:locale-changed";

const DICTS: Record<Locale, Dict> = {
  en: {
    "app.title": "DUNGEONS & PAWS",
    "header.langLabel": "Language",
    "header.helpLabel": "How to play",
    "header.settingsLabel": "Settings",
    "header.leaderboardLabel": "Leaderboard",
    "help.title": "How to play",
    "help.close": "Close",
    "leaderboard.title": "Leaderboard",
    "leaderboard.refresh": "Refresh",
    "settings.title": "Settings",
    "settings.close": "Close",
    "settings.language": "Language",
    "settings.animSpeed": "Animation speed",
    "settings.swipeSensitivity": "Swipe sensitivity",
    "settings.legalMoveOpacity": "Move-hint opacity",
    "settings.playerName": "Player name",
    "settings.editName": "Edit",
    "settings.haptics": "Haptics",
    "settings.reset": "Reset defaults",
    "settings.leaderboard": "Leaderboard",
    "settings.leaderboardNotConfigured": "Leaderboard not configured",
    "settings.leaderboardLoading": "Loading…",
    "settings.leaderboardError": "Could not load leaderboard",
    "settings.leaderboardEmpty": "No runs yet",
    "namePrompt.title": "Your name",
    "namePrompt.placeholder": "Enter name",
    "namePrompt.save": "Save",
    "namePrompt.required": "REQUIRED",
    "help.section.lattices.hint": "(tap to expand)",
    "help.section.goal.title": "GOAL",
    "help.section.goal.body":
      "Reach 🚪 on each floor to advance.\n" +
      "Survive as many floors as you can — your 🏆 score keeps rising.\n" +
      "If your ♥ HP hits 0 you die.",
    "help.section.move.title": "MOVING",
    "help.section.move.body":
      "Tap a card with a blue border to move there. You move one cell per turn — diagonals included.\n" +
      "Tap an enemy card to attack instead of moving.\n" +
      "If a 🔑 appears, tap its tile to step onto it and pick it up.\n" +
      "\n" +
      "PC controls: WASD or arrow keys. Press B to open the 🎒 bag.\n" +
      "Mobile controls: swipe anywhere to move. Swipe up on 🎒 to open the bag (swipe down to close).",
    "help.section.cat.title": "YOUR CAT 🐱",
    "help.section.cat.body":
      "♥ HP — health, you die at 0\n" +
      "⚔ Attack — damage you deal in combat\n" +
      "🛡 Armor — absorbs damage before HP\n" +
      "↑ Level/XP — gain XP from runes and kills; leveling raises ♥ max HP\n" +
      "🎒 Bag — open your items (🪙 coins, 🌿 leaves, 🧪 potions)\n" +
      "🧪 Potions — heal 5 ♥ (gain 1 every 3 🌿 leaves)\n" +
      "◆ Focus — saved for future abilities\n" +
      "🪙 Gold — saved for future shops",
    "help.section.runes.title": "RUNES (consumed when stepped on)",
    "help.section.runes.body":
      "💧 Tide → +1 ◆ focus\n" +
      "🪙 Coin → +1 🪙 gold\n" +
      "🦴 Bone → +1 ♥ HP\n" +
      "⚙️ Iron → +1 🛡 armor\n" +
      "🔥 Ember · 🌿 Bramble · ⭐ Star · 🌑 Void · 🩸 Blood — no bonus when consumed (their power is in charging LATTICES ⚡)",
    "help.section.lattices.title": "LATTICES ⚡",
    "help.section.lattices.body":
      "Rows, columns, and chambers can CHARGE when they hold enough different runes at once (see the HUD).\n" +
      "HUD legend: R = row, C = column, CH = chamber.\n" +
      "Each little box is one lattice and shows unique-rune progress: filled/needed.\n" +
      "Example: R 2/3 means that row currently contains 2 different runes, and needs 3 to charge.\n" +
      "\n" +
      "Visual example (one rune away):\n" +
      "+---+---+---+\n" +
      "| E | T |   |\n" +
      "+---+---+---+\n" +
      "|   |   |   |\n" +
      "+---+---+---+\n" +
      "|   |   |   |\n" +
      "+---+---+---+\n" +
      "Legend: E=🔥 Ember, T=💧 Tide, B=🦴 Bone, L=🌿 Bramble.\n" +
      "That top row is at 2/3 (missing 1 different rune). If B spawns in the empty spot, it becomes 3/3 and charges.\n" +
      "\n" +
      "Step-by-step example (3×3):\n" +
      "  1) Look at the HUD. Find a row/column that is at 2/3.\n" +
      "  2) Those 2 runes must stay on the board. Do NOT step on them (stepping consumes runes).\n" +
      "  3) Spend your turns moving elsewhere / fighting, so new runes keep spawning.\n" +
      "  4) If the missing rune appears in the last empty cell of that row/column, it becomes 3/3 and CHARGES.\n" +
      "  5) The last rune that completed 3/3 is the KEYSTONE and its bonus triggers instantly.\n" +
      "\n" +
      "The last rune that completes the charge becomes the KEYSTONE and triggers a bonus:\n" +
      "  💧 Tide → restore up to 3 ♥\n" +
      "  🪙 Coin → +10 🪙\n" +
      "  🦴 Bone → +2 ♥\n" +
      "  ⚙️ Iron → +2 🛡\n" +
      "  🔥 Ember → +1 ⚔ attack\n" +
      "  🌿 Bramble → +1 🧪 potion (if not full)\n" +
      "  ⭐ Star → +6 XP\n" +
      "  🌑 Void → +1 stride (up to 2)\n" +
      "  🩸 Blood → +1 ♥ max (up to 12) and +1 ♥\n" +
      "Charged lattices tint the board. If a rune disappears (consumed or an enemy dies), a lattice can decharge.",
    "help.section.exit.title": "EXIT 🚪",
    "help.section.exit.body":
      "Some exits are LOCKED 🔒.\n" +
      "Floor 1: charge any lattice ⚡ to unlock 🚪.\n" +
      "Other floors: sometimes you need a 🔑. The key-carrying enemy is marked with 🔑 — defeat it to drop the key on its cell. Your cat stays put; on the next turn step onto 🔑 to unlock the exit.",
    "help.section.enemies.title": "ENEMIES",
    "help.section.enemies.body":
      "🦇 Bat · 🐀 Rat · 🐍 Snake · 🕷 Spider · 💀 Skeleton · 👻 Ghost · 🟢 Slime · 👹 Ogre\n" +
      "Each card shows ⚔ attack on the left and ♥ HP on the right.\n" +
      "Tap to fight: you strike first; if it survives, it strikes back.\n" +
      "Each turn enemies step toward you. If they're adjacent, they attack instead of moving.\n" +
      "🛡 Armor absorbs incoming damage before ♥.\n" +
      "Killing an enemy removes its rune from the grid — that can decharge a lattice.",
    "help.section.tips.title": "TIPS",
    "help.section.tips.body":
      "Stack 🦴 Bone and 💧 Tide for healing.\n" +
      "⚙️ Iron armor turns scary fights into manageable ones.\n" +
      "🌿 Bramble: every 3 consumed → +1 🧪 potion.\n" +
      "Level up to increase ♥ max HP.\n" +
      "When the exit needs a 🔑, look for the enemy marked with 🔑.",
    "hud.newRun": "new run",
    "hud.floorLabel": "FLOOR",
    "hud.scoreLabel": "SCORE",
    "hud.levelLabel": "LEVEL",
    "hud.xpLabel": "XP",
    "hud.turnAbbr": "T",
    "inventory.title": "BAG",
    "inventory.open": "Open bag",
    "inventory.close": "Close",
    "inventory.leaf": "Leaf",
    "inventory.potion": "Potion",
    "inventory.potionHint": "🧪 {potions}",
    "inventory.sword": "Sword",
    "inventory.staff": "Staff",
    "inventory.equipped": "EQUIPPED",
    "inventory.coins": "Coins",
    "inventory.dropTitle": "DROP ITEM",
    "inventory.dropConfirm": "Are you sure you want to drop this item from your bag?",
    "inventory.dropCancel": "Cancel",
    "inventory.dropConfirmYes": "Drop",
    "hud.rowsAbbr": "R",
    "hud.colsAbbr": "C",
    "hud.chambersAbbr": "CH",
    "hud.guide.exitUnlocked": "Tap a highlighted tile. Reach 🚪 to advance.",
    "hud.guide.exitLocked": "Tap a highlighted tile. Charge ⚡ to unlock 🚪.",
    "hud.runEnded": 'Run {outcome} — tap "{newRun}" to play again.',
    "overlay.win": "You Win",
    "overlay.death": "You Died",
    "outcome.win": "WIN",
    "outcome.death": "DEATH",
    "outcome.in_progress": "IN PROGRESS",

    "event.exitUnlocked": "↑ exit unlocked",
    "event.turnStarted": "turn {turn}",
    "event.heroMoved": "→ moved to ({x},{y})",
    "event.latticeCharged": "⚡ {lattice} charged · keystone {keystone}",
    "event.latticeDecharged": "× {lattice} decharged",
    "event.runeSpawned": "+ {rune} spawned at ({x},{y})",
    "event.tileResolved.rune": "· consumed {rune}",
    "event.tileResolved.empty": "· resolved",
    "event.keystoneBonus.tide": "⚡ Tide swell — +{hp} HP ({tide} Tide on grid)",
    "event.keystoneBonus.coin": "⚡ Coin cascade — +{gold} gold",
    "event.keystoneBonus.bone": "⚡ Bone bind — +{hp} HP",
    "event.keystoneBonus.iron": "⚡ Iron oath — +{armor} armor",
    "event.keystoneBonus.ember": "⚡ Ember flare — +{atk} attack (now {total})",
    "event.keystoneBonus.bramble": "⚡ Bramble brew — +1 potion ({potions})",
    "event.keystoneBonus.brambleFull": "⚡ Bramble brew — potions full",
    "event.keystoneBonus.star": "⚡ Star insight — +{xp} XP (lvl {level})",
    "event.keystoneBonus.void": "⚡ Void step — stride {stride}",
    "event.keystoneBonus.blood": "⚡ Blood pact — ♥ max {hpMax} (+{healed} HP)",
    "event.keystoneBonus.pending": "⚡ {keystone} keystone (pending)",
    "event.goldGained": "🪙 +{amount}",
    "event.hpHealed": "♥ +{amount} HP",
    "event.armorGained": "🛡 +{amount}",
    "event.focusGained": "◆ +{amount} focus",
    "event.floorCompleted": "✓ floor {floor} cleared",
    "event.enemyMoved": "↳ enemy moved to ({x},{y})",
    "event.enemyAttacked": "! enemy struck",
    "event.enemyDamaged": "· enemy hp {hp}",
    "event.enemyKilled": "✗ enemy slain",
    "event.heroDamaged": "! you took {amount}",
    "event.heroLeveledUp": "↑ level {level} · ♥ max {hpMax}",
    "event.potionGained": "🧪 potion +1 ({potions})",
    "event.potionUsed": "🧪 used +{healed} ♥ ({potions})",
    "event.itemSpawned": "+ {item} spawned at ({x},{y})",
    "event.itemPickupBlocked": "× bag full — can't pick up {item}",
    "event.itemPickedUp": "+ picked up {item}",
    "event.itemDropped": "🗑 dropped {item}",
    "event.weaponEquipped": "⚔ equipped {item}",
    "event.weaponUnequipped": "⚔ unequipped",
    "event.weaponBroke": "✗ {item} broke",
    "event.keyDropped": "🔑 key dropped",
    "event.keyCollected": "🔑 key collected",
    "event.heroDied": "☠ you died",

    "reject.run_over": "Run is over ({outcome})",
    "reject.ability_unimplemented": "Ability not implemented yet",
    "reject.end_floor_unimplemented": "End floor not implemented yet",
    "reject.move_origin_mismatch": "Move origin does not match hero position",
    "reject.destination_oob": "Destination out of bounds",
    "reject.destination_same": "Destination equals origin",
    "reject.destination_beyond_stride": "Destination beyond stride ({distance} > {stride})",
    "reject.destination_anchored": "Destination is anchored",
    "reject.exit_locked": "Exit is locked — charge a lattice to unlock it",
    "reject.exit_locked_key": "Exit is locked — find the key",
    "reject.no_potions": "No potions",
    "reject.hp_full": "HP is already full",
    "reject.equip_noop": "Already unequipped",
    "reject.equip_missing": "Item not in bag",
    "reject.equip_not_weapon": "That item can't be equipped",

    "tile.exit": "EXIT",
    "tile.lock": "LOCK",

    "rune.ember": "ember",
    "rune.tide": "tide",
    "rune.bramble": "bramble",
    "rune.iron": "iron",
    "rune.bone": "bone",
    "rune.star": "star",
    "rune.void": "void",
    "rune.coin": "coin",
    "rune.blood": "blood",

    "title.tagline": "A TACTICAL ROGUELIKE ADVENTURE",
    "title.crest": "ONE LIFE · ONE RUN · LEAVE YOUR MARK",
    "title.flowey1": "A new descent begins.",
    "title.flowey2": "Stay sharp.",
    "title.heroLine1": "EVERY",
    "title.heroLine2": "DUNGEON",
    "title.heroLine3": "HAS A NEW",
    "title.heroLine4": "STORY",
    "title.subtitle": "MOVE. STRIKE. SURVIVE.\nDESCEND DEEPER.",
    "title.cta": "ENTER THE DUNGEON",
    "title.ctaNote": "NO SAVE POINTS.\nONLY YOUR SCORE.",
    "title.feature.realRuns.title": "REAL RUNS",
    "title.feature.realRuns.body": "No saves. No rewinds. Every step matters.",
    "title.feature.lattices.title": "LATTICES",
    "title.feature.lattices.body": "Charge rows, columns, and chambers to bend fate.",
    "title.feature.builtForLoss.title": "BUILT FOR LOSS",
    "title.feature.builtForLoss.body": "Every run ends. Learn and return stronger.",
    "title.sansLine1": "The dungeon does not forgive.",
    "title.sansLine2": "Neither should you.",
    "title.bottomLeft": "NOT LUCK. CHOICE.",
    "title.bottomRight": "ENTER THE ABYSS?",
    "title.runsHeader": "BEST DESCENTS",
    "title.runsEmpty": "NO RECORDS YET",
    "title.runsEmptyHint": "Finish a descent to appear here.",
    "title.menuHelp": "HOW TO PLAY",
    "title.menuSettings": "SETTINGS",
    "title.menuLeaderboard": "LEADERBOARD",
    "title.continue": "CONTINUE RUN",
    "runOver.title": "RUN ENDED",
    "runOver.death": "YOU FELL INTO THE ABYSS",
    "runOver.win": "YOU FOUND THE WAY OUT",
    "runOver.statFloor": "DEEPEST FLOOR",
    "runOver.statScore": "FINAL SCORE",
    "runOver.statTurn": "TURNS",
    "runOver.statLevel": "LEVEL",
    "runOver.again": "TRY AGAIN",
    "runOver.menu": "MAIN MENU",
  },
  es: {
    "app.title": "DUNGEONS & PAWS",
    "header.langLabel": "Idioma",
    "header.helpLabel": "Cómo jugar",
    "header.settingsLabel": "Ajustes",
    "header.leaderboardLabel": "Ranking",
    "help.title": "Cómo jugar",
    "help.close": "Cerrar",
    "leaderboard.title": "Ranking",
    "leaderboard.refresh": "Actualizar",
    "settings.title": "Ajustes",
    "settings.close": "Cerrar",
    "settings.language": "Idioma",
    "settings.animSpeed": "Velocidad de animación",
    "settings.swipeSensitivity": "Sensibilidad del swipe",
    "settings.legalMoveOpacity": "Opacidad de pista de movimiento",
    "settings.playerName": "Nombre",
    "settings.editName": "Editar",
    "settings.haptics": "Haptic",
    "settings.reset": "Restablecer",
    "settings.leaderboard": "Ranking",
    "settings.leaderboardNotConfigured": "Ranking no configurado",
    "settings.leaderboardLoading": "Cargando…",
    "settings.leaderboardError": "No se pudo cargar el ranking",
    "settings.leaderboardEmpty": "Todavía no hay partidas",
    "namePrompt.title": "Tu nombre",
    "namePrompt.placeholder": "Escribe tu nombre",
    "namePrompt.save": "Guardar",
    "namePrompt.required": "REQUERIDO",
    "help.section.lattices.hint": "(toca para ver)",
    "help.section.goal.title": "OBJETIVO",
    "help.section.goal.body":
      "Llega a 🚪 en cada piso para avanzar.\n" +
      "Sobrevive tantos pisos como puedas — tu 🏆 puntaje sigue subiendo.\n" +
      "Si tu ♥ HP llega a 0, mueres.",
    "help.section.move.title": "MOVIMIENTO",
    "help.section.move.body":
      "Toca una carta con borde azul para moverte. Te mueves una casilla por turno — diagonales incluidas.\n" +
      "Toca a un enemigo para atacarlo en vez de moverte.\n" +
      "Si aparece una 🔑, tócala para pisarla y recogerla.\n" +
      "\n" +
      "Controles PC: WASD o flechas. Presiona B para abrir la 🎒 mochila.\n" +
      "Controles mobile: swipe en cualquier parte para moverte. Swipe hacia arriba sobre 🎒 para abrir la mochila (swipe hacia abajo para cerrar).",
    "help.section.cat.title": "TU GATO 🐱",
    "help.section.cat.body":
      "♥ HP — vida, mueres en 0\n" +
      "⚔ Ataque — daño que infliges en combate\n" +
      "🛡 Armadura — absorbe daño antes que el HP\n" +
      "↑ Nivel/EXP — ganas EXP por runas y bajas; subir aumenta tu ♥ HP máximo\n" +
      "🎒 Mochila — abre tus objetos (🪙 monedas, 🌿 hojas, 🧪 pociones)\n" +
      "🧪 Pociones — curan 5 ♥ (ganas 1 cada 3 🌿 hojas)\n" +
      "◆ Foco — reservado para habilidades futuras\n" +
      "🪙 Oro — reservado para tiendas futuras",
    "help.section.runes.title": "RUNAS (se consumen al pisar)",
    "help.section.runes.body":
      "💧 Marea → +1 ◆ foco\n" +
      "🪙 Moneda → +1 🪙 oro\n" +
      "🦴 Hueso → +1 ♥ HP\n" +
      "⚙️ Hierro → +1 🛡 armadura\n" +
      "🔥 Brasa · 🌿 Zarza · ⭐ Estrella · 🌑 Vacío · 🩸 Sangre — no dan bonus al consumirlas (su poder está en activar LATTICES ⚡)",
    "help.section.lattices.title": "LATTICES ⚡",
    "help.section.lattices.body":
      "Filas, columnas y cámaras pueden CARGARSE cuando tienen suficientes runas distintas al mismo tiempo (mira el HUD).\n" +
      "Leyenda HUD: F = fila, C = columna, CÁM = cámara.\n" +
      "Cada cuadrito es una lattice y muestra progreso de runas distintas: actual/necesario.\n" +
      "Ejemplo: F 2/3 significa que esa fila tiene 2 runas diferentes, y necesita 3 para cargarse.\n" +
      "\n" +
      "Ejemplo visual (falta 1 runa):\n" +
      "+---+---+---+\n" +
      "| E | T |   |\n" +
      "+---+---+---+\n" +
      "|   |   |   |\n" +
      "+---+---+---+\n" +
      "|   |   |   |\n" +
      "+---+---+---+\n" +
      "Leyenda: E=🔥 Brasa, T=💧 Marea, B=🦴 Hueso, L=🌿 Zarza.\n" +
      "Esa fila de arriba está en 2/3 (falta 1 runa distinta). Si aparece B en la casilla vacía, pasa a 3/3 y se carga.\n" +
      "\n" +
      "Ejemplo paso a paso (tablero 3×3):\n" +
      "  1) Mira el HUD. Busca una Fila (F) o Columna (C) que esté en 2/3.\n" +
      "  2) Esas 2 runas deben quedarse en el tablero. NO las pises (pisar consume la runa).\n" +
      "  3) Juega tu turno moviéndote por otra zona / peleando para que sigan apareciendo runas.\n" +
      "  4) Si aparece la runa que falta en la última casilla libre de esa fila/columna, pasa a 3/3 y se CARGA.\n" +
      "  5) La última runa que completó el 3/3 es la CLAVE (keystone) y el bonus se activa al instante.\n" +
      "\n" +
      "La última runa que completa la carga es la CLAVE y dispara un bonus:\n" +
      "  💧 Marea → recupera hasta 3 ♥\n" +
      "  🪙 Moneda → +10 🪙\n" +
      "  🦴 Hueso → +2 ♥\n" +
      "  ⚙️ Hierro → +2 🛡\n" +
      "  🔥 Ascua → +1 ⚔ ataque\n" +
      "  🌿 Zarza → +1 🧪 poción (si no está lleno)\n" +
      "  ⭐ Estrella → +6 EXP\n" +
      "  🌑 Vacío → +1 paso (máx 2)\n" +
      "  🩸 Sangre → +1 ♥ máx (máx 12) y +1 ♥\n" +
      "Las lattices cargadas tiñen el tablero. Si una runa desaparece (consumida o muere un enemigo), una lattice puede descargarse.",
    "help.section.exit.title": "SALIDA 🚪",
    "help.section.exit.body":
      "A veces la salida está BLOQUEADA 🔒.\n" +
      "Piso 1: carga cualquier lattice ⚡ para desbloquear 🚪.\n" +
      "Otros pisos: a veces necesitas una 🔑. El enemigo que la tiene está marcado con 🔑 — al derrotarlo la llave cae en su celda. Tu gato se queda en su sitio; en el siguiente turno pisa la 🔑 para abrir la salida.",
    "help.section.enemies.title": "ENEMIGOS",
    "help.section.enemies.body":
      "🦇 Murciélago · 🐀 Rata · 🐍 Serpiente · 🕷 Araña · 💀 Esqueleto · 👻 Fantasma · 🟢 Slime · 👹 Ogro\n" +
      "Cada carta muestra ⚔ ataque a la izquierda y ♥ HP a la derecha.\n" +
      "Toca para pelear: tú golpeas primero; si sobrevive, te golpea.\n" +
      "Cada turno los enemigos se acercan. Si están al lado, atacan en vez de moverse.\n" +
      "🛡 La armadura absorbe daño antes que el ♥.\n" +
      "Matar un enemigo retira su runa del tablero — puede descargar una lattice.",
    "help.section.tips.title": "CONSEJOS",
    "help.section.tips.body":
      "Acumula runas 🦴 y 💧 para curarte.\n" +
      "⚙️ La armadura de Hierro convierte peleas difíciles en manejables.\n" +
      "🌿 Zarza: cada 3 consumidas → +1 🧪 poción.\n" +
      "Sube de nivel para aumentar tu ♥ HP máximo.\n" +
      "Si la salida pide 🔑, busca al enemigo marcado con 🔑.",
    "hud.newRun": "nueva partida",
    "hud.floorLabel": "PISO",
    "hud.scoreLabel": "PUNTAJE",
    "hud.levelLabel": "NIVEL",
    "hud.xpLabel": "EXP",
    "hud.turnAbbr": "T",
    "inventory.title": "MOCHILA",
    "inventory.open": "Abrir mochila",
    "inventory.close": "Cerrar",
    "inventory.leaf": "Hoja",
    "inventory.potion": "Poción",
    "inventory.potionHint": "🧪 {potions}",
    "inventory.sword": "Espada",
    "inventory.staff": "Bastón",
    "inventory.equipped": "EQUIPADO",
    "inventory.coins": "Monedas",
    "inventory.dropTitle": "BOTAR OBJETO",
    "inventory.dropConfirm": "¿Estás seguro que deseas botar este objeto de la mochila?",
    "inventory.dropCancel": "Cancelar",
    "inventory.dropConfirmYes": "Botar",
    "hud.rowsAbbr": "F",
    "hud.colsAbbr": "C",
    "hud.chambersAbbr": "CÁM",
    "hud.guide.exitUnlocked": "Toca una casilla resaltada. Llega a 🚪 para avanzar.",
    "hud.guide.exitLocked": "Toca una casilla resaltada. Carga ⚡ para desbloquear 🚪.",
    "hud.runEnded": 'Partida {outcome} — toca "{newRun}" para jugar de nuevo.',
    "overlay.win": "Has ganado",
    "overlay.death": "Has muerto",
    "outcome.win": "VICTORIA",
    "outcome.death": "MUERTE",
    "outcome.in_progress": "EN CURSO",

    "event.exitUnlocked": "↑ salida desbloqueada",
    "event.turnStarted": "turno {turn}",
    "event.heroMoved": "→ movido a ({x},{y})",
    "event.latticeCharged": "⚡ {lattice} cargada · clave {keystone}",
    "event.latticeDecharged": "× {lattice} descargada",
    "event.runeSpawned": "+ {rune} apareció en ({x},{y})",
    "event.tileResolved.rune": "· consumido {rune}",
    "event.tileResolved.empty": "· resuelto",
    "event.keystoneBonus.tide": "⚡ Oleaje — +{hp} HP ({tide} Mareas en el tablero)",
    "event.keystoneBonus.coin": "⚡ Cascada — +{gold} oro",
    "event.keystoneBonus.bone": "⚡ Atadura — +{hp} HP",
    "event.keystoneBonus.iron": "⚡ Juramento — +{armor} armadura",
    "event.keystoneBonus.ember": "⚡ Ascua — +{atk} ⚔ ataque (ahora {total})",
    "event.keystoneBonus.bramble": "⚡ Zarza — +1 🧪 poción ({potions})",
    "event.keystoneBonus.brambleFull": "⚡ Zarza — pociones llenas",
    "event.keystoneBonus.star": "⚡ Estrella — +{xp} EXP (nivel {level})",
    "event.keystoneBonus.void": "⚡ Vacío — paso {stride}",
    "event.keystoneBonus.blood": "⚡ Sangre — ♥ máx {hpMax} (+{healed} ♥)",
    "event.keystoneBonus.pending": "⚡ clave {keystone} (pendiente)",
    "event.goldGained": "🪙 +{amount}",
    "event.hpHealed": "♥ +{amount} HP",
    "event.armorGained": "🛡 +{amount}",
    "event.focusGained": "◆ +{amount} foco",
    "event.floorCompleted": "✓ piso {floor} completado",
    "event.enemyMoved": "↳ enemigo a ({x},{y})",
    "event.enemyAttacked": "! enemigo atacó",
    "event.enemyDamaged": "· enemigo hp {hp}",
    "event.enemyKilled": "✗ enemigo derrotado",
    "event.heroDamaged": "! recibiste {amount}",
    "event.heroLeveledUp": "↑ nivel {level} · ♥ máx {hpMax}",
    "event.potionGained": "🧪 poción +1 ({potions})",
    "event.potionUsed": "🧪 usada +{healed} ♥ ({potions})",
    "event.itemSpawned": "+ {item} apareció en ({x},{y})",
    "event.itemPickupBlocked": "× mochila llena — no puedes recoger {item}",
    "event.itemPickedUp": "+ recogiste {item}",
    "event.itemDropped": "🗑 botaste {item}",
    "event.weaponEquipped": "⚔ equipaste {item}",
    "event.weaponUnequipped": "⚔ desequipado",
    "event.weaponBroke": "✗ {item} se rompió",
    "event.keyDropped": "🔑 llave cayó",
    "event.keyCollected": "🔑 llave recogida",
    "event.heroDied": "☠ has muerto",

    "reject.run_over": "La partida terminó ({outcome})",
    "reject.ability_unimplemented": "Habilidad aún no implementada",
    "reject.end_floor_unimplemented": "Fin de piso aún no implementado",
    "reject.move_origin_mismatch": "El origen no coincide con la posición del héroe",
    "reject.destination_oob": "Destino fuera del tablero",
    "reject.destination_same": "El destino es el origen",
    "reject.destination_beyond_stride": "Destino fuera de alcance ({distance} > {stride})",
    "reject.destination_anchored": "El destino está anclado",
    "reject.exit_locked": "La salida está bloqueada — carga una lattice para desbloquearla",
    "reject.exit_locked_key": "La salida está bloqueada — encuentra la llave",
    "reject.no_potions": "No tienes pociones",
    "reject.hp_full": "Ya tienes la vida al máximo",
    "reject.equip_noop": "Ya está desequipado",
    "reject.equip_missing": "Ese objeto no está en la mochila",
    "reject.equip_not_weapon": "Ese objeto no se puede equipar",

    "tile.exit": "SALIR",
    "tile.lock": "BLOQ",

    "rune.ember": "ascua",
    "rune.tide": "marea",
    "rune.bramble": "zarza",
    "rune.iron": "hierro",
    "rune.bone": "hueso",
    "rune.star": "estrella",
    "rune.void": "vacío",
    "rune.coin": "moneda",
    "rune.blood": "sangre",

    "title.tagline": "UN ROGUELIKE TÁCTICO DE AVENTURA",
    "title.crest": "UNA VIDA · UN DESCENSO · DEJA TU HUELLA",
    "title.flowey1": "Comienza un nuevo descenso.",
    "title.flowey2": "Mantente alerta.",
    "title.heroLine1": "CADA",
    "title.heroLine2": "DUNGEON",
    "title.heroLine3": "TIENE UNA",
    "title.heroLine4": "HISTORIA",
    "title.subtitle": "MUEVE. ATACA. SOBREVIVE.\nDESCIENDE MÁS PROFUNDO.",
    "title.cta": "COMENZAR EL DESCENSO",
    "title.ctaNote": "SIN GUARDADO.\nSOLO TU PUNTAJE.",
    "title.feature.realRuns.title": "PARTIDAS REALES",
    "title.feature.realRuns.body": "Sin guardado. Cada paso importa.",
    "title.feature.lattices.title": "LATTICES",
    "title.feature.lattices.body": "Carga filas, columnas y cámaras para torcer el destino.",
    "title.feature.builtForLoss.title": "HECHO PARA PERDER",
    "title.feature.builtForLoss.body": "Toda run termina. Aprende y vuelve más fuerte.",
    "title.sansLine1": "El abismo no perdona.",
    "title.sansLine2": "Ni tú.",
    "title.bottomLeft": "NO ES SUERTE. ES ELECCIÓN.",
    "title.bottomRight": "¿ENTRAS AL ABISMO?",
    "title.runsHeader": "MEJORES DESCENSOS",
    "title.runsEmpty": "AÚN NO HAY RÉCORDS",
    "title.runsEmptyHint": "Completa un descenso para aparecer aquí.",
    "title.menuHelp": "CÓMO JUGAR",
    "title.menuSettings": "AJUSTES",
    "title.menuLeaderboard": "RANKING",
    "title.continue": "CONTINUAR PARTIDA",
    "runOver.title": "PARTIDA TERMINADA",
    "runOver.death": "CAÍSTE EN EL ABISMO",
    "runOver.win": "ENCONTRASTE LA SALIDA",
    "runOver.statFloor": "PISO MÁS PROFUNDO",
    "runOver.statScore": "PUNTAJE FINAL",
    "runOver.statTurn": "TURNOS",
    "runOver.statLevel": "NIVEL",
    "runOver.again": "REINTENTAR",
    "runOver.menu": "MENÚ PRINCIPAL",
  },
  pt: {
    "app.title": "DUNGEONS & PAWS",
    "header.langLabel": "Idioma",
    "header.helpLabel": "Como jogar",
    "header.settingsLabel": "Ajustes",
    "header.leaderboardLabel": "Ranking",
    "help.title": "Como jogar",
    "help.close": "Fechar",
    "leaderboard.title": "Ranking",
    "leaderboard.refresh": "Atualizar",
    "settings.title": "Ajustes",
    "settings.close": "Fechar",
    "settings.language": "Idioma",
    "settings.animSpeed": "Velocidade da animação",
    "settings.swipeSensitivity": "Sensibilidade do swipe",
    "settings.legalMoveOpacity": "Opacidade da dica de movimento",
    "settings.playerName": "Nome",
    "settings.editName": "Editar",
    "settings.haptics": "Haptic",
    "settings.reset": "Restaurar padrão",
    "settings.leaderboard": "Ranking",
    "settings.leaderboardNotConfigured": "Ranking não configurado",
    "settings.leaderboardLoading": "Carregando…",
    "settings.leaderboardError": "Não foi possível carregar o ranking",
    "settings.leaderboardEmpty": "Ainda sem partidas",
    "namePrompt.title": "Seu nome",
    "namePrompt.placeholder": "Digite seu nome",
    "namePrompt.save": "Salvar",
    "namePrompt.required": "OBRIGATÓRIO",
    "help.section.lattices.hint": "(toque para abrir)",
    "help.section.goal.title": "OBJETIVO",
    "help.section.goal.body":
      "Chegue a 🚪 em cada andar para avançar.\n" +
      "Sobreviva o máximo de andares possível — sua 🏆 pontuação só aumenta.\n" +
      "Se seu ♥ HP chegar a 0, você morre.",
    "help.section.move.title": "MOVIMENTO",
    "help.section.move.body":
      "Toque numa carta com borda azul para se mover. Você move uma casa por turno — diagonais inclusas.\n" +
      "Toque um inimigo para atacar em vez de se mover.\n" +
      "Se aparecer uma 🔑, toque nela para pisar e coletar.\n" +
      "\n" +
      "Controles no PC: WASD ou setas. Aperte B para abrir a 🎒 mochila.\n" +
      "No celular: swipe em qualquer lugar para se mover. Swipe para cima no 🎒 para abrir a mochila (swipe para baixo para fechar).",
    "help.section.cat.title": "SEU GATO 🐱",
    "help.section.cat.body":
      "♥ HP — vida, você morre em 0\n" +
      "⚔ Ataque — dano que você causa em combate\n" +
      "🛡 Armadura — absorve dano antes do HP\n" +
      "↑ Nível/EXP — ganha EXP por runas e abates; subir aumenta o ♥ HP máximo\n" +
      "🎒 Mochila — abre seus itens (🪙 moedas, 🌿 folhas, 🧪 poções)\n" +
      "🧪 Poções — curam 5 ♥ (ganha 1 a cada 3 🌿 folhas)\n" +
      "◆ Foco — reservado para habilidades futuras\n" +
      "🪙 Ouro — reservado para lojas futuras",
    "help.section.runes.title": "RUNAS (consumidas ao pisar)",
    "help.section.runes.body":
      "💧 Maré → +1 ◆ foco\n" +
      "🪙 Moeda → +1 🪙 ouro\n" +
      "🦴 Osso → +1 ♥ HP\n" +
      "⚙️ Ferro → +1 🛡 armadura\n" +
      "🔥 Brasa · 🌿 Espinho · ⭐ Estrela · 🌑 Vazio · 🩸 Sangue — sem bônus ao consumir (o poder está em ativar LATTICES ⚡)",
    "help.section.lattices.title": "LATTICES ⚡",
    "help.section.lattices.body":
      "Linhas, colunas e câmaras podem CARREGAR quando têm runas diferentes suficientes ao mesmo tempo (veja o HUD).\n" +
      "Legenda HUD: L = linha, C = coluna, CAM = câmara.\n" +
      "Cada quadradinho é uma lattice e mostra progresso de runas diferentes: atual/necessário.\n" +
      "Exemplo: L 2/3 significa que essa linha tem 2 runas diferentes e precisa de 3 para carregar.\n" +
      "\n" +
      "Exemplo visual (falta 1 runa):\n" +
      "+---+---+---+\n" +
      "| E | T |   |\n" +
      "+---+---+---+\n" +
      "|   |   |   |\n" +
      "+---+---+---+\n" +
      "|   |   |   |\n" +
      "+---+---+---+\n" +
      "Legenda: E=🔥 Brasa, T=💧 Maré, B=🦴 Osso, L=🌿 Espinho.\n" +
      "Essa linha de cima está em 2/3 (falta 1 runa diferente). Se B aparecer na casa vazia, vira 3/3 e carrega.\n" +
      "\n" +
      "Exemplo passo a passo (tabuleiro 3×3):\n" +
      "  1) Olhe o HUD. Ache uma linha (L) ou coluna (C) que esteja em 2/3.\n" +
      "  2) Essas 2 runas precisam ficar no tabuleiro. NÃO pise nelas (pisar consome a runa).\n" +
      "  3) Faça seu turno em outra área / lutando para continuar gerando runas.\n" +
      "  4) Quando a runa que falta aparecer na última casa livre, vira 3/3 e CARREGA.\n" +
      "  5) A última runa que completou o 3/3 vira a CHAVE (keystone) e o bônus ativa na hora.\n" +
      "\n" +
      "A última runa que completa a carga vira CHAVE e dispara um bônus:\n" +
      "  💧 Maré → restaura até 3 ♥\n" +
      "  🪙 Moeda → +10 🪙\n" +
      "  🦴 Osso → +2 ♥\n" +
      "  ⚙️ Ferro → +2 🛡\n" +
      "  🔥 Brasa → +1 ⚔ ataque\n" +
      "  🌿 Espinho → +1 🧪 poção (se não estiver cheio)\n" +
      "  ⭐ Estrela → +6 EXP\n" +
      "  🌑 Vazio → +1 passo (máx 2)\n" +
      "  🩸 Sangue → +1 ♥ máx (máx 12) e +1 ♥\n" +
      "Lattices carregadas tingem o tabuleiro. Se uma runa sumir (consumida ou inimigo morre), uma lattice pode descarregar.",
    "help.section.exit.title": "SAÍDA 🚪",
    "help.section.exit.body":
      "Às vezes a saída está TRAVADA 🔒.\n" +
      "Andar 1: carregue qualquer lattice ⚡ para destravar 🚪.\n" +
      "Outros andares: às vezes você precisa de uma 🔑. O inimigo que carrega a chave fica marcado com 🔑 — ao derrotá-lo, a chave cai na casa dele. Seu gato fica no lugar; no próximo turno pise na 🔑 para destravar a saída.",
    "help.section.enemies.title": "INIMIGOS",
    "help.section.enemies.body":
      "🦇 Morcego · 🐀 Rato · 🐍 Cobra · 🕷 Aranha · 💀 Esqueleto · 👻 Fantasma · 🟢 Slime · 👹 Ogro\n" +
      "Cada carta mostra ⚔ ataque à esquerda e ♥ HP à direita.\n" +
      "Toque para lutar: você golpeia primeiro; se sobreviver, ele revida.\n" +
      "A cada turno os inimigos se aproximam. Se ficarem ao lado, atacam em vez de se mover.\n" +
      "🛡 A armadura absorve dano antes do ♥.\n" +
      "Matar um inimigo remove sua runa do tabuleiro — pode descarregar uma lattice.",
    "help.section.tips.title": "DICAS",
    "help.section.tips.body":
      "Acumule runas 🦴 e 💧 para curar.\n" +
      "⚙️ A armadura de Ferro transforma lutas difíceis em algo gerenciável.\n" +
      "🌿 Espinho: a cada 3 consumidos → +1 🧪 poção.\n" +
      "Suba de nível para aumentar o ♥ HP máximo.\n" +
      "Se a saída pedir 🔑, procure o inimigo marcado com 🔑.",
    "hud.newRun": "novo jogo",
    "hud.floorLabel": "ANDAR",
    "hud.scoreLabel": "PONTOS",
    "hud.levelLabel": "NÍVEL",
    "hud.xpLabel": "EXP",
    "hud.turnAbbr": "T",
    "inventory.title": "MOCHILA",
    "inventory.open": "Abrir mochila",
    "inventory.close": "Fechar",
    "inventory.leaf": "Folha",
    "inventory.potion": "Poção",
    "inventory.potionHint": "🧪 {potions}",
    "inventory.sword": "Espada",
    "inventory.staff": "Cajado",
    "inventory.equipped": "EQUIPADO",
    "inventory.coins": "Moedas",
    "inventory.dropTitle": "DESCARTAR ITEM",
    "inventory.dropConfirm": "Tem certeza que deseja descartar este item da mochila?",
    "inventory.dropCancel": "Cancelar",
    "inventory.dropConfirmYes": "Descartar",
    "hud.rowsAbbr": "L",
    "hud.colsAbbr": "C",
    "hud.chambersAbbr": "CAM",
    "hud.guide.exitUnlocked": "Toque numa casa destacada. Chegue a 🚪 para avançar.",
    "hud.guide.exitLocked": "Toque numa casa destacada. Carregue ⚡ para destravar 🚪.",
    "hud.runEnded": 'Partida {outcome} — toque "{newRun}" para jogar de novo.',
    "overlay.win": "Você venceu",
    "overlay.death": "Você morreu",
    "outcome.win": "VITÓRIA",
    "outcome.death": "MORTE",
    "outcome.in_progress": "EM ANDAMENTO",

    "event.exitUnlocked": "↑ saída destravada",
    "event.turnStarted": "turno {turn}",
    "event.heroMoved": "→ movido para ({x},{y})",
    "event.latticeCharged": "⚡ {lattice} carregada · chave {keystone}",
    "event.latticeDecharged": "× {lattice} descarregada",
    "event.runeSpawned": "+ {rune} surgiu em ({x},{y})",
    "event.tileResolved.rune": "· consumido {rune}",
    "event.tileResolved.empty": "· resolvido",
    "event.keystoneBonus.tide": "⚡ Maré — +{hp} HP ({tide} Marés no tabuleiro)",
    "event.keystoneBonus.coin": "⚡ Cascata — +{gold} ouro",
    "event.keystoneBonus.bone": "⚡ Ossos — +{hp} HP",
    "event.keystoneBonus.iron": "⚡ Ferro — +{armor} armadura",
    "event.keystoneBonus.ember": "⚡ Brasa — +{atk} ⚔ ataque (agora {total})",
    "event.keystoneBonus.bramble": "⚡ Espinho — +1 🧪 poção ({potions})",
    "event.keystoneBonus.brambleFull": "⚡ Espinho — poções cheias",
    "event.keystoneBonus.star": "⚡ Estrela — +{xp} EXP (nível {level})",
    "event.keystoneBonus.void": "⚡ Vazio — passo {stride}",
    "event.keystoneBonus.blood": "⚡ Sangue — ♥ máx {hpMax} (+{healed} ♥)",
    "event.keystoneBonus.pending": "⚡ chave {keystone} (pendente)",
    "event.goldGained": "🪙 +{amount}",
    "event.hpHealed": "♥ +{amount} HP",
    "event.armorGained": "🛡 +{amount}",
    "event.focusGained": "◆ +{amount} foco",
    "event.floorCompleted": "✓ andar {floor} concluído",
    "event.enemyMoved": "↳ inimigo para ({x},{y})",
    "event.enemyAttacked": "! inimigo atacou",
    "event.enemyDamaged": "· inimigo hp {hp}",
    "event.enemyKilled": "✗ inimigo derrotado",
    "event.heroDamaged": "! você levou {amount}",
    "event.heroLeveledUp": "↑ nível {level} · ♥ máx {hpMax}",
    "event.potionGained": "🧪 poção +1 ({potions})",
    "event.potionUsed": "🧪 usada +{healed} ♥ ({potions})",
    "event.itemSpawned": "+ {item} surgiu em ({x},{y})",
    "event.itemPickupBlocked": "× mochila cheia — não pode pegar {item}",
    "event.itemPickedUp": "+ pegou {item}",
    "event.itemDropped": "🗑 descartou {item}",
    "event.weaponEquipped": "⚔ equipou {item}",
    "event.weaponUnequipped": "⚔ desequipado",
    "event.weaponBroke": "✗ {item} quebrou",
    "event.keyDropped": "🔑 chave caiu",
    "event.keyCollected": "🔑 chave coletada",
    "event.heroDied": "☠ você morreu",

    "reject.run_over": "A partida acabou ({outcome})",
    "reject.ability_unimplemented": "Habilidade ainda não implementada",
    "reject.end_floor_unimplemented": "Fim do andar ainda não implementado",
    "reject.move_origin_mismatch": "A origem não coincide com a posição do herói",
    "reject.destination_oob": "Destino fora do tabuleiro",
    "reject.destination_same": "O destino é a origem",
    "reject.destination_beyond_stride": "Destino fora do alcance ({distance} > {stride})",
    "reject.destination_anchored": "O destino está ancorado",
    "reject.exit_locked": "A saída está bloqueada — carregue uma lattice para destravar",
    "reject.exit_locked_key": "A saída está bloqueada — encontre a chave",
    "reject.no_potions": "Sem poções",
    "reject.hp_full": "HP já está cheio",
    "reject.equip_noop": "Já está desequipado",
    "reject.equip_missing": "Esse item não está na mochila",
    "reject.equip_not_weapon": "Esse item não pode ser equipado",

    "tile.exit": "SAIR",
    "tile.lock": "TRAVA",

    "rune.ember": "brasa",
    "rune.tide": "maré",
    "rune.bramble": "espinho",
    "rune.iron": "ferro",
    "rune.bone": "osso",
    "rune.star": "estrela",
    "rune.void": "vazio",
    "rune.coin": "moeda",
    "rune.blood": "sangue",

    "title.tagline": "UM ROGUELIKE TÁTICO DE AVENTURA",
    "title.crest": "UMA VIDA · UMA DESCIDA · DEIXE SUA MARCA",
    "title.flowey1": "Um novo descenso começa.",
    "title.flowey2": "Fique atento.",
    "title.heroLine1": "CADA",
    "title.heroLine2": "DUNGEON",
    "title.heroLine3": "TEM UMA",
    "title.heroLine4": "HISTÓRIA",
    "title.subtitle": "MOVA. ATAQUE. SOBREVIVA.\nDESÇA MAIS FUNDO.",
    "title.cta": "ENTRAR NO DUNGEON",
    "title.ctaNote": "SEM SAVE.\nSÓ A SUA PONTUAÇÃO.",
    "title.feature.realRuns.title": "PARTIDAS REAIS",
    "title.feature.realRuns.body": "Sem save. Cada passo importa.",
    "title.feature.lattices.title": "LATTICES",
    "title.feature.lattices.body": "Carregue linhas, colunas e câmaras para dobrar o destino.",
    "title.feature.builtForLoss.title": "FEITO PRA PERDER",
    "title.feature.builtForLoss.body": "Toda run termina. Aprenda e volte mais forte.",
    "title.sansLine1": "O dungeon não perdoa.",
    "title.sansLine2": "Você também não deveria.",
    "title.bottomLeft": "NÃO É SORTE. É ESCOLHA.",
    "title.bottomRight": "ENTRAR NO ABISMO?",
    "title.runsHeader": "MELHORES DESCIDAS",
    "title.runsEmpty": "AINDA NÃO HÁ RECORDES",
    "title.runsEmptyHint": "Conclua uma descida para aparecer aqui.",
    "title.menuHelp": "COMO JOGAR",
    "title.menuSettings": "AJUSTES",
    "title.menuLeaderboard": "RANKING",
    "title.continue": "CONTINUAR PARTIDA",
    "runOver.title": "PARTIDA ENCERRADA",
    "runOver.death": "VOCÊ CAIU NO ABISMO",
    "runOver.win": "VOCÊ ACHOU A SAÍDA",
    "runOver.statFloor": "ANDAR MAIS FUNDO",
    "runOver.statScore": "PONTUAÇÃO FINAL",
    "runOver.statTurn": "TURNOS",
    "runOver.statLevel": "NÍVEL",
    "runOver.again": "TENTAR DE NOVO",
    "runOver.menu": "MENU PRINCIPAL",
  },
};

let CURRENT_LOCALE: Locale = readStoredLocale() ?? detectLocale();

function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === "en" || raw === "es" || raw === "pt") return raw;
    return null;
  } catch {
    return null;
  }
}

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const langs = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(
    Boolean,
  ) as string[];
  for (const l of langs) {
    const tag = l.toLowerCase();
    if (tag.startsWith("es")) return "es";
    if (tag.startsWith("pt")) return "pt";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

export function getLocale(): Locale {
  return CURRENT_LOCALE;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[CURRENT_LOCALE] ?? DICTS.en;
  const fallback = DICTS.en[key] ?? key;
  const template = dict[key] ?? fallback;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}

export function setLocale(locale: Locale): void {
  if (CURRENT_LOCALE === locale) return;
  CURRENT_LOCALE = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage failures
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOCALE_CHANGED_EVENT));
  }
}

export function tRune(rune: string): string {
  return t(`rune.${rune}`);
}

export function subscribeLocaleChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOCALE_CHANGED_EVENT, cb);
  return () => window.removeEventListener(LOCALE_CHANGED_EVENT, cb);
}
