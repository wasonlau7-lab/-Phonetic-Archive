let socket
let typedWord = ""
let currentForms = []
let currentMode = "composition"
let controllerConnected = false
let motionData = { x: 0, y: 0, z: 0, shake: 0 }
let frameBox = { x: 0, y: 0, w: 0, h: 0 }
let finishState = null
let selectedArchiveIndex = -1

const PA_SIZE_SCALE = 0.8

const PA_MONO_COLORS = {
  K: [12, 12, 12],
  X: [8, 8, 10],
  Z: [18, 18, 20],
  T: [28, 28, 30],
  F: [92, 92, 96],
  H: [120, 122, 126],
  L: [150, 152, 156],
  N: [105, 108, 112],
  R: [76, 78, 82],
  I: [246, 246, 242],
  J: [230, 232, 232],
  Y: [238, 238, 232],
  W: [218, 220, 222]
}

const PA_MATERIALS = {
  A: { type: "glass", depth: 0.72, flatness: 0.1 },
  B: { type: "plastic", depth: 0.58, flatness: 0.18 },
  C: { type: "liquid", depth: 0.48, flatness: 0.08 },
  D: { type: "chrome", depth: 0.8, flatness: 0.06 },
  E: { type: "paper", depth: 0.12, flatness: 0.88 },
  F: { type: "fur", depth: 0.34, flatness: 0.28 },
  G: { type: "glass", depth: 0.64, flatness: 0.12 },
  H: { type: "plastic", depth: 0.52, flatness: 0.2 },
  I: { type: "paper", depth: 0.08, flatness: 0.92 },
  J: { type: "liquid", depth: 0.36, flatness: 0.18 },
  K: { type: "chrome", depth: 0.9, flatness: 0.04 },
  L: { type: "paper", depth: 0.1, flatness: 0.9 },
  M: { type: "plastic", depth: 0.68, flatness: 0.12 },
  N: { type: "chrome", depth: 0.62, flatness: 0.16 },
  O: { type: "liquid", depth: 0.5, flatness: 0.1 },
  P: { type: "glass", depth: 0.58, flatness: 0.14 },
  Q: { type: "liquid", depth: 0.55, flatness: 0.1 },
  R: { type: "chrome", depth: 0.74, flatness: 0.08 },
  S: { type: "fur", depth: 0.42, flatness: 0.22 },
  T: { type: "paper", depth: 0.08, flatness: 0.94 },
  U: { type: "plastic", depth: 0.48, flatness: 0.18 },
  V: { type: "glass", depth: 0.6, flatness: 0.1 },
  W: { type: "paper", depth: 0.1, flatness: 0.9 },
  X: { type: "chrome", depth: 0.86, flatness: 0.05 },
  Y: { type: "glass", depth: 0.42, flatness: 0.2 },
  Z: { type: "paper", depth: 0.1, flatness: 0.92 }
}

const PA_WARPS = {
  A: "softArch",
  B: "sharpFold",
  C: "softBulge",
  D: "softBulge",
  E: "sharpShear",
  F: "sharpShear",
  G: "softWave",
  H: "sharpStretch",
  I: "softPinch",
  J: "softDroop",
  K: "sharpSpike",
  L: "sharpShear",
  M: "sharpPeak",
  N: "sharpLean",
  O: "softOrb",
  P: "softBulge",
  Q: "softOrb",
  R: "sharpFold",
  S: "softRibbon",
  T: "sharpStretch",
  U: "softBowl",
  V: "sharpPeak",
  W: "sharpPeak",
  X: "sharpTwist",
  Y: "sharpTwist",
  Z: "sharpZig"
}

function setup() {
  createCanvas(windowWidth, windowHeight)
  pixelDensity(1)
  textFont("Arial")

  if (typeof io !== "undefined") {
    socket = io()

    socket.emit("main-ready", { connected: true })

    socket.on("motion-data", data => {
      motionData = data
    })

    socket.on("controller-status", data => {
      controllerConnected = !!data.connected
    })
  }
}

function draw() {
  background(250, 250, 248)
  updateFrameBox()
  drawAmbientBackground()

  if (currentMode === "archive") {
    drawArchiveView()
  } else if (currentMode === "archive-detail") {
    drawArchiveDetailView()
  } else {
    drawCompositionView()
  }

  updateFinishState()
  drawInterface()
}

function updateFrameBox() {
  frameBox.w = width * 0.72
  frameBox.h = height * 0.58
  frameBox.x = width * 0.5 - frameBox.w * 0.5
  frameBox.y = height * 0.5 - frameBox.h * 0.5 + 20
}

function drawAmbientBackground() {
  push()

  background(252, 252, 249)

  noFill()

  for (let i = 0; i < 18; i++) {
    const a = i / 18
    const ew = lerp(width * 0.2, width * 1.1, a)
    const eh = lerp(height * 0.1, height * 0.76, a)
    stroke(180, 183, 186, lerp(18, 2, a))
    ellipse(width * 0.5, height * 0.44, ew, eh)
  }

  const gap = 64

  for (let x = 0; x <= width; x += gap) {
    stroke(0, 0, 0, 10)
    line(x, 0, x, height)
  }

  for (let y = 0; y <= height; y += gap) {
    stroke(0, 0, 0, 10)
    line(0, y, width, y)
  }

  stroke(0, 0, 0, 22)
  line(32, 104, width - 32, 104)
  line(32, height - 32, width - 32, height - 32)

  stroke(0, 0, 0, 10)
  line(width * 0.5, 32, width * 0.5, height - 32)

  pop()
}

function drawCompositionView() {
  const finishing = !!finishState
  const sourceWord = finishing ? finishState.word : typedWord
  const sourceForms = finishing ? finishState.forms : currentForms
  const stats = getWordStats(sourceWord)

  const frameExpand = finishing ? easeOutCubic(min(1, finishState.progress)) : 0
  const fx = frameBox.x - frameBox.w * 0.03 * frameExpand
  const fy = frameBox.y - frameBox.h * 0.03 * frameExpand
  const fw = frameBox.w * (1 + 0.06 * frameExpand)
  const fh = frameBox.h * (1 + 0.06 * frameExpand)

  push()

  drawCompositionHeader()
  drawPanelShadow(fx, fy, fw, fh, "large")
  drawWordBackgroundPanel(fx, fy, fw, fh, stats, sourceForms, finishing ? 1 : 0.98, true)
  drawWordFrame(fx, fy, fw, fh, true, frameExpand)
  drawWordComposition(sourceForms, fx, fy, fw, fh, true, finishing ? 1.16 : 1.04, frameExpand)

  if (finishing) {
    drawFinishPulse(fx, fy, fw, fh, finishState.progress, stats)
  }

  drawCurrentWordInfo(finishing)

  pop()
}

function drawCompositionHeader() {
  push()

  noStroke()
  fill(28, 29, 31, 255)
  textAlign(LEFT, TOP)
  textSize(18)
  text("PHONETIC ARCHIVE", 32, 30)

  fill(64, 66, 68, 220)
  textSize(10)
  text("LIVE WORD COMPOSITION / MATERIAL PHONETICS", 32, 62)
  text("LETTERS REGISTER AS STRUCTURE, SURFACE, WEIGHT AND SOUND", 32, 80)

  textAlign(RIGHT, TOP)
  fill(62, 64, 66, 220)
  text(`CURRENT TOKEN ${typedWord.length > 0 ? typedWord : "NONE"}`, width - 32, 30)
  text("ENTER TO REGISTER / 8 FULLSCREEN", width - 32, 48)

  stroke(76, 78, 80, 120)
  strokeWeight(1)
  line(32, 104, width - 32, 104)

  stroke(58, 60, 62, 155)
  strokeWeight(1)
  line(32, 112, 260, 112)

  pop()
}

function drawArchiveView() {
  push()

  drawArchiveHeader()

  const layout = getArchiveLayout()
  const entries = getArchiveEntries()

  for (let i = 0; i < entries.length; i++) {
    const pos = getArchiveCardPosition(i, layout)
    drawArchiveCard(entries[i], pos.x, pos.y, pos.w, pos.h, i)
  }

  if (entries.length === 0) {
    drawEmptyArchiveMessage()
  }

  pop()
}

function drawArchiveHeader() {
  push()

  const entries = getArchiveEntries()
  const total = entries.length
  const totalLetters = entries.reduce((sum, item) => sum + item.word.length, 0)
  const totalVowels = entries.reduce((sum, item) => sum + item.vowelCount, 0)
  const totalConsonants = entries.reduce((sum, item) => sum + item.consonantCount, 0)

  noStroke()
  fill(28, 29, 31, 255)
  textAlign(LEFT, TOP)
  textSize(20)
  text("PHONETIC ARCHIVE", 32, 30)

  fill(64, 66, 68, 220)
  textSize(10)
  text("INDEX OF WORD IMAGES / MATERIAL LETTER SYSTEM / CATALOGUE VIEW", 32, 62)

  textAlign(RIGHT, TOP)
  fill(62, 64, 66, 220)
  textSize(10)
  text(`ENTRIES ${nf(total, 2)}`, width - 32, 30)
  text(`LETTERS ${nf(totalLetters, 2)}`, width - 32, 48)
  text(`V ${nf(totalVowels, 2)}  /  C ${nf(totalConsonants, 2)}`, width - 32, 66)

  stroke(76, 78, 80, 120)
  strokeWeight(1)
  line(32, 104, width - 32, 104)

  stroke(58, 60, 62, 155)
  strokeWeight(1)
  line(32, 112, 220, 112)

  fill(70, 72, 74, 220)
  noStroke()
  textAlign(LEFT, TOP)
  textSize(9)
  text("SELECT AN ENTRY TO INSPECT / TYPE NEW LETTERS TO CONTINUE", 32, 118)

  pop()
}

function getArchiveEntries() {
  if (typeof archivedWords !== "undefined" && Array.isArray(archivedWords)) {
    return archivedWords
  }

  if (!window.__paArchivedWords) {
    window.__paArchivedWords = []
  }

  return window.__paArchivedWords
}

function getArchiveLayout() {
  const margin = 32
  const top = 150
  const gapX = 22
  const gapY = 82
  const minCard = 230
  const maxCard = 330
  const cols = max(1, floor((width - margin * 2 + gapX) / minCard))
  const cardW = constrain((width - margin * 2 - gapX * (cols - 1)) / cols, 190, maxCard)
  const cardH = cardW * 0.62

  return { margin, top, gapX, gapY, cols, cardW, cardH }
}

function getArchiveCardPosition(i, layout) {
  const col = i % layout.cols
  const row = floor(i / layout.cols)
  const stagger = row % 2 === 1 ? layout.cardW * 0.08 : 0
  const x = layout.margin + col * (layout.cardW + layout.gapX) + stagger
  const y = layout.top + row * (layout.cardH + layout.gapY)

  return { x, y, w: layout.cardW, h: layout.cardH }
}

function drawArchiveCard(item, x, y, w, h, index) {
  const over = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h
  const scaleFactor = over ? 1.012 : 1
  const shiftY = over ? -3 : 0
  const cx = x + w * 0.5
  const cy = y + h * 0.5
  const stats = getArchiveItemStats(item)

  push()
  translate(cx, cy + shiftY)
  scale(scaleFactor)
  translate(-cx, -cy)

  drawPanelShadow(x, y, w, h, "small")
  drawWordBackgroundPanel(x, y, w, h, stats, item.forms, over ? 0.92 : 0.72, false)

  noFill()
  stroke(over ? color(30, 32, 34, 155) : color(76, 78, 80, 105))
  strokeWeight(1)
  rect(x, y, w, h)

  stroke(38, 40, 42, over ? 160 : 115)
  line(x, y, x + w * 0.18, y)
  line(x, y, x, y + h * 0.16)

  stroke(66, 70, 74, over ? 150 : 110)
  line(x + w * 0.82, y + h, x + w, y + h)
  line(x + w, y + h * 0.84, x + w, y + h)

  stroke(88, 90, 92, over ? 80 : 55)
  line(x + w * 0.5, y, x + w * 0.5, y + h)
  line(x, y + h * 0.5, x + w, y + h * 0.5)

  drawWordComposition(item.forms, x, y, w, h, false, over ? 1.02 : 0.82, 0)
  drawArchiveCardMeta(item, x, y, w, h, index, over, stats)

  pop()
}

function drawArchiveCardMeta(item, x, y, w, h, index, over, stats) {
  push()

  const metaY = y + h + 12

  noStroke()
  fill(over ? 18 : 42)
  textAlign(LEFT, TOP)
  textSize(10)
  text(`[${nf(index + 1, 3)}]`, x, metaY)

  fill(over ? 20 : 48)
  text(item.word, x + 42, metaY)

  fill(76, 78, 80, over ? 240 : 210)
  textSize(8)
  text(`LEN ${item.word.length}`, x, metaY + 18)
  text(`VOWEL ${nf(stats.vowelRatio, 1, 2)}`, x + 56, metaY + 18)
  text(`DENSITY ${nf(stats.hardness, 1, 2)}`, x + 130, metaY + 18)

  const barY = metaY + 34
  const barW = w
  const barH = 2

  fill(80, 82, 84, 90)
  rect(x, barY, barW, barH)

  fill(36, 38, 40, over ? 180 : 130)
  rect(x, barY, barW * stats.vowelRatio, barH)

  fill(96, 100, 104, over ? 175 : 130)
  rect(x + barW * stats.vowelRatio, barY, barW * (1 - stats.vowelRatio), barH)

  if (over) {
    fill(30, 32, 34, 220)
    textAlign(RIGHT, TOP)
    text("OPEN", x + w, metaY)
  }

  pop()
}

function drawEmptyArchiveMessage() {
  push()

  noStroke()
  fill(36, 38, 42, 180)
  textAlign(CENTER, CENTER)
  textSize(14)
  text("ARCHIVE EMPTY", width * 0.5, height * 0.5)

  fill(70, 72, 74, 190)
  textSize(10)
  text("TYPE A WORD AND PRESS ENTER TO REGISTER THE FIRST ENTRY", width * 0.5, height * 0.54)

  pop()
}

function drawArchiveDetailView() {
  const entries = getArchiveEntries()

  if (selectedArchiveIndex < 0 || selectedArchiveIndex >= entries.length) {
    currentMode = "archive"
    return
  }

  const item = entries[selectedArchiveIndex]
  const stats = getArchiveItemStats(item)
  const x = width * 0.12
  const y = height * 0.18
  const w = width * 0.76
  const h = height * 0.58

  push()

  noStroke()
  fill(28, 29, 31, 255)
  textAlign(LEFT, TOP)
  textSize(18)
  text(`[${nf(selectedArchiveIndex + 1, 3)}] ${item.word}`, 32, 30)

  fill(64, 66, 68, 220)
  textSize(10)
  text("DETAIL VIEW / PRESS ESC TO RETURN TO INDEX", 32, 60)

  drawPanelShadow(x, y, w, h, "large")
  drawWordBackgroundPanel(x, y, w, h, stats, item.forms, 1, false)
  drawWordFrame(x, y, w, h, true, 0.28)
  drawWordComposition(item.forms, x, y, w, h, false, 1.08, 0)
  drawArchiveDetailMeta(item, stats, x, y + h + 30, w)

  pop()
}

function drawArchiveDetailMeta(item, stats, x, y, w) {
  push()

  noStroke()
  fill(70, 72, 74, 220)
  textAlign(LEFT, TOP)
  textSize(10)

  text(`TOKEN ${item.word}`, x, y)
  text(`LENGTH ${item.word.length}`, x + 180, y)
  text(`VOWELS ${item.vowelCount}`, x + 320, y)
  text(`CONSONANTS ${item.consonantCount}`, x + 450, y)
  text(`DENSITY ${nf(stats.hardness, 1, 2)}`, x + 620, y)

  const barY = y + 28

  fill(80, 82, 84, 90)
  rect(x, barY, w, 3)

  fill(34, 36, 38, 160)
  rect(x, barY, w * stats.vowelRatio, 3)

  fill(98, 102, 106, 150)
  rect(x + w * stats.vowelRatio, barY, w * (1 - stats.vowelRatio), 3)

  fill(74, 76, 78, 180)
  text("VOCAL MASS", x, barY + 16)

  textAlign(RIGHT, TOP)
  text("CONSONANT STRUCTURE", x + w, barY + 16)

  pop()
}

function getArchiveItemStats(item) {
  const len = max(1, item.word.length)
  const vowelRatio = item.vowelCount / len
  const consonantRatio = item.consonantCount / len
  const voicelessCount = item.forms.filter(form => {
    const profile = getProfile(form.base)
    return profile && profile.phonetic === "voiceless"
  }).length
  const uppercaseCount = item.forms.filter(form => form.uppercase).length
  const hardness = constrain((voicelessCount + item.consonantCount * 0.45 + uppercaseCount * 0.2) / len, 0, 1)

  return {
    vowelRatio,
    consonantRatio,
    hardness,
    total: len,
    vowelCount: item.vowelCount,
    consonantCount: item.consonantCount
  }
}

function drawPanelShadow(x, y, w, h, scaleType) {
  push()

  drawingContext.save()

  const offset = scaleType === "large" ? 5 : 3
  const blur = scaleType === "large" ? 28 : 18
  const alpha = scaleType === "large" ? 0.50 : 0.40

  drawingContext.shadowOffsetX = offset
  drawingContext.shadowOffsetY = offset
  drawingContext.shadowBlur = blur
  drawingContext.shadowColor = `rgba(120, 124, 128, ${alpha})`

  noStroke()
  fill(255, 255, 255, 255)
  rect(x, y, w, h)

  drawingContext.restore()

  pop()
}

function drawWordFrame(x, y, w, h, active, amp) {
  push()

  noFill()
  stroke(active ? color(15, 16, 18, 95) : color(0, 0, 0, 40))
  strokeWeight(1)
  rect(x, y, w, h)

  stroke(0, 0, 0, active ? 60 + 20 * amp : 22)
  line(x, y, x + w, y + h)

  stroke(100, 106, 112, active ? 62 + 14 * amp : 26)
  line(x + w, y, x, y + h)

  stroke(0, 0, 0, active ? 20 : 10)
  line(x, y + h * 0.5, x + w, y + h * 0.5)
  line(x + w * 0.5, y, x + w * 0.5, y + h)

  stroke(0, 0, 0, active ? 90 : 40)
  line(x, y, x + w * 0.18, y)

  stroke(95, 100, 105, active ? 78 : 32)
  line(x + w * 0.82, y + h, x + w, y + h)

  pop()
}

function drawWordBackgroundPanel(x, y, w, h, stats, forms, emphasis, animated) {
  push()

  drawingContext.save()
  drawingContext.beginPath()
  drawingContext.rect(x, y, w, h)
  drawingContext.clip()

  noStroke()
  fill(250, 250, 247)
  rect(x, y, w, h)

  const ratio = stats.total > 0 ? stats.vowelCount / stats.total : 0

  for (let i = 0; i < 64; i++) {
    const k = i / 63
    const c = mixColor([255, 255, 252], mixColor([244, 243, 239], [240, 244, 250], ratio), k)
    fill(c[0], c[1], c[2], 255)
    rect(x, y + h * k, w, h / 63 + 1)
  }

  drawDynamicBlobs(x, y, w, h, forms, emphasis, animated)

  fill(255, 255, 255, 2 * emphasis)
  rect(x, y, w, h)

  drawFrostedGrain(x, y, w, h, emphasis)

  drawingContext.restore()

  pop()
}

function drawDynamicBlobs(x, y, w, h, forms, emphasis, animated) {
  push()

  const activeForms = forms && forms.length > 0 ? forms : []
  const t = frameCount * 0.012
  const palette = getStableBlobPalette(activeForms)
  const baseD = min(w, h)

  drawingContext.filter = `blur(${max(22, baseD * 0.055)}px)`

  const layout = [
    { x: -0.06, y: 0.18, d: 0.58, r: -0.6, p: 0.1 },
    { x: 0.16, y: -0.04, d: 0.54, r: 0.2, p: 0.8 },
    { x: 0.43, y: 0.12, d: 0.68, r: 0.35, p: 1.4 },
    { x: 0.72, y: 0.16, d: 0.6, r: -0.35, p: 2.7 },
    { x: 1.04, y: 0.22, d: 0.64, r: 0.42, p: 3.0 },
    { x: 0.02, y: 0.48, d: 0.7, r: 0.42, p: 3.2 },
    { x: 0.28, y: 0.48, d: 0.74, r: -0.22, p: 4.1 },
    { x: 0.56, y: 0.52, d: 0.8, r: 0.18, p: 4.8 },
    { x: 0.84, y: 0.52, d: 0.68, r: 0.62, p: 5.3 },
    { x: 1.08, y: 0.58, d: 0.72, r: -0.3, p: 5.8 },
    { x: -0.08, y: 0.82, d: 0.62, r: -0.18, p: 6.0 },
    { x: 0.18, y: 0.96, d: 0.58, r: 0.3, p: 6.5 },
    { x: 0.44, y: 0.84, d: 0.66, r: 0.18, p: 7.1 },
    { x: 0.72, y: 0.9, d: 0.72, r: -0.42, p: 8.4 },
    { x: 0.98, y: 0.86, d: 0.66, r: 0.16, p: 9.2 },
    { x: 0.62, y: 1.08, d: 0.62, r: -0.2, p: 10.1 }
  ]

  for (let i = 0; i < layout.length; i++) {
    const item = layout[i]
    const c = palette[i % palette.length]
    const strength = activeForms.length > 0 ? 1 : 0.72
    const moveX = animated ? sin(t * 0.72 + item.p) * w * 0.055 : sin(item.p) * w * 0.012
    const moveY = animated ? cos(t * 0.64 + item.p * 1.2) * h * 0.065 : cos(item.p) * h * 0.012
    const pulse = animated ? 1 + 0.08 * sin(t * 0.8 + item.p) : 1
    const px = x + w * item.x + moveX
    const py = y + h * item.y + moveY
    const d = baseD * item.d * pulse
    const alphaCore = (activeForms.length > 0 ? 255 : 205) * emphasis * strength
    const alphaMid = (activeForms.length > 0 ? 218 : 165) * emphasis * strength
    const alphaEdge = (activeForms.length > 0 ? 74 : 48) * emphasis * strength

    drawEditorialBlob(
      px,
      py,
      d,
      item.r + (animated ? sin(t * 0.4 + item.p) * 0.06 : 0),
      c,
      alphaCore,
      alphaMid,
      alphaEdge
    )

    const c2 = addColor(c, 46)

    drawEditorialBlob(
      px + d * 0.16,
      py - d * 0.14,
      d * 0.58,
      item.r * -0.52,
      c2,
      alphaCore * 0.88,
      alphaMid * 0.5,
      alphaEdge * 0.16
    )
  }

  drawingContext.filter = `blur(${max(8, baseD * 0.018)}px)`

  const edgeBlobs = [
    { x: -0.1, y: 0.12, d: 0.38, p: 0.4 },
    { x: -0.08, y: 0.36, d: 0.3, p: 1.2 },
    { x: -0.06, y: 0.68, d: 0.44, p: 2.1 },
    { x: -0.12, y: 0.94, d: 0.34, p: 3.3 },
    { x: 1.08, y: 0.16, d: 0.42, p: 4.1 },
    { x: 1.1, y: 0.42, d: 0.32, p: 5.0 },
    { x: 1.06, y: 0.72, d: 0.46, p: 6.2 },
    { x: 1.12, y: 0.92, d: 0.36, p: 7.1 },
    { x: 0.12, y: -0.1, d: 0.34, p: 8.0 },
    { x: 0.38, y: -0.08, d: 0.42, p: 9.1 },
    { x: 0.68, y: -0.1, d: 0.36, p: 10.4 },
    { x: 0.9, y: -0.08, d: 0.32, p: 11.2 },
    { x: 0.16, y: 1.08, d: 0.38, p: 12.1 },
    { x: 0.44, y: 1.1, d: 0.46, p: 13.2 },
    { x: 0.72, y: 1.08, d: 0.4, p: 14.5 },
    { x: 0.94, y: 1.12, d: 0.34, p: 15.4 }
  ]

  for (let i = 0; i < edgeBlobs.length; i++) {
    const item = edgeBlobs[i]
    const c = addColor(palette[(i + 2) % palette.length], 22)
    const driftX = animated ? sin(t * 0.65 + item.p) * w * 0.022 : 0
    const driftY = animated ? cos(t * 0.58 + item.p * 1.3) * h * 0.022 : 0
    const pulse = animated ? 1 + sin(t * 0.72 + item.p) * 0.06 : 1
    const px = x + w * item.x + driftX
    const py = y + h * item.y + driftY
    const d = baseD * item.d * pulse

    fill(c[0], c[1], c[2], (activeForms.length > 0 ? 26 : 17) * emphasis)
    ellipse(px, py, d, d)
  }

  drawingContext.filter = "none"

  pop()
}

function drawEditorialBlob(px, py, d, ang, c, alphaCore, alphaMid, alphaEdge) {
  push()

  translate(px, py)
  rotate(ang)
  noStroke()

  const center = addColor(c, 48)
  const core = [
    constrain(center[0] * 1.18, 0, 255),
    constrain(center[1] * 1.18, 0, 255),
    constrain(center[2] * 1.18, 0, 255)
  ]

  const g = drawingContext.createRadialGradient(0, 0, d * 0.01, 0, 0, d * 0.55)
  g.addColorStop(0, rgbaString(core[0], core[1], core[2], alphaCore))
  g.addColorStop(0.18, rgbaString(core[0], core[1], core[2], alphaCore * 0.98))
  g.addColorStop(0.38, rgbaString(c[0], c[1], c[2], alphaMid))
  g.addColorStop(0.7, rgbaString(c[0], c[1], c[2], alphaEdge))
  g.addColorStop(1, rgbaString(c[0], c[1], c[2], 0))

  drawingContext.fillStyle = g
  ellipse(0, 0, d, d)

  const g2 = drawingContext.createRadialGradient(-d * 0.08, -d * 0.08, 0, -d * 0.08, -d * 0.08, d * 0.22)
  g2.addColorStop(0, rgbaString(255, 255, 255, alphaCore * 0.24))
  g2.addColorStop(0.42, rgbaString(core[0], core[1], core[2], alphaMid * 0.5))
  g2.addColorStop(1, rgbaString(core[0], core[1], core[2], 0))

  drawingContext.fillStyle = g2
  ellipse(-d * 0.08, -d * 0.08, d * 0.38, d * 0.38)

  pop()
}

function drawFrostedGrain(x, y, w, h, emphasis) {
  push()

  noStroke()

  const count = floor(map(w * h, 30000, 500000, 110, 620, true))
  const t = frameCount * 0.004

  for (let i = 0; i < count; i++) {
    const px = x + noise(i * 0.071, t + i * 0.003) * w
    const py = y + noise(i * 0.083 + 100, t + i * 0.002) * h
    const r = 0.6 + noise(i * 0.051 + 200, t) * 1.1
    const a = (4 + noise(i * 0.09 + 300, t) * 11) * emphasis

    if (i % 3 === 0) {
      fill(0, 0, 0, a * 0.18)
    } else {
      fill(255, 255, 255, a)
    }

    rect(px, py, r, r)
  }

  stroke(255, 255, 255, 12 * emphasis)
  strokeWeight(1)

  for (let i = 0; i < 18; i++) {
    const yy = y + (i / 17) * h + sin(t * 8 + i) * 2
    line(x, yy, x + w, yy + sin(t * 6 + i * 1.2) * 1.5)
  }

  stroke(0, 0, 0, 4 * emphasis)

  for (let i = 0; i < 7; i++) {
    const xx = x + (i / 6) * w + cos(t * 7 + i) * 1.5
    line(xx, y, xx + sin(t * 5 + i) * 2, y + h)
  }

  pop()
}

function drawWordComposition(forms, x, y, w, h, active, intensity, finishAmp) {
  push()

  drawingContext.save()
  drawingContext.beginPath()
  drawingContext.rect(x, y, w, h)
  drawingContext.clip()

  const cx = x + w * 0.5
  const cy = y + h * 0.5
  const shake = active ? constrain(motionData.shake, 0, 8) : 0
  const offsetX = active ? map(motionData.x, -10, 10, -22, 22, true) : 0
  const offsetY = active ? map(motionData.y, -10, 10, -22, 22, true) : 0

  translate(offsetX + random(-shake, shake), offsetY + random(-shake, shake))

  for (let i = 0; i < forms.length; i++) {
    drawLetterForm(forms[i], cx, cy, w, h, active, intensity, finishAmp)
  }

  drawingContext.restore()

  pop()
}

