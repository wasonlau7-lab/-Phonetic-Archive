const socket = io()

const button = document.getElementById("motion-button")
const statusEl = document.getElementById("controller-status")
const tiltXEl = document.getElementById("tilt-x")
const tiltYEl = document.getElementById("tilt-y")
const shakeEl = document.getElementById("shake")

let sensorEnabled = false
let hasOrientation = false
let hasMotion = false

let rawGamma = 0
let rawBeta = 0
let rawAlpha = 0

let smoothX = 0
let smoothY = 0
let smoothZ = 0
let smoothShake = 0

let lastAccX = 0
let lastAccY = 0
let lastAccZ = 0
let lastSendTime = 0
let eventCount = 0

socket.on("connect", () => {
  statusEl.textContent = "socket connected"

  socket.emit("controller-ready", {
    connected: true
  })
})

socket.on("disconnect", () => {
  statusEl.textContent = "socket disconnected"
})

button.addEventListener("click", async () => {
  statusEl.textContent = "requesting sensors"

  const granted = await requestSensorPermission()

  if (granted) {
    enableSensors()
  } else {
    statusEl.textContent = "sensor permission not granted"
  }
})

async function requestSensorPermission() {
  let motionGranted = false
  let orientationGranted = false

  try {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      const result = await DeviceMotionEvent.requestPermission()
      motionGranted = result === "granted"
    } else if (typeof DeviceMotionEvent !== "undefined") {
      motionGranted = true
    }
  } catch (error) {
    statusEl.textContent = `motion error: ${error.message}`
  }

  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const result = await DeviceOrientationEvent.requestPermission()
      orientationGranted = result === "granted"
    } else if (typeof DeviceOrientationEvent !== "undefined") {
      orientationGranted = true
    }
  } catch (error) {
    statusEl.textContent = `orientation error: ${error.message}`
  }

  return motionGranted || orientationGranted
}

function enableSensors() {
  if (sensorEnabled) return

  sensorEnabled = true

  window.addEventListener("deviceorientation", handleOrientation, true)
  window.addEventListener("devicemotion", handleMotion, true)

  statusEl.textContent = "sensors enabled, move phone"

  socket.emit("controller-ready", {
    connected: true
  })

  setInterval(sendMotionData, 33)
}

function handleOrientation(event) {
  const gamma = numberOrZero(event.gamma)
  const beta = numberOrZero(event.beta)
  const alpha = numberOrZero(event.alpha)

  if (gamma === 0 && beta === 0 && alpha === 0) return

  hasOrientation = true

  rawGamma = gamma
  rawBeta = beta
  rawAlpha = alpha
}

function handleMotion(event) {
  const acc = event.accelerationIncludingGravity || event.acceleration || {}

  const ax = numberOrZero(acc.x)
  const ay = numberOrZero(acc.y)
  const az = numberOrZero(acc.z)

  if (ax === 0 && ay === 0 && az === 0) return

  hasMotion = true

  const dx = ax - lastAccX
  const dy = ay - lastAccY
  const dz = az - lastAccZ

  const instantShake = Math.sqrt(dx * dx + dy * dy + dz * dz)

  lastAccX = ax
  lastAccY = ay
  lastAccZ = az

  smoothShake = lerpValue(smoothShake, constrainValue(instantShake, 0, 12), 0.18)

  if (!hasOrientation) {
    smoothX = lerpValue(smoothX, constrainValue(ax, -10, 10), 0.12)
    smoothY = lerpValue(smoothY, constrainValue(ay, -10, 10), 0.12)
    smoothZ = lerpValue(smoothZ, constrainValue(az, -10, 10), 0.12)
  }
}

function sendMotionData() {
  if (!sensorEnabled) return
  if (!socket.connected) return

  const now = Date.now()

  if (now - lastSendTime < 30) return

  lastSendTime = now

  if (hasOrientation) {
    const targetX = constrainValue(rawGamma / 9, -10, 10)
    const targetY = constrainValue(rawBeta / 9, -10, 10)
    const targetZ = constrainValue(rawAlpha / 36, -10, 10)

    smoothX = lerpValue(smoothX, targetX, 0.14)
    smoothY = lerpValue(smoothY, targetY, 0.14)
    smoothZ = lerpValue(smoothZ, targetZ, 0.12)
  }

  const data = {
    x: smoothX,
    y: smoothY,
    z: smoothZ,
    shake: constrainValue(smoothShake, 0, 8),
    orientation: hasOrientation,
    motion: hasMotion,
    time: now
  }

  eventCount++

  statusEl.textContent = `streaming motion ${eventCount}`
  tiltXEl.textContent = `x: ${data.x.toFixed(2)}`
  tiltYEl.textContent = `y: ${data.y.toFixed(2)}`
  shakeEl.textContent = `shake: ${data.shake.toFixed(2)}`

  socket.emit("controller-motion", data)
}

function numberOrZero(value) {
  if (typeof value !== "number") return 0
  if (!Number.isFinite(value)) return 0
  return value
}

function constrainValue(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function lerpValue(a, b, t) {
  return a + (b - a) * t
}

window.addEventListener("beforeunload", () => {
  socket.emit("controller-ready", {
    connected: false
  })
})