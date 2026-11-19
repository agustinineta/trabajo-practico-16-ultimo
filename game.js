const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Paleta institucional IPET 249 (bordó, amarillo, rojo y blanco)
const PALETTE = {
  bordo: "#5A1224",
  bordoOscuro: "#2B0710",
  rojo: "#D62828",
  amarillo: "#FCBF49",
  blanco: "#F8F9FA",
  bsod: "#1D4ED8",
  ram: "#10B981"
};

// Estados lógicos del juego
const STATE = {
  MENU: "MENU",
  PLAYING: "PLAYING",
  GAME_OVER: "GAME_OVER"
};

// Carga del escudo institucional del IPET 249
const escudoImg = new Image();
let escudoCargado = false;
escudoImg.src = "escudo-ipet249.png";
escudoImg.onload = () => {
  escudoCargado = true;
};

const STORAGE_KEY = "ipet249_copernico_highscore";
let highScore = Number(localStorage.getItem(STORAGE_KEY) || 0);

let gameState = STATE.MENU;
let score = 0;
let frameCount = 0;
let lastTimestamp = 0;

// Jugador (Dron / Chip de Informática)
const player = {
  x: 130,
  y: canvas.height / 2,
  width: 44,
  height: 34,
  vx: 0,
  vy: 0,
  gravity: 1350,   // px/s^2
  impulse: -430,   // px/s hacia arriba
  maxFallSpeed: 620
};

let obstacles = [];
let collectibles = [];
let particles = [];

function resetGame() {
  player.x = 130;
  player.y = canvas.height / 2 - player.height / 2;
  player.vy = 0;
  obstacles = [];
  collectibles = [];
  particles = [];
  score = 0;
  frameCount = 0;
}

function triggerJump() {
  if (gameState === STATE.MENU) {
    resetGame();
    gameState = STATE.PLAYING;
    player.vy = player.impulse;
    spawnParticles(player.x, player.y + player.height / 2, PALETTE.amarillo, 10);
    return;
  }

  if (gameState === STATE.PLAYING) {
    player.vy = player.impulse;
    spawnParticles(player.x, player.y + player.height / 2, PALETTE.amarillo, 8);
    return;
  }

  if (gameState === STATE.GAME_OVER) {
    resetGame();
    gameState = STATE.PLAYING;
    player.vy = player.impulse;
  }
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: -80 - Math.random() * 140,
      vy: (Math.random() - 0.5) * 220,
      size: 3 + Math.random() * 4,
      life: 0.35 + Math.random() * 0.25,
      color
    });
  }
}

function spawnObstaclePair() {
  const gapHeight = 148;
  const obstacleWidth = 68;
  const minTopHeight = 50;
  const maxTopHeight = canvas.height - gapHeight - 50;
  const topHeight =
    minTopHeight + Math.random() * (maxTopHeight - minTopHeight);

  const bottomY = topHeight + gapHeight;
  const bottomHeight = canvas.height - bottomY;

  const baseSpeed = 250 + Math.min(180, score * 6);

  obstacles.push({
    x: canvas.width + 20,
    y: 0,
    width: obstacleWidth,
    height: topHeight,
    speed: baseSpeed,
    passed: false,
    label: "BSOD"
  });

  obstacles.push({
    x: canvas.width + 20,
    y: bottomY,
    width: obstacleWidth,
    height: bottomHeight,
    speed: baseSpeed,
    passed: false,
    label: "LOOP"
  });

  // Memoria RAM coleccionable en el centro del hueco
  if (Math.random() < 0.65) {
    collectibles.push({
      x: canvas.width + 20 + obstacleWidth / 2 - 14,
      y: topHeight + gapHeight / 2 - 11,
      width: 28,
      height: 22,
      speed: baseSpeed,
      collected: false
    });
  }
}

// Detección de colisiones AABB (Axis-Aligned Bounding Box)
function checkAABB(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function finishGame() {
  gameState = STATE.GAME_OVER;
  spawnParticles(
    player.x + player.width / 2,
    player.y + player.height / 2,
    PALETTE.rojo,
    22
  );
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(STORAGE_KEY, String(highScore));
  }
}

function update(dt) {
  frameCount++;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  if (gameState !== STATE.PLAYING) {
    if (gameState === STATE.MENU) {
      player.y = canvas.height / 2 - player.height / 2 + Math.sin(frameCount * 0.06) * 8;
    }
    return;
  }

  // Física del jugador
  player.vy = Math.min(player.maxFallSpeed, player.vy + player.gravity * dt);
  player.y += player.vy * dt;

  // Límites superior e inferior del canvas
  if (player.y <= 0 || player.y + player.height >= canvas.height) {
    finishGame();
    return;
  }

  // Generación periódica de obstáculos
  if (frameCount % 95 === 0) {
    spawnObstaclePair();
  }

  // Actualizar obstáculos y detectar colisiones
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= obs.speed * dt;

    if (checkAABB(player, obs)) {
      finishGame();
      return;
    }

    if (!obs.passed && obs.y === 0 && obs.x + obs.width < player.x) {
      obs.passed = true;
      score += 1;
    }

    if (obs.x + obs.width < -50) {
      obstacles.splice(i, 1);
    }
  }

  // Actualizar coleccionables (RAM)
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const item = collectibles[i];
    item.x -= item.speed * dt;

    if (!item.collected && checkAABB(player, item)) {
      item.collected = true;
      score += 2;
      spawnParticles(item.x + item.width / 2, item.y + item.height / 2, PALETTE.amarillo, 12);
      collectibles.splice(i, 1);
      continue;
    }

    if (item.x + item.width < -40) {
      collectibles.splice(i, 1);
    }
  }
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, PALETTE.bordoOscuro);
  grad.addColorStop(1, PALETTE.bordo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(252, 191, 73, 0.08)";
  ctx.lineWidth = 1;
  const gridSize = 40;
  const offset = (frameCount * 1.5) % gridSize;

  for (let x = -offset; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawEscudo(x, y, height) {
  if (escudoCargado) {
    const ratio = escudoImg.width / escudoImg.height;
    const width = height * ratio;
    ctx.drawImage(escudoImg, x + (height - width) / 2, y, width, height);
    return;
  }

  // Respaldo si el escudo aún no terminó de cargar
  ctx.save();
  ctx.translate(x + height / 2, y + height / 2);
  ctx.fillStyle = PALETTE.bordo;
  ctx.strokeStyle = PALETTE.amarillo;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.45);
  ctx.lineTo(height * 0.4, -height * 0.25);
  ctx.lineTo(height * 0.32, height * 0.25);
  ctx.lineTo(0, height * 0.48);
  ctx.lineTo(-height * 0.32, height * 0.25);
  ctx.lineTo(-height * 0.4, -height * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
  const tilt = Math.max(-0.35, Math.min(0.45, player.vy * 0.0008));
  ctx.rotate(tilt);

  ctx.fillStyle = PALETTE.blanco;
  ctx.strokeStyle = PALETTE.amarillo;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-player.width / 2, -player.height / 2, player.width, player.height, 7);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = PALETTE.rojo;
  ctx.fillRect(-6, -8, 18, 12);

  ctx.fillStyle = PALETTE.amarillo;
  for (let px = -14; px <= 10; px += 8) {
    ctx.fillRect(px, -player.height / 2 - 4, 4, 4);
    ctx.fillRect(px, player.height / 2, 4, 4);
  }

  ctx.restore();
}

function drawObstacles() {
  for (const obs of obstacles) {
    ctx.fillStyle = obs.label === "BSOD" ? PALETTE.bsod : PALETTE.rojo;
    ctx.strokeStyle = PALETTE.amarillo;
    ctx.lineWidth = 2.5;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

    if (obs.height >= 36) {
      ctx.fillStyle = PALETTE.blanco;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(obs.label, obs.x + obs.width / 2, obs.y + obs.height / 2 + 4);
    }
  }
}

function drawCollectibles() {
  for (const item of collectibles) {
    ctx.fillStyle = PALETTE.ram;
    ctx.strokeStyle = PALETTE.blanco;
    ctx.lineWidth = 2;
    ctx.fillRect(item.x, item.y, item.width, item.height);
    ctx.strokeRect(item.x, item.y, item.width, item.height);

    ctx.fillStyle = PALETTE.blanco;
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("RAM", item.x + item.width / 2, item.y + item.height / 2 + 3);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  drawEscudo(14, 10, 52);

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.strokeStyle = PALETTE.amarillo;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(74, 14, 235, 42, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = PALETTE.blanco;
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`PUNTAJE: ${score}`, 88, 40);

  ctx.fillStyle = PALETTE.amarillo;
  ctx.textAlign = "right";
  ctx.fillText(`RÉCORD: ${highScore}`, 296, 40);
}

function drawOverlay(title, subtitle, buttonText) {
  ctx.fillStyle = "rgba(20, 4, 9, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = 460;
  const boxH = 264;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  ctx.fillStyle = PALETTE.bordo;
  ctx.strokeStyle = PALETTE.amarillo;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 14);
  ctx.fill();
  ctx.stroke();

  drawEscudo(canvas.width / 2 - 32, boxY + 12, 64);

  ctx.fillStyle = PALETTE.blanco;
  ctx.font = "bold 25px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, canvas.width / 2, boxY + 108);

  ctx.fillStyle = PALETTE.amarillo;
  ctx.font = "16px sans-serif";
  ctx.fillText(subtitle, canvas.width / 2, boxY + 142);

  ctx.fillStyle = PALETTE.rojo;
  ctx.strokeStyle = PALETTE.blanco;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 125, boxY + 178, 250, 44, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = PALETTE.blanco;
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(buttonText, canvas.width / 2, boxY + 206);
}

function render() {
  drawBackground();
  drawObstacles();
  drawCollectibles();
  drawParticles();
  drawPlayer();
  drawHUD();

  if (gameState === STATE.MENU) {
    drawOverlay(
      "COPÉRNICO BUG RUNNER",
      `Esquivá BSOD y Loops · Récord actual: ${highScore}`,
      "JUGAR (ESPACIO / CLIC)"
    );
  } else if (gameState === STATE.GAME_OVER) {
    drawOverlay(
      "¡SISTEMA CAÍDO! (GAME OVER)",
      `Puntaje: ${score}  |  Récord Máximo: ${highScore}`,
      "REINTENTAR"
    );
  }
}

function gameLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// Controles
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    if (!e.repeat) {
      triggerJump();
    }
  }
});

canvas.addEventListener("pointerdown", () => {
  triggerJump();
});

requestAnimationFrame(gameLoop);