function drawLetterForm(form, cx, cy, fw, fh, active, intensity, finishAmp) {
  const profile = getProfile(form.base)
  if (!profile) return

  const material = getMaterialStyle(form.base)
  const px = cx + form.nx * fw
  const py = cy + form.ny * fh
  const mainSpan = form.spanRatio * min(fw, fh) * PA_SIZE_SCALE
  const drift = active ? sin(frameCount * 0.018 + form.phase) * form.motion : 0
  const rot = form.rotation + form.extraRotation + drift * 0.06 + sin(frameCount * 0.014 + form.phase * 1.5) * 0.16
  const baseWeight = form.uppercase ? mainSpan * 0.082 : mainSpan * 0.05
  const weight = baseWeight * lerp(1.12, 0.82, material.flatness)
  const edgeWeight = form.uppercase ? mainSpan * 0.018 : mainSpan * 0.012
  const alpha = form.uppercase ? 226 : 184
  const c = getLetterPalette(profile, form)
  const darker = scaleColor(c, 0.38)
  const darker2 = scaleColor(c, 0.22)
  const lighter = addColor(c, 58)
  const glowBoost = finishAmp > 0 ? 1 + easeOutCubic(min(1, finishAmp)) * 0.8 : 1
  const scaleBoost = finishAmp > 0 ? 1 + 0.12 * easeOutCubic(min(1, finishAmp)) : 1
  const warpX = sin(frameCount * 0.03 + form.phase * 1.4 + form.order) * mainSpan * 0.12
  const warpY = cos(frameCount * 0.025 + form.phase * 1.1 + form.order * 0.7) * mainSpan * 0.1
  const stretchX = (1 + sin(frameCount * 0.018 + form.phase * 1.7) * 0.22) * form.scaleX
  const stretchY = (1 + cos(frameCount * 0.016 + form.phase * 1.3) * 0.2) * form.scaleY

  push()
  translate(px + warpX, py + warpY)
  rotate(rot)
  applyWarpStyle(getWarpStyle(form), mainSpan, form, active)
  scale(scaleBoost * stretchX, scaleBoost * stretchY)

  drawLetterAura(profile, mainSpan, c, alpha, intensity, glowBoost, form)
  drawMaterialField(profile, mainSpan, form, c, intensity, material)
  drawAbstractMass(profile, mainSpan, form, c, intensity * (1 - material.flatness * 0.45))
  drawBandGlitch(profile, mainSpan, form, c, intensity)
  drawBrokenContour(profile, mainSpan, form, c, intensity)

  const extrusionLayers = floor(lerp(1, 7, material.depth))

  for (let i = extrusionLayers; i >= 1; i--) {
    const dx = i * mainSpan * 0.024 * material.depth
    const dy = i * mainSpan * 0.032 * material.depth
    push()
    translate(dx, dy)
    noFill()
    stroke(darker2[0], darker2[1], darker2[2], (10 + i * 9) * intensity * material.depth)
    strokeWeight(weight + i * mainSpan * 0.012 * material.depth)
    strokeCap(ROUND)
    strokeJoin(ROUND)
    drawGlyph(profile.shape, mainSpan * (1 + i * 0.018 + form.innerScale), form)
    pop()
  }

  drawingContext.shadowBlur = lerp(4, form.uppercase ? 42 : 28, 1 - material.flatness) * glowBoost
  drawingContext.shadowColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.26 * intensity * (1 - material.flatness * 0.5)})`

  noFill()
  stroke(darker[0], darker[1], darker[2], 76 * intensity)
  strokeWeight(weight * lerp(1.18, 1.48, material.depth))
  strokeCap(ROUND)
  strokeJoin(ROUND)
  drawGlyph(profile.shape, mainSpan * (1.08 + form.innerScale * 0.5), form)

  stroke(c[0], c[1], c[2], alpha * intensity)
  strokeWeight(weight)
  drawGlyph(profile.shape, mainSpan * (1 + form.innerScale), form)

  drawingContext.shadowBlur = 0

  drawMaterialSurface(profile, mainSpan, form, c, intensity, material)

  stroke(lighter[0], lighter[1], lighter[2], 86 * intensity)
  strokeWeight(edgeWeight)
  drawGlyph(profile.shape, mainSpan * (0.96 + form.innerScale * 0.35), form)

  drawGlitchShards(profile, mainSpan, form, c, intensity)
  drawChromeHighlight(profile, mainSpan, form, c, intensity)
  drawAccentCuts(profile, mainSpan, form, c, intensity)
  drawAbstractFragments(profile, mainSpan, form, c, intensity)
  drawLetterSignature(profile, mainSpan, form, c, intensity)
  drawSignalNoiseMarks(profile, mainSpan, form, c, intensity)

  pop()
}

function applyWarpStyle(style, s, form, active) {
  const t = frameCount * 0.018 + form.phase
  const d = form.distort || 1

  applyMatrix(1, form.shearY * 0.36, form.shearX * 0.42, 1, 0, 0)

  if (style === "softArch") {
    scale(1.18 * d, 0.78 + 0.1 * d)
    applyMatrix(1, 0.04 * d, 0.24 + sin(t) * 0.12 * d, 1, 0, 0)
    rotate(sin(t * 0.7) * 0.12 * d)
  }

  if (style === "softBulge") {
    scale(1.26 * d, 0.74 + 0.12 * d)
    applyMatrix(1, 0.1 * d, 0.2 * d, 1, 0, 0)
    rotate(cos(t) * 0.08 * d)
  }

  if (style === "softWave") {
    applyMatrix(1, 0.16 * sin(t) * d, 0.22 * cos(t * 0.7) * d, 1, 0, 0)
    scale(1.22 * d, 0.78 + 0.1 * d)
    rotate(sin(t * 1.2) * 0.08 * d)
  }

  if (style === "softPinch") {
    scale(0.72 + 0.12 * d, 1.28 * d)
    rotate(sin(t) * 0.12 * d)
    applyMatrix(1, -0.06 * d, 0.16 * d, 1, 0, 0)
  }

  if (style === "softDroop") {
    applyMatrix(1, 0, -0.22 * d, 1, 0, 0)
    rotate(0.18 + sin(t) * 0.08 * d)
    scale(0.88 + 0.1 * d, 1.18 * d)
  }

  if (style === "softOrb") {
    scale(1.28 * d, 0.68 + 0.1 * d)
    rotate(sin(t * 0.9) * 0.09 * d)
    applyMatrix(1, 0.08 * d, 0.12 * d, 1, 0, 0)
  }

  if (style === "softRibbon") {
    applyMatrix(1, 0.18 * sin(t) * d, 0.26 * cos(t * 0.9) * d, 1, 0, 0)
    scale(1.22 * d, 0.72 + 0.08 * d)
    rotate(0.08 * sin(t * 0.5) * d)
  }

  if (style === "softBowl") {
    scale(1.18 * d, 0.7 + 0.12 * d)
    applyMatrix(1, 0, -0.18 * d, 1, 0, 0)
    rotate(-0.06 * d)
  }

  if (style === "sharpShear") {
    applyMatrix(1, 0, 0.42 * d, 1, 0, 0)
    scale(1.22 * d, 0.88 + 0.08 * d)
    rotate(0.08 * d)
  }

  if (style === "sharpStretch") {
    scale(1.44 * d, 0.62 + 0.12 * d)
    rotate(-0.12 * d)
    applyMatrix(1, 0.08 * d, 0.2 * d, 1, 0, 0)
  }

  if (style === "sharpSpike") {
    applyMatrix(1, 0.12 * d, 0.46 * d, 1, 0, 0)
    rotate(0.22 * d)
    scale(1.28 * d, 0.78 + 0.1 * d)
  }

  if (style === "sharpPeak") {
    scale(0.92 + 0.08 * d, 1.38 * d)
    applyMatrix(1, 0, -0.32 * d, 1, 0, 0)
    rotate(-0.14 * d)
  }

  if (style === "sharpLean") {
    applyMatrix(1, 0, 0.34 * d, 1, 0, 0)
    rotate(-0.16 * d)
    scale(1.12 * d, 0.92 + 0.08 * d)
  }

  if (style === "sharpFold") {
    applyMatrix(1, 0.14 * d, 0.36 * d, 1, 0, 0)
    scale(1.18 * d, 0.82 + 0.08 * d)
    rotate(0.14 * d)
  }

  if (style === "sharpTwist") {
    applyMatrix(1, 0.22 * sin(t) * d, 0.42 * d, 1, 0, 0)
    rotate(0.32 * sin(t * 0.9) * d)
    scale(1.18 * d, 0.74 + 0.12 * d)
  }

  if (style === "sharpZig") {
    applyMatrix(1, 0, 0.5 * d, 1, 0, 0)
    scale(1.24 * d, 0.68 + 0.12 * d)
    rotate(-0.18 * d)
  }
}

function drawMaterialField(profile, s, form, c, intensity, material) {
  push()

  if (material.type === "glass") {
    noFill()
    stroke(255, 255, 255, 26 * intensity)
    strokeWeight(max(1, s * 0.018))
    ellipse(0, 0, s * 0.9, s * 0.34)
    stroke(c[0], c[1], c[2], 14 * intensity)
    strokeWeight(max(1, s * 0.05))
    drawGlyph(profile.shape, s * 1.06, form)
  }

  if (material.type === "plastic") {
    noStroke()
    fill(c[0], c[1], c[2], 16 * intensity)
    rectMode(CENTER)
    rect(0, 0, s * 0.58, s * 0.78, s * 0.08)
    fill(255, 255, 255, 10 * intensity)
    rect(s * 0.05, -s * 0.14, s * 0.38, s * 0.08, s * 0.03)
  }

  if (material.type === "fur") {
    stroke(c[0], c[1], c[2], 22 * intensity)
    strokeWeight(max(1, s * 0.006))

    for (let i = 0; i < 34; i++) {
      const a = form.phase + i * 0.73
      const r1 = s * (0.18 + noise(i * 0.21, frameCount * 0.01) * 0.24)
      const r2 = r1 + s * (0.06 + noise(i * 0.17 + 3) * 0.08)
      line(cos(a) * r1, sin(a) * r1 * 0.65, cos(a) * r2, sin(a) * r2 * 0.68)
    }
  }

  if (material.type === "liquid") {
    noStroke()
    fill(c[0], c[1], c[2], 20 * intensity)
    beginShape()

    for (let i = 0; i < 20; i++) {
      const a = TWO_PI * i / 20
      const r = s * (0.26 + 0.08 * sin(frameCount * 0.025 + form.phase + i * 1.4))
      curveVertex(cos(a) * r, sin(a) * r * 0.58)
    }

    endShape(CLOSE)
    fill(255, 255, 255, 18 * intensity)
    ellipse(-s * 0.12, -s * 0.1, s * 0.18, s * 0.06)
  }

  if (material.type === "chrome") {
    noFill()
    stroke(255, 255, 255, 24 * intensity)
    strokeWeight(max(1, s * 0.016))
    line(-s * 0.38, -s * 0.2, s * 0.36, -s * 0.3)
    stroke(0, 0, 0, 18 * intensity)
    line(-s * 0.3, s * 0.24, s * 0.36, s * 0.16)
  }

  if (material.type === "paper") {
    noStroke()
    fill(c[0], c[1], c[2], 10 * intensity)
    rectMode(CENTER)
    rect(0, 0, s * 0.86, s * 0.48)
    stroke(0, 0, 0, 8 * intensity)
    strokeWeight(max(1, s * 0.004))

    for (let i = -3; i <= 3; i++) {
      line(-s * 0.42, i * s * 0.06, s * 0.42, i * s * 0.06)
    }
  }

  pop()
}

function drawMaterialSurface(profile, s, form, c, intensity, material) {
  push()

  if (material.type === "glass") {
    noFill()
    stroke(255, 255, 255, 90 * intensity)
    strokeWeight(max(1, s * 0.012))
    line(-s * 0.28, -s * 0.28, s * 0.22, -s * 0.36)
    stroke(255, 255, 255, 34 * intensity)
    strokeWeight(max(1, s * 0.006))
    ellipse(-s * 0.1, -s * 0.06, s * 0.42, s * 0.12)
    stroke(180, 230, 255, 42 * intensity)
    strokeWeight(max(1, s * 0.008))
    drawGlyph(profile.shape, s * 0.96, form)
  }

  if (material.type === "plastic") {
    stroke(255, 255, 255, 54 * intensity)
    strokeWeight(max(1, s * 0.014))
    line(-s * 0.28, -s * 0.22, s * 0.18, -s * 0.26)
    stroke(0, 0, 0, 20 * intensity)
    strokeWeight(max(1, s * 0.007))
    line(-s * 0.22, s * 0.22, s * 0.28, s * 0.2)
  }

  if (material.type === "fur") {
    stroke(255, 255, 255, 20 * intensity)
    strokeWeight(max(1, s * 0.005))

    for (let i = 0; i < 22; i++) {
      const a = form.phase + i * 0.57
      const r = s * (0.22 + noise(i * 0.12, frameCount * 0.012) * 0.32)
      line(cos(a) * r, sin(a) * r * 0.62, cos(a) * (r + s * 0.045), sin(a) * (r + s * 0.045) * 0.62)
    }
  }

  if (material.type === "liquid") {
    stroke(255, 255, 255, 48 * intensity)
    strokeWeight(max(1, s * 0.014))
    arc(-s * 0.08, -s * 0.06, s * 0.4, s * 0.16, radians(190), radians(330))
    noStroke()
    fill(255, 255, 255, 34 * intensity)
    ellipse(s * 0.18, -s * 0.16, s * 0.08, s * 0.04)
    fill(c[0], c[1], c[2], 26 * intensity)
    ellipse(-s * 0.22, s * 0.2, s * 0.12, s * 0.08)
  }

  if (material.type === "chrome") {
    stroke(255, 255, 255, 68 * intensity)
    strokeWeight(max(1, s * 0.016))
    line(-s * 0.34, -s * 0.34, s * 0.32, -s * 0.22)
    stroke(20, 20, 22, 52 * intensity)
    strokeWeight(max(1, s * 0.012))
    line(-s * 0.28, s * 0.3, s * 0.34, s * 0.2)
    stroke(180, 185, 190, 42 * intensity)
    strokeWeight(max(1, s * 0.006))
    line(-s * 0.22, -s * 0.02, s * 0.26, -s * 0.08)
  }

  if (material.type === "paper") {
    stroke(0, 0, 0, 28 * intensity)
    strokeWeight(max(1, s * 0.006))
    drawingContext.setLineDash([s * 0.028, s * 0.024])
    drawGlyph(profile.shape, s * 1.02, form)
    drawingContext.setLineDash([])
    stroke(255, 255, 255, 24 * intensity)
    strokeWeight(max(1, s * 0.005))
    line(-s * 0.26, -s * 0.18, s * 0.24, -s * 0.12)
  }

  pop()
}

function drawBandGlitch(profile, s, form, c, intensity) {
  const glitchBoost = profile.phonetic === "voiceless" ? 1.2 : 1
  const bandCount = 5

  for (let i = 0; i < bandCount; i++) {
    const bandY = -s * 0.48 + i * s * 0.22 + sin(frameCount * 0.05 + form.phase + i * 1.4) * s * 0.04
    const bandH = s * (0.1 + 0.02 * sin(form.phase * 2.1 + i))
    const shift = sin(frameCount * 0.08 + form.phase * 1.6 + i * 2.2) * s * 0.08 * glitchBoost
    const scaleJitter = 1 + sin(frameCount * 0.045 + form.phase + i) * 0.03

    push()
    drawingContext.save()
    drawingContext.beginPath()
    drawingContext.rect(-s, bandY, s * 2, bandH)
    drawingContext.clip()

    translate(shift, 0)
    noFill()
    stroke(c[0], c[1], c[2], 24 * intensity)
    strokeWeight(max(1, s * 0.02))
    drawGlyph(profile.shape, s * scaleJitter, form)

    translate(-shift * 0.58, 0)
    stroke(0, 230, 255, 18 * intensity)
    strokeWeight(max(1, s * 0.012))
    drawGlyph(profile.shape, s * 0.99, form)

    translate(shift * 1.12, 0)
    stroke(255, 0, 160, 15 * intensity)
    strokeWeight(max(1, s * 0.01))
    drawGlyph(profile.shape, s * 1.01, form)

    drawingContext.restore()
    pop()
  }
}

function drawBrokenContour(profile, s, form, c, intensity) {
  push()
  noFill()
  stroke(250, 252, 255, 24 * intensity)
  strokeWeight(max(1, s * 0.008))
  drawingContext.setLineDash([s * 0.06, s * 0.03])
  drawGlyph(profile.shape, s * 1.08, form)
  drawingContext.setLineDash([])
  pop()
}

function drawGlitchShards(profile, s, form, c, intensity) {
  push()
  noStroke()
  rectMode(CENTER)

  const t = frameCount * 0.04 + form.phase * 3

  for (let i = 0; i < 8; i++) {
    const px = sin(t + i * 1.7) * s * 0.42
    const py = cos(t * 0.8 + i * 1.2) * s * 0.34
    const rw = s * (0.06 + 0.04 * abs(sin(t + i)))
    const rh = s * (0.008 + 0.012 * abs(cos(t + i * 0.5)))
    const rr = sin(t + i * 2.3) * 0.7

    push()
    translate(px, py)
    rotate(rr)
    fill(c[0], c[1], c[2], 20 * intensity)
    rect(0, 0, rw, rh)
    fill(255, 255, 255, 10 * intensity)
    rect(rw * 0.1, -rh * 0.8, rw * 0.4, rh * 0.6)
    pop()
  }

  pop()
}

function drawSignalNoiseMarks(profile, s, form, c, intensity) {
  push()
  noStroke()
  rectMode(CENTER)

  for (let i = 0; i < 10; i++) {
    const px = sin(form.phase * 1.5 + i * 1.37 + frameCount * 0.012) * s * 0.5
    const py = cos(form.phase * 1.2 + i * 0.88 + frameCount * 0.016) * s * 0.38
    const rw = s * (0.04 + 0.03 * abs(sin(i + form.phase)))
    const rh = s * (0.005 + 0.006 * abs(cos(i * 0.7 + form.phase)))

    fill(255, 255, 255, 16 * intensity)
    rect(px, py, rw, rh)

    fill(c[0], c[1], c[2], 14 * intensity)
    rect(px + rw * 0.22, py + rh * 1.8, rw * 0.72, rh * 0.7)
  }

  pop()
}

function drawAbstractMass(profile, s, form, c, intensity) {
  push()
  noStroke()

  if (profile.group === "vowel") {
    fill(c[0], c[1], c[2], 24 * intensity)
    ellipse(-s * 0.06, 0, s * 1.12, s * 0.42)

    fill(c[0], c[1], c[2], 14 * intensity)
    ellipse(s * 0.12, -s * 0.12, s * 0.62, s * 0.24)

    fill(245, 248, 250, 10 * intensity)
    ellipse(0, -s * 0.06, s * 0.42, s * 0.12)
  } else {
    rectMode(CENTER)

    fill(c[0], c[1], c[2], 20 * intensity)
    rect(-s * 0.08, 0, s * 0.32, s * 1.04)

    fill(c[0], c[1], c[2], 13 * intensity)
    rect(s * 0.16, -s * 0.04, s * 0.18, s * 0.64)

    fill(245, 248, 250, 8 * intensity)
    rect(0, -s * 0.1, s * 0.56, s * 0.1)
  }

  pop()
}

function drawAbstractFragments(profile, s, form, c, intensity) {
  push()
  noStroke()
  rectMode(CENTER)

  const t1 = form.phase
  const t2 = form.phase * 0.7 + 1.4

  fill(c[0], c[1], c[2], 24 * intensity)
  rect(cos(t1) * s * 0.22, sin(t1) * s * 0.18, s * 0.2, s * 0.09)

  fill(248, 250, 252, 12 * intensity)
  rect(cos(t2) * s * 0.18, -sin(t2) * s * 0.16, s * 0.11, s * 0.3)

  fill(c[0], c[1], c[2], 16 * intensity)
  ellipse(-cos(t2) * s * 0.16, sin(t1) * s * 0.2, s * 0.14, s * 0.14)

  pop()
}

function drawLetterSignature(profile, s, form, c, intensity) {
  push()

  noFill()
  strokeWeight(max(1, s * 0.01))

  if (profile.shape === "A" || profile.shape === "V" || profile.shape === "W" || profile.shape === "Y") {
    stroke(255, 255, 255, 22 * intensity)
    triangle(-s * 0.18, s * 0.18, s * 0.18, s * 0.18, 0, -s * 0.18)
  }

  if (profile.shape === "O" || profile.shape === "Q" || profile.shape === "C" || profile.shape === "G") {
    stroke(255, 255, 255, 24 * intensity)
    ellipse(0, 0, s * 0.34, s * 0.18)
  }

  if (profile.shape === "E" || profile.shape === "F" || profile.shape === "T" || profile.shape === "Z") {
    stroke(255, 255, 255, 22 * intensity)
    for (let i = -1; i <= 1; i++) {
      line(-s * 0.22, i * s * 0.08, s * 0.22, i * s * 0.08)
    }
  }

  if (profile.shape === "S" || profile.shape === "J" || profile.shape === "U") {
    stroke(255, 255, 255, 22 * intensity)
    arc(0, 0, s * 0.38, s * 0.22, 0, PI)
  }

  if (profile.shape === "K" || profile.shape === "R" || profile.shape === "X" || profile.shape === "N") {
    stroke(255, 255, 255, 22 * intensity)
    line(-s * 0.2, -s * 0.2, s * 0.2, s * 0.2)
    line(s * 0.2, -s * 0.2, -s * 0.2, s * 0.2)
  }

  pop()
}

function drawLetterAura(profile, s, c, alpha, intensity, glowBoost, form) {
  push()
  noFill()

  if (profile.group === "vowel") {
    stroke(c[0], c[1], c[2], 24 * intensity * glowBoost)
    strokeWeight(s * 0.16)
    ellipse(0, 0, s * 1.12, s * 0.42)

    stroke(245, 247, 248, 18 * intensity * glowBoost)
    strokeWeight(s * 0.06)
    ellipse(0, 0, s * 0.62, s * 0.22)
  } else {
    stroke(c[0], c[1], c[2], 20 * intensity * glowBoost)
    strokeWeight(s * 0.11)
    drawGlyph(profile.shape, s * 1.16, { uppercase: form.uppercase })

    stroke(245, 247, 248, 10 * intensity * glowBoost)
    strokeWeight(s * 0.04)
    drawGlyph(profile.shape, s * 0.92, { uppercase: form.uppercase })
  }

  pop()
}

function drawChromeHighlight(profile, s, form, c, intensity) {
  push()

  stroke(250, 252, 252, 42 * intensity)
  strokeWeight(max(1, s * 0.012))
  line(-s * 0.28, -s * 0.24, s * 0.2, -s * 0.36)

  stroke(235, 238, 240, 24 * intensity)
  strokeWeight(max(1, s * 0.006))
  line(-s * 0.16, -s * 0.1, s * 0.26, -s * 0.18)

  pop()
}

function drawAccentCuts(profile, s, form, c, intensity) {
  push()

  if (profile.phonetic === "voiceless") {
    stroke(245, 248, 250, 48 * intensity)
    strokeWeight(max(1, s * 0.009))

    for (let i = 0; i < 5; i++) {
      const a = form.phase + i * 1.18
      line(cos(a) * s * 0.12, sin(a) * s * 0.12, cos(a) * s * 0.42, sin(a) * s * 0.42)
    }
  }

  if (profile.phonetic === "voiced") {
    stroke(135, 145, 155, 34 * intensity)
    strokeWeight(max(1, s * 0.022))
    line(-s * 0.32, s * 0.36, s * 0.32, s * 0.36)
  }

  if (profile.phonetic === "nasal") {
    stroke(175, 185, 188, 34 * intensity)
    strokeWeight(max(1, s * 0.009))

    for (let i = 1; i < 4; i++) {
      ellipse(0, 0, s * 0.24 * i, s * 0.12 * i)
    }
  }

  if (profile.phonetic === "semivowel" || profile.phonetic === "liquid") {
    stroke(210, 214, 218, 28 * intensity)
    strokeWeight(max(1, s * 0.013))
    arc(0, 0, s * 0.76, s * 0.34, radians(200), radians(340))
  }

  pop()
}

function drawGlyph(shape, s, form) {
  if (form && form.uppercase === false) {
    drawLowercaseGlyph(shape, s, form)
    return
  }

  const h = s * 0.5
  const w = s * 0.5

  if (shape === "A") {
    beginShape()
    vertex(-w * 0.82, h * 0.84)
    quadraticVertex(-w * 0.22, -h * 0.88, 0, -h * 0.96)
    quadraticVertex(w * 0.28, -h * 0.88, w * 0.86, h * 0.82)
    endShape()
    line(-w * 0.42, h * 0.18, w * 0.42, h * 0.1)
    line(-w * 0.18, h * 0.46, w * 0.2, -h * 0.06)
  }

  if (shape === "B") {
    line(-w * 0.74, -h * 0.92, -w * 0.74, h * 0.94)
    beginShape()
    vertex(-w * 0.72, -h * 0.88)
    bezierVertex(w * 0.36, -h * 0.92, w * 0.52, -h * 0.08, -w * 0.12, -h * 0.02)
    bezierVertex(w * 0.74, h * 0.06, w * 0.58, h * 0.98, -w * 0.72, h * 0.86)
    endShape()
  }

  if (shape === "C") {
    beginShape()
    vertex(w * 0.62, -h * 0.66)
    bezierVertex(-w * 0.92, -h * 1.1, -w * 0.94, h * 1.06, w * 0.52, h * 0.74)
    endShape()
    arc(0, 0, s * 0.82, s * 0.54, radians(48), radians(312))
  }

  if (shape === "D") {
    line(-w * 0.72, -h * 0.92, -w * 0.72, h * 0.94)
    beginShape()
    vertex(-w * 0.68, -h * 0.88)
    bezierVertex(w * 0.72, -h * 0.84, w * 0.86, h * 0.82, -w * 0.7, h * 0.88)
    endShape()
  }

  if (shape === "E") {
    line(-w * 0.74, -h * 0.86, -w * 0.72, h * 0.86)
    line(-w * 0.74, -h * 0.86, w * 0.92, -h * 0.84)
    line(-w * 0.72, 0, w * 0.62, -h * 0.08)
    line(-w * 0.74, h * 0.86, w * 0.92, h * 0.78)
    line(-w * 0.12, -h * 0.44, w * 0.76, h * 0.36)
  }

  if (shape === "F") {
    line(-w * 0.72, -h * 0.9, -w * 0.72, h * 0.94)
    line(-w * 0.74, -h * 0.9, w * 0.92, -h * 0.94)
    line(-w * 0.72, -h * 0.08, w * 0.62, -h * 0.18)
    line(-w * 0.26, h * 0.28, w * 0.46, -h * 0.54)
  }

  if (shape === "G") {
    beginShape()
    vertex(w * 0.56, -h * 0.66)
    bezierVertex(-w * 0.92, -h * 1.08, -w * 0.92, h * 1.02, w * 0.62, h * 0.72)
    endShape()
    line(w * 0.04, h * 0.08, w * 0.74, h * 0.08)
    line(w * 0.74, h * 0.08, w * 0.68, h * 0.42)
  }

  if (shape === "H") {
    line(-w * 0.74, -h * 0.92, -w * 0.72, h * 0.92)
    line(w * 0.74, -h * 0.92, w * 0.72, h * 0.94)
    beginShape()
    vertex(-w * 0.72, 0)
    quadraticVertex(0, -h * 0.18, w * 0.72, 0)
    endShape()
    line(-w * 0.28, -h * 0.46, w * 0.28, h * 0.42)
  }

  if (shape === "I") {
    line(0, -h * 1.02, 0, h * 1.02)
    line(-w * 0.38, -h * 1.02, w * 0.44, -h * 1.02)
    line(-w * 0.42, h * 1.02, w * 0.38, h * 1.02)
  }

  if (shape === "J") {
    line(w * 0.34, -h * 1, w * 0.38, h * 0.28)
    beginShape()
    vertex(w * 0.38, h * 0.28)
    bezierVertex(w * 0.26, h * 1.02, -w * 0.82, h * 0.98, -w * 0.62, h * 0.18)
    endShape()
  }

  if (shape === "K") {
    line(-w * 0.72, -h * 0.98, -w * 0.72, h * 0.98)
    line(-w * 0.66, -h * 0.02, w * 0.92, -h * 0.92)
    line(-w * 0.68, -h * 0.02, w * 0.94, h * 0.98)
    line(-w * 0.12, -h * 0.16, w * 0.42, h * 0.42)
  }

  if (shape === "L") {
    line(-w * 0.72, -h * 0.98, -w * 0.72, h * 0.92)
    line(-w * 0.72, h * 0.92, w * 0.92, h * 0.84)
    line(-w * 0.28, h * 0.5, w * 0.52, h * 0.46)
  }

  if (shape === "M") {
    line(-w * 0.98, h * 0.92, -w * 0.98, -h * 0.92)
    line(-w * 0.98, -h * 0.92, -w * 0.2, h * 0.16)
    line(-w * 0.2, h * 0.16, w * 0.16, -h * 0.1)
    line(w * 0.16, -h * 0.1, w * 0.96, h * 0.92)
    line(w * 0.96, h * 0.92, w * 0.96, -h * 0.92)
  }

  if (shape === "N") {
    line(-w * 0.86, h * 0.92, -w * 0.84, -h * 0.92)
    line(-w * 0.84, -h * 0.92, w * 0.82, h * 0.92)
    line(w * 0.82, h * 0.92, w * 0.82, -h * 0.92)
    line(-w * 0.28, -h * 0.42, w * 0.34, h * 0.38)
  }

  if (shape === "O") {
    beginShape()
    vertex(0, -h * 0.94)
    bezierVertex(w * 0.94, -h * 0.82, w * 0.9, h * 0.82, 0, h * 0.94)
    bezierVertex(-w * 0.94, h * 0.82, -w * 0.92, -h * 0.82, 0, -h * 0.94)
    endShape()
    ellipse(0, 0, s * 0.62, s * 0.38)
  }

  if (shape === "P") {
    line(-w * 0.72, -h * 1, -w * 0.72, h * 1)
    beginShape()
    vertex(-w * 0.7, -h * 0.86)
    bezierVertex(w * 0.72, -h * 0.88, w * 0.62, h * 0.08, -w * 0.18, 0)
    endShape()
    line(-w * 0.72, 0, w * 0.12, 0)
  }

  if (shape === "Q") {
    beginShape()
    vertex(0, -h * 0.92)
    bezierVertex(w * 0.92, -h * 0.82, w * 0.88, h * 0.82, 0, h * 0.92)
    bezierVertex(-w * 0.92, h * 0.82, -w * 0.92, -h * 0.84, 0, -h * 0.92)
    endShape()
    ellipse(0, 0, s * 0.58, s * 0.34)
    line(w * 0.22, h * 0.24, w * 0.84, h * 0.88)
  }

  if (shape === "R") {
    line(-w * 0.72, -h * 1, -w * 0.72, h * 1)
    beginShape()
    vertex(-w * 0.7, -h * 0.88)
    bezierVertex(w * 0.62, -h * 0.9, w * 0.62, -h * 0.02, -w * 0.18, -h * 0.02)
    endShape()
    line(-w * 0.72, -h * 0.02, w * 0.08, -h * 0.02)
    line(-w * 0.16, h * 0.02, w * 0.9, h * 1)
  }

  if (shape === "S") {
    beginShape()
    vertex(w * 0.72, -h * 0.76)
    bezierVertex(-w * 0.8, -h * 1.12, -w * 0.88, -h * 0.06, -w * 0.08, 0)
    bezierVertex(w * 0.88, h * 0.12, w * 0.76, h * 1.12, -w * 0.72, h * 0.76)
    endShape()
    beginShape()
    vertex(w * 0.24, -h * 0.32)
    bezierVertex(-w * 0.34, -h * 0.46, -w * 0.28, h * 0.02, 0, h * 0.08)
    endShape()
  }

  if (shape === "T") {
    line(-w * 1, -h * 0.92, w * 1, -h * 0.92)
    line(0, -h * 0.92, 0, h * 1.02)
    line(-w * 0.34, -h * 0.58, w * 0.34, -h * 0.58)
  }

  if (shape === "U") {
    line(-w * 0.76, -h * 0.9, -w * 0.72, h * 0.2)
    line(w * 0.76, -h * 0.9, w * 0.72, h * 0.2)
    beginShape()
    vertex(-w * 0.72, h * 0.2)
    bezierVertex(-w * 0.62, h * 1, w * 0.62, h * 1, w * 0.72, h * 0.2)
    endShape()
    arc(0, h * 0.2, s * 0.38, s * 0.32, 0, PI)
  }

  if (shape === "V") {
    line(-w * 0.98, -h * 0.92, 0, h * 1.02)
    line(0, h * 1.02, w * 0.98, -h * 0.92)
    line(-w * 0.38, -h * 0.32, w * 0.4, -h * 0.32)
  }

  if (shape === "W") {
    line(-w * 1.06, -h * 0.9, -w * 0.56, h * 0.96)
    line(-w * 0.56, h * 0.96, -w * 0.06, -h * 0.12)
    line(-w * 0.06, -h * 0.12, w * 0.44, h * 0.96)
    line(w * 0.44, h * 0.96, w * 1.02, -h * 0.9)
  }

  if (shape === "X") {
    line(-w * 0.96, -h * 0.96, w * 0.98, h * 0.98)
    line(w * 0.98, -h * 0.96, -w * 0.96, h * 0.98)
    ellipse(0, 0, s * 0.22, s * 0.22)
  }

  if (shape === "Y") {
    line(-w * 0.9, -h * 0.96, 0, -h * 0.06)
    line(w * 0.9, -h * 0.96, 0, -h * 0.06)
    line(0, -h * 0.06, 0, h * 1.04)
    line(-w * 0.24, h * 0.34, w * 0.24, h * 0.34)
  }

  if (shape === "Z") {
    line(-w * 0.98, -h * 0.88, w * 0.98, -h * 0.9)
    line(w * 0.98, -h * 0.9, -w * 0.94, h * 0.9)
    line(-w * 0.94, h * 0.9, w * 1, h * 0.84)
    line(-w * 0.3, -h * 0.18, w * 0.3, h * 0.16)
  }
}

function drawLowercaseGlyph(shape, s, form) {
  const h = s * 0.5
  const w = s * 0.5

  if (shape === "A") {
    ellipse(0, h * 0.12, s * 0.7, s * 0.56)
    line(w * 0.32, -h * 0.38, w * 0.34, h * 0.78)
    beginShape()
    vertex(w * 0.02, h * 0.08)
    quadraticVertex(w * 0.26, -h * 0.24, w * 0.42, -h * 0.08)
    endShape()
  }

  if (shape === "B") {
    line(-w * 0.4, -h * 1.02, -w * 0.42, h * 0.82)
    beginShape()
    vertex(-w * 0.42, h * 0.1)
    bezierVertex(w * 0.52, -h * 0.02, w * 0.48, h * 0.82, -w * 0.2, h * 0.72)
    endShape()
  }

  if (shape === "C") {
    beginShape()
    vertex(w * 0.34, -h * 0.18)
    bezierVertex(-w * 0.54, -h * 0.52, -w * 0.56, h * 0.74, w * 0.28, h * 0.52)
    endShape()
  }

  if (shape === "D") {
    line(w * 0.4, -h * 1.02, w * 0.42, h * 0.82)
    beginShape()
    vertex(w * 0.38, h * 0.1)
    bezierVertex(-w * 0.62, -h * 0.06, -w * 0.58, h * 0.8, w * 0.06, h * 0.72)
    endShape()
  }

  if (shape === "E") {
    beginShape()
    vertex(w * 0.38, h * 0.12)
    bezierVertex(w * 0.32, -h * 0.46, -w * 0.6, -h * 0.42, -w * 0.4, h * 0.28)
    bezierVertex(-w * 0.22, h * 0.82, w * 0.44, h * 0.64, w * 0.46, h * 0.18)
    endShape()
    line(-w * 0.28, h * 0.1, w * 0.34, h * 0.08)
  }

  if (shape === "F") {
    line(-w * 0.12, -h * 0.96, -w * 0.12, h * 0.82)
    arc(w * 0.22, -h * 0.66, s * 0.58, s * 0.52, PI, TWO_PI)
    line(-w * 0.48, -h * 0.18, w * 0.44, -h * 0.2)
  }

  if (shape === "G") {
    ellipse(0, h * 0.1, s * 0.74, s * 0.58)
    line(w * 0.34, -h * 0.02, w * 0.36, h * 0.82)
    arc(0, h * 0.82, s * 0.72, s * 0.42, 0, PI)
  }

  if (shape === "H") {
    line(-w * 0.42, -h * 1.02, -w * 0.42, h * 0.82)
    beginShape()
    vertex(-w * 0.42, h * 0.12)
    bezierVertex(w * 0.08, -h * 0.22, w * 0.42, 0, w * 0.42, h * 0.82)
    endShape()
  }

  if (shape === "I") {
    line(0, -h * 0.28, 0, h * 0.82)
    point(0, -h * 0.72)
  }

  if (shape === "J") {
    line(w * 0.16, -h * 0.28, w * 0.16, h * 0.74)
    beginShape()
    vertex(w * 0.16, h * 0.74)
    bezierVertex(w * 0.14, h * 1.08, -w * 0.44, h * 1.06, -w * 0.38, h * 0.54)
    endShape()
    point(w * 0.16, -h * 0.72)
  }

  if (shape === "K") {
    line(-w * 0.38, -h * 1.02, -w * 0.38, h * 0.82)
    line(-w * 0.34, h * 0.18, w * 0.42, -h * 0.34)
    line(-w * 0.18, h * 0.18, w * 0.46, h * 0.82)
  }

  if (shape === "L") {
    line(0, -h * 1.02, 0, h * 0.82)
    line(0, h * 0.82, w * 0.34, h * 0.82)
  }

  if (shape === "M") {
    line(-w * 0.62, -h * 0.22, -w * 0.62, h * 0.82)
    beginShape()
    vertex(-w * 0.62, h * 0.08)
    bezierVertex(-w * 0.46, -h * 0.22, -w * 0.14, -h * 0.04, -w * 0.02, h * 0.08)
    bezierVertex(w * 0.14, -h * 0.18, w * 0.44, -h * 0.02, w * 0.46, h * 0.82)
    endShape()
  }

  if (shape === "N") {
    line(-w * 0.42, -h * 0.22, -w * 0.42, h * 0.82)
    beginShape()
    vertex(-w * 0.42, h * 0.1)
    bezierVertex(-w * 0.16, -h * 0.18, w * 0.38, -h * 0.02, w * 0.42, h * 0.82)
    endShape()
  }

  if (shape === "O") {
    ellipse(0, h * 0.12, s * 0.82, s * 0.64)
    ellipse(0, h * 0.12, s * 0.38, s * 0.28)
  }

  if (shape === "P") {
    line(-w * 0.42, -h * 0.22, -w * 0.42, h * 1.1)
    beginShape()
    vertex(-w * 0.42, h * 0.08)
    bezierVertex(w * 0.52, -h * 0.08, w * 0.5, h * 0.64, -w * 0.18, h * 0.56)
    endShape()
  }

  if (shape === "Q") {
    ellipse(0, h * 0.12, s * 0.78, s * 0.62)
    line(w * 0.28, h * 0.42, w * 0.58, h * 0.8)
  }

  if (shape === "R") {
    line(-w * 0.36, -h * 0.22, -w * 0.36, h * 0.82)
    beginShape()
    vertex(-w * 0.34, h * 0.1)
    bezierVertex(w * 0.18, -h * 0.16, w * 0.46, -h * 0.02, w * 0.42, h * 0.18)
    endShape()
  }

  if (shape === "S") {
    beginShape()
    vertex(w * 0.34, -h * 0.18)
    bezierVertex(-w * 0.48, -h * 0.48, -w * 0.48, h * 0.04, 0, h * 0.14)
    bezierVertex(w * 0.54, h * 0.24, w * 0.42, h * 0.88, -w * 0.38, h * 0.72)
    endShape()
  }

  if (shape === "T") {
    line(0, -h * 0.72, 0, h * 0.68)
    line(-w * 0.42, -h * 0.22, w * 0.42, -h * 0.22)
    line(0, h * 0.68, w * 0.38, h * 0.68)
  }

  if (shape === "U") {
    line(-w * 0.38, -h * 0.22, -w * 0.38, h * 0.34)
    line(w * 0.38, -h * 0.22, w * 0.38, h * 0.82)
    beginShape()
    vertex(-w * 0.38, h * 0.34)
    bezierVertex(-w * 0.24, h * 0.84, w * 0.24, h * 0.84, w * 0.38, h * 0.34)
    endShape()
  }

  if (shape === "V") {
    line(-w * 0.48, -h * 0.22, 0, h * 0.82)
    line(0, h * 0.82, w * 0.48, -h * 0.22)
  }

  if (shape === "W") {
    line(-w * 0.68, -h * 0.22, -w * 0.34, h * 0.82)
    line(-w * 0.34, h * 0.82, 0, h * 0.14)
    line(0, h * 0.14, w * 0.34, h * 0.82)
    line(w * 0.34, h * 0.82, w * 0.68, -h * 0.22)
  }

  if (shape === "X") {
    line(-w * 0.48, -h * 0.22, w * 0.48, h * 0.82)
    line(w * 0.48, -h * 0.22, -w * 0.48, h * 0.82)
  }

  if (shape === "Y") {
    line(-w * 0.46, -h * 0.22, 0, h * 0.5)
    line(w * 0.46, -h * 0.22, 0, h * 0.5)
    line(0, h * 0.5, -w * 0.34, h * 1.1)
  }

  if (shape === "Z") {
    line(-w * 0.44, -h * 0.22, w * 0.44, -h * 0.22)
    line(w * 0.44, -h * 0.22, -w * 0.44, h * 0.78)
    line(-w * 0.44, h * 0.78, w * 0.44, h * 0.78)
  }
}

function drawCurrentWordInfo(finishing) {
  push()

  const sourceWord = finishing ? finishState.word : typedWord
  const stats = getWordStats(sourceWord)
  const x = frameBox.x
  const y = frameBox.y + frameBox.h + 24
  const ratio = stats.total > 0 ? stats.vowelCount / stats.total : 0

  noStroke()
  fill(22, 24, 26, 230)
  textAlign(LEFT, TOP)
  textSize(13)
  text(sourceWord.length > 0 ? sourceWord : "TYPE A WORD", x, y)

  fill(70, 72, 74, 210)
  textSize(10)
  text(`LETTERS ${sourceWord.length}`, x, y + 24)
  text(`VOWELS ${stats.vowelCount}`, x + 92, y + 24)
  text(`CONSONANTS ${stats.consonantCount}`, x + 178, y + 24)
  text(`VOWEL RATIO ${nf(ratio, 1, 2)}`, x + 304, y + 24)

  const barW = 320
  const barY = y + 48

  fill(80, 82, 84, 90)
  rect(x, barY, barW, 2)

  fill(34, 36, 38, 160)
  rect(x, barY, barW * ratio, 2)

  fill(98, 102, 106, 150)
  rect(x + barW * ratio, barY, barW * (1 - ratio), 2)

  if (finishing) {
    fill(40, 44, 48, 210)
    text("REGISTERING ENTRY", x + 380, y + 24)
  }

  pop()
}

function drawFinishPulse(x, y, w, h, progress, stats) {
  push()

  const t = constrain(progress, 0, 1)
  const p1 = easeOutCubic(min(1, t * 1.4))
  const p2 = easeOutCubic(max(0, min(1, (t - 0.18) * 1.35)))
  const cx = x + w * 0.5
  const cy = y + h * 0.5

  noFill()
  stroke(15, 15, 15, 90 * (1 - p1))
  strokeWeight(1.5 + 5 * (1 - p1))
  ellipse(cx, cy, w * (0.26 + p1 * 0.88), h * (0.12 + p1 * 0.88))

  stroke(120, 126, 132, 70 * (1 - p2))
  strokeWeight(1.5 + 4 * (1 - p2))
  ellipse(cx, cy, w * (0.18 + p2 * 1.06), h * (0.08 + p2 * 1.02))

  stroke(0, 0, 0, 38 * (1 - t))
  strokeWeight(1)
  line(x, cy, x + w, cy)
  line(cx, y, cx, y + h)

  fill(30, 30, 30, 18 * (1 - t))
  noStroke()
  rectMode(CENTER)
  rect(cx, cy, w * (0.08 + p1 * 0.18), h * (0.08 + p1 * 0.18))

  pop()
}

function drawInterface() {
  push()

  textAlign(LEFT, BOTTOM)
  noStroke()
  fill(controllerConnected ? color(36, 38, 40, 220) : color(78, 80, 82, 190))
  textSize(10)
  text(controllerConnected ? "CONTROLLER ONLINE" : "CONTROLLER OFFLINE", 32, height - 12)

  textAlign(RIGHT, BOTTOM)
  fill(78, 80, 82, 190)
  text("PHONETIC ARCHIVE / P5.JS / SOCKET.IO", width - 32, height - 12)

  pop()
}

function makeLetterForm(char) {
  const base = char.toUpperCase()
  const uppercase = char !== char.toLowerCase() && char === char.toUpperCase()
  const index = currentForms.length
  const profile = getProfile(base)
  const vowelBias = profile && profile.group === "vowel" ? 0.16 : 0
  const edgeChance = random()
  const angle = index * 2.12 + random(-1.1, 1.1)
  let radius = random(0.04, 0.22) + min(index, 7) * 0.018

  if (edgeChance < 0.35) {
    radius = random(0.28, 0.48)
  }

  const nx = cos(angle) * radius + random(-0.08, 0.08)
  const ny = sin(angle) * radius * random(0.72, 1.08) + random(-0.08, 0.08)

  return {
    char,
    base,
    uppercase,
    nx: constrain(nx, -0.48, 0.48),
    ny: constrain(ny, -0.44, 0.44),
    spanRatio: random(0.88 + vowelBias, 1.48),
    rotation: random(-2.2, 2.2),
    phase: random(TWO_PI),
    motion: random(0.8, 2.8),
    order: index,
    scaleX: random(0.72, 1.7),
    scaleY: random(0.68, 1.74),
    shearX: random(-0.58, 0.58),
    shearY: random(-0.44, 0.44),
    distort: random(0.85, 1.55),
    extraRotation: random(-0.62, 0.62),
    innerScale: random(-0.12, 0.2)
  }
}

function getWordStats(word) {
  let vowelCount = 0
  let consonantCount = 0

  for (let i = 0; i < word.length; i++) {
    const base = word[i].toUpperCase()
    const profile = getProfile(base)
    if (!profile) continue

    if (profile.group === "vowel") {
      vowelCount++
    } else {
      consonantCount++
    }
  }

  return {
    vowelCount,
    consonantCount,
    total: vowelCount + consonantCount
  }
}

function getProfile(base) {
  if (typeof letterProfiles !== "undefined" && letterProfiles[base]) {
    return letterProfiles[base]
  }

  const fallback = {
    A: { shape: "A", color: [255, 102, 82], group: "vowel", phonetic: "vowel" },
    B: { shape: "B", color: [72, 160, 255], group: "consonant", phonetic: "voiced" },
    C: { shape: "C", color: [255, 120, 196], group: "consonant", phonetic: "voiceless" },
    D: { shape: "D", color: [255, 160, 70], group: "consonant", phonetic: "voiced" },
    E: { shape: "E", color: [255, 184, 0], group: "vowel", phonetic: "vowel" },
    F: { shape: "F", color: [160, 108, 255], group: "consonant", phonetic: "voiceless" },
    G: { shape: "G", color: [0, 198, 178], group: "consonant", phonetic: "voiced" },
    H: { shape: "H", color: [42, 214, 255], group: "consonant", phonetic: "voiceless" },
    I: { shape: "I", color: [255, 86, 196], group: "vowel", phonetic: "vowel" },
    J: { shape: "J", color: [255, 128, 92], group: "consonant", phonetic: "voiced" },
    K: { shape: "K", color: [132, 98, 255], group: "consonant", phonetic: "voiceless" },
    L: { shape: "L", color: [0, 232, 200], group: "consonant", phonetic: "liquid" },
    M: { shape: "M", color: [255, 0, 130], group: "consonant", phonetic: "nasal" },
    N: { shape: "N", color: [68, 156, 255], group: "consonant", phonetic: "nasal" },
    O: { shape: "O", color: [255, 90, 98], group: "vowel", phonetic: "vowel" },
    P: { shape: "P", color: [88, 214, 255], group: "consonant", phonetic: "voiceless" },
    Q: { shape: "Q", color: [255, 146, 64], group: "consonant", phonetic: "voiceless" },
    R: { shape: "R", color: [186, 96, 255], group: "consonant", phonetic: "liquid" },
    S: { shape: "S", color: [255, 54, 158], group: "consonant", phonetic: "voiceless" },
    T: { shape: "T", color: [255, 212, 0], group: "consonant", phonetic: "voiceless" },
    U: { shape: "U", color: [255, 120, 86], group: "vowel", phonetic: "vowel" },
    V: { shape: "V", color: [70, 220, 170], group: "consonant", phonetic: "voiced" },
    W: { shape: "W", color: [44, 214, 255], group: "consonant", phonetic: "semivowel" },
    X: { shape: "X", color: [188, 56, 255], group: "consonant", phonetic: "voiceless" },
    Y: { shape: "Y", color: [255, 178, 0], group: "consonant", phonetic: "semivowel" },
    Z: { shape: "Z", color: [255, 82, 120], group: "consonant", phonetic: "voiced" }
  }

  return fallback[base]
}

function getWarpStyle(form) {
  return PA_WARPS[form.base] || "softOrb"
}

function getMaterialStyle(base) {
  return PA_MATERIALS[base] || { type: "plastic", depth: 0.4, flatness: 0.3 }
}

function getLetterPalette(profile, form) {
  if (PA_MONO_COLORS[form.base]) {
    return PA_MONO_COLORS[form.base]
  }

  return profile.color
}

function getStableBlobPalette(forms) {
  const fallback = [
    [70, 150, 255],
    [140, 68, 255],
    [255, 32, 154],
    [255, 188, 0],
    [0, 220, 165],
    [255, 86, 40],
    [34, 214, 255],
    [188, 56, 255],
    [255, 220, 0]
  ]

  if (!forms || forms.length === 0) {
    return fallback
  }

  const colors = []

  for (let i = 0; i < forms.length; i++) {
    const profile = getProfile(forms[i].base)
    if (!profile) continue

    const expanded = getLetterPalette(profile, forms[i])
    const isMono = PA_MONO_COLORS[forms[i].base]

    let boosted

    if (isMono) {
      boosted = [
        constrain(expanded[0] * 1.08 + 12, 0, 255),
        constrain(expanded[1] * 1.08 + 12, 0, 255),
        constrain(expanded[2] * 1.08 + 12, 0, 255)
      ]
    } else {
      boosted = [
        constrain(expanded[0] * 1.58 + 30, 0, 255),
        constrain(expanded[1] * 1.58 + 30, 0, 255),
        constrain(expanded[2] * 1.58 + 30, 0, 255)
      ]
    }

    colors.push(boosted)
  }

  while (colors.length < 9) {
    const source = colors.length > 0 ? colors[colors.length % max(1, colors.length)] : fallback[colors.length % fallback.length]
    const extra = fallback[colors.length % fallback.length]
    colors.push(mixColor(source, extra, 0.28))
  }

  return colors.slice(0, 9)
}

function mixColor(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t)
  ]
}

function scaleColor(c, f) {
  return [
    constrain(c[0] * f, 0, 255),
    constrain(c[1] * f, 0, 255),
    constrain(c[2] * f, 0, 255)
  ]
}

function addColor(c, v) {
  return [
    constrain(c[0] + v, 0, 255),
    constrain(c[1] + v, 0, 255),
    constrain(c[2] + v, 0, 255)
  ]
}

function rgbaString(r, g, b, a) {
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${constrain(a, 0, 255) / 255})`
}

