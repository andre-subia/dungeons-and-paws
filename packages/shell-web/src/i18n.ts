export type Locale = "en" | "es" | "pt";

type Dict = Record<string, string>;

export const LOCALES: readonly Locale[] = ["en", "es", "pt"] as const;

const LOCALE_STORAGE_KEY = "gridlore:locale";
const LOCALE_CHANGED_EVENT = "gridlore:locale-changed";

const DICTS: Record<Locale, Dict> = {
  en: {
    "app.title": "MICHI MAZE",
    "header.langLabel": "Language",
    "header.helpLabel": "How to play",
    "help.title": "How to play",
    "help.close": "Close",
    "help.section.goal.title": "GOAL",
    "help.section.goal.body":
      "Reach 🚪 on each floor to advance.\n" +
      "Survive 3 floors to win the run.\n" +
      "If your ♥ HP hits 0 you die.",
    "help.section.move.title": "MOVING",
    "help.section.move.body":
      "Tap a card with a blue border to move there. You move one cell per turn — diagonals included.\n" +
      "Tap an enemy card to attack instead of moving.",
    "help.section.cat.title": "YOUR CAT 🐱",
    "help.section.cat.body":
      "♥ HP — health, you die at 0\n" +
      "⚔ Attack — damage you deal in combat\n" +
      "🛡 Armor — absorbs damage before HP\n" +
      "◆ Focus — saved for future abilities\n" +
      "🪙 Gold — saved for future shops",
    "help.section.runes.title": "RUNES (consumed when stepped on)",
    "help.section.runes.body":
      "💧 Tide → +1 ◆ focus\n" +
      "🪙 Coin → +1 🪙 gold\n" +
      "🦴 Bone → +1 ♥ HP\n" +
      "⚙️ Iron → +1 🛡 armor\n" +
      "🔥 Ember · 🌿 Bramble · ⭐ Star · 🌑 Void · 🩸 Blood — consumed only (effects coming)",
    "help.section.lattices.title": "LATTICES ⚡",
    "help.section.lattices.body":
      "Each ROW and COLUMN charges when it holds 3 different runes at once.\n" +
      "The last rune placed becomes the KEYSTONE and triggers a bonus:\n" +
      "  💧 Tide → restore up to 5 ♥\n" +
      "  🪙 Coin → +25 🪙\n" +
      "  🦴 Bone → +5 ♥\n" +
      "  ⚙️ Iron → +5 🛡\n" +
      "  others → coming soon\n" +
      "The HUD strip shows R / C charge progress per lattice.",
    "help.section.exit.title": "EXIT 🚪",
    "help.section.exit.body":
      "On Floor 1 the exit is LOCKED 🔒. Charge any lattice to unlock it.\n" +
      "On Floors 2 and 3 the exit is open from the start.",
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
      "Floor 1: 2 weak enemies. Floor 2: 3 mixed. Floor 3: 4 — 👹 Ogre may appear (5♥ ⚔2).\n" +
      "Stack 🦴 Bone and 💧 Tide for healing.\n" +
      "⚙️ Iron armor turns scary fights into manageable ones.\n" +
      "Avoid sitting next to 🐍 Snake / 👻 Ghost / 👹 Ogre — they hit hard every turn.\n" +
      "Sometimes it's better to leave an enemy alive to keep your lattice charged.",
    "hud.newRun": "new run",
    "hud.floorLabel": "FLOOR",
    "hud.scoreLabel": "SCORE",
    "hud.levelLabel": "LEVEL",
    "hud.xpLabel": "XP",
    "hud.floorAbbr": "F",
    "hud.turnAbbr": "T",
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
    "event.potionGained": "🧪 potion +1 ({potions}/{max})",
    "event.potionUsed": "🧪 used +{healed} ♥ ({potions}/{max})",
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
    "reject.no_potions": "No potions",
    "reject.hp_full": "HP is already full",

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
  },
  es: {
    "app.title": "MICHI MAZE",
    "header.langLabel": "Idioma",
    "header.helpLabel": "Cómo jugar",
    "help.title": "Cómo jugar",
    "help.close": "Cerrar",
    "help.section.goal.title": "OBJETIVO",
    "help.section.goal.body":
      "Llega a 🚪 en cada piso para avanzar.\n" +
      "Sobrevive 3 pisos para ganar la partida.\n" +
      "Si tu ♥ HP llega a 0, mueres.",
    "help.section.move.title": "MOVIMIENTO",
    "help.section.move.body":
      "Toca una carta con borde azul para moverte. Te mueves una casilla por turno — diagonales incluidas.\n" +
      "Toca a un enemigo para atacarlo en vez de moverte.",
    "help.section.cat.title": "TU GATO 🐱",
    "help.section.cat.body":
      "♥ HP — vida, mueres en 0\n" +
      "⚔ Ataque — daño que infliges en combate\n" +
      "🛡 Armadura — absorbe daño antes que el HP\n" +
      "◆ Foco — reservado para habilidades futuras\n" +
      "🪙 Oro — reservado para tiendas futuras",
    "help.section.runes.title": "RUNAS (se consumen al pisar)",
    "help.section.runes.body":
      "💧 Marea → +1 ◆ foco\n" +
      "🪙 Moneda → +1 🪙 oro\n" +
      "🦴 Hueso → +1 ♥ HP\n" +
      "⚙️ Hierro → +1 🛡 armadura\n" +
      "🔥 Brasa · 🌿 Zarza · ⭐ Estrella · 🌑 Vacío · 🩸 Sangre — solo se consumen (efectos próximos)",
    "help.section.lattices.title": "LATTICES ⚡",
    "help.section.lattices.body":
      "Cada FILA y COLUMNA se carga cuando tiene 3 runas distintas al mismo tiempo.\n" +
      "La última runa colocada es la CLAVE y dispara un bonus:\n" +
      "  💧 Marea → recupera hasta 5 ♥\n" +
      "  🪙 Moneda → +25 🪙\n" +
      "  🦴 Hueso → +5 ♥\n" +
      "  ⚙️ Hierro → +5 🛡\n" +
      "  otras → próximamente\n" +
      "La barra del HUD muestra el progreso F / C de cada lattice.",
    "help.section.exit.title": "SALIDA 🚪",
    "help.section.exit.body":
      "En el Piso 1 la salida está BLOQUEADA 🔒. Carga cualquier lattice para desbloquearla.\n" +
      "En los Pisos 2 y 3 la salida está abierta desde el inicio.",
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
      "Piso 1: 2 enemigos débiles. Piso 2: 3 mixtos. Piso 3: 4 — puede aparecer 👹 Ogro (5♥ ⚔2).\n" +
      "Acumula runas 🦴 y 💧 para curarte.\n" +
      "⚙️ La armadura de Hierro convierte peleas difíciles en manejables.\n" +
      "Evita quedarte al lado de 🐍 / 👻 / 👹 — pegan fuerte cada turno.\n" +
      "A veces conviene dejar vivo a un enemigo para mantener tu lattice cargada.",
    "hud.newRun": "nueva partida",
    "hud.floorLabel": "PISO",
    "hud.scoreLabel": "PUNTAJE",
    "hud.levelLabel": "NIVEL",
    "hud.xpLabel": "EXP",
    "hud.floorAbbr": "P",
    "hud.turnAbbr": "T",
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
    "event.potionGained": "🧪 poción +1 ({potions}/{max})",
    "event.potionUsed": "🧪 usada +{healed} ♥ ({potions}/{max})",
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
    "reject.no_potions": "No tienes pociones",
    "reject.hp_full": "Ya tienes la vida al máximo",

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
  },
  pt: {
    "app.title": "MICHI MAZE",
    "header.langLabel": "Idioma",
    "header.helpLabel": "Como jogar",
    "help.title": "Como jogar",
    "help.close": "Fechar",
    "help.section.goal.title": "OBJETIVO",
    "help.section.goal.body":
      "Chegue a 🚪 em cada andar para avançar.\n" +
      "Sobreviva a 3 andares para vencer a partida.\n" +
      "Se seu ♥ HP chegar a 0, você morre.",
    "help.section.move.title": "MOVIMENTO",
    "help.section.move.body":
      "Toque numa carta com borda azul para se mover. Você move uma casa por turno — diagonais inclusas.\n" +
      "Toque um inimigo para atacar em vez de se mover.",
    "help.section.cat.title": "SEU GATO 🐱",
    "help.section.cat.body":
      "♥ HP — vida, você morre em 0\n" +
      "⚔ Ataque — dano que você causa em combate\n" +
      "🛡 Armadura — absorve dano antes do HP\n" +
      "◆ Foco — reservado para habilidades futuras\n" +
      "🪙 Ouro — reservado para lojas futuras",
    "help.section.runes.title": "RUNAS (consumidas ao pisar)",
    "help.section.runes.body":
      "💧 Maré → +1 ◆ foco\n" +
      "🪙 Moeda → +1 🪙 ouro\n" +
      "🦴 Osso → +1 ♥ HP\n" +
      "⚙️ Ferro → +1 🛡 armadura\n" +
      "🔥 Brasa · 🌿 Espinho · ⭐ Estrela · 🌑 Vazio · 🩸 Sangue — só são consumidas (efeitos em breve)",
    "help.section.lattices.title": "LATTICES ⚡",
    "help.section.lattices.body":
      "Cada LINHA e COLUNA carrega quando tem 3 runas diferentes ao mesmo tempo.\n" +
      "A última runa colocada vira CHAVE e dispara um bônus:\n" +
      "  💧 Maré → restaura até 5 ♥\n" +
      "  🪙 Moeda → +25 🪙\n" +
      "  🦴 Osso → +5 ♥\n" +
      "  ⚙️ Ferro → +5 🛡\n" +
      "  outras → em breve\n" +
      "A faixa do HUD mostra o progresso L / C de cada lattice.",
    "help.section.exit.title": "SAÍDA 🚪",
    "help.section.exit.body":
      "No Andar 1 a saída está TRAVADA 🔒. Carregue qualquer lattice para destravá-la.\n" +
      "Nos Andares 2 e 3 a saída está aberta desde o início.",
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
      "Andar 1: 2 inimigos fracos. Andar 2: 3 mistos. Andar 3: 4 — pode surgir 👹 Ogro (5♥ ⚔2).\n" +
      "Acumule runas 🦴 e 💧 para curar.\n" +
      "⚙️ A armadura de Ferro transforma lutas difíceis em algo gerenciável.\n" +
      "Evite ficar ao lado de 🐍 / 👻 / 👹 — batem forte a cada turno.\n" +
      "Às vezes vale deixar um inimigo vivo para manter sua lattice carregada.",
    "hud.newRun": "novo jogo",
    "hud.floorLabel": "ANDAR",
    "hud.scoreLabel": "PONTOS",
    "hud.levelLabel": "NÍVEL",
    "hud.xpLabel": "EXP",
    "hud.floorAbbr": "A",
    "hud.turnAbbr": "T",
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
    "event.potionGained": "🧪 poção +1 ({potions}/{max})",
    "event.potionUsed": "🧪 usada +{healed} ♥ ({potions}/{max})",
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
    "reject.no_potions": "Sem poções",
    "reject.hp_full": "HP já está cheio",

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