function beginArchiveAnimation() {
  if (typedWord.length === 0 || finishState) return

  if (typeof setupSoundSystem === "function") {
    setupSoundSystem()
  }

  const stats = getWordStats(typedWord)

  finishState = {
    word: typedWord,
    forms: JSON.parse(JSON.stringify(currentForms)),
    vowelCount: stats.vowelCount,
    consonantCount: stats.consonantCount,
    progress: 0
  }

  if (typeof playArchiveSound === "function") {
    playArchiveSound(typedWord, stats)
  }
}

function updateFinishState() {
  if (!finishState) return

  finishState.progress += 0.04

  if (finishState.progress >= 1) {
    const entries = getArchiveEntries()

    entries.push({
      word: finishState.word,
      forms: finishState.forms,
      time: Date.now(),
      vowelCount: finishState.vowelCount,
      consonantCount: finishState.consonantCount
    })

    typedWord = ""
    currentForms = []
    finishState = null
    currentMode = "archive"
  }
}

function openArchiveDetail(index) {
  const entries = getArchiveEntries()
  if (index < 0 || index >= entries.length) return

  selectedArchiveIndex = index
  currentMode = "archive-detail"
}

function getArchiveIndexAtMouse() {
  const layout = getArchiveLayout()
  const entries = getArchiveEntries()

  for (let i = 0; i < entries.length; i++) {
    const pos = getArchiveCardPosition(i, layout)

    if (mouseX >= pos.x && mouseX <= pos.x + pos.w && mouseY >= pos.y && mouseY <= pos.y + pos.h) {
      return i
    }
  }

  return -1
}

function easeOutCubic(t) {
  return 1 - pow(1 - t, 3)
}

function keyPressed(event) {
  const rawKey = event && event.key ? event.key : key

  if (finishState) {
    if (rawKey === "8") {
      fullscreen(!fullscreen())
      return false
    }

    return false
  }

  if (keyCode === ESCAPE || rawKey === "Escape") {
    if (currentMode === "archive-detail") {
      currentMode = "archive"
      selectedArchiveIndex = -1
      return false
    }
  }

  if (keyCode === ENTER || rawKey === "Enter") {
    if (currentMode === "composition") {
      beginArchiveAnimation()
    }

    return false
  }

  if (rawKey === "8") {
    fullscreen(!fullscreen())
    return false
  }

  if (keyCode === BACKSPACE || rawKey === "Backspace") {
    if (typedWord.length > 0) {
      typedWord = typedWord.slice(0, -1)
      currentForms.pop()
      currentMode = typedWord.length > 0 ? "composition" : currentMode
    }

    return false
  }
}

function keyTyped() {
  if (finishState) return false

  if (/^[a-zA-Z]$/.test(key)) {
    if (typeof setupSoundSystem === "function") {
      setupSoundSystem()
    }

    selectedArchiveIndex = -1
    currentMode = "composition"
    typedWord += key
    currentForms.push(makeLetterForm(key))

    const profile = getProfile(key.toUpperCase())

    if (typeof playLetterSound === "function") {
      playLetterSound(key, profile, key !== key.toLowerCase() && key === key.toUpperCase())
    }

    return false
  }
}

function mousePressed() {
  if (typeof setupSoundSystem === "function") {
    setupSoundSystem()
  }

  if (currentMode === "archive") {
    const index = getArchiveIndexAtMouse()

    if (index >= 0) {
      openArchiveDetail(index)
    }

    return
  }

  if (currentMode === "archive-detail") {
    currentMode = "archive"
    selectedArchiveIndex = -1
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}