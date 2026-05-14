const SHAKE_THRESHOLD = 18
const SHAKE_COOLDOWN_MS = 1200
const ROLLING_MS = 900

const LINE_MAP = {
  6: { value: 6, name: "老阴", isYang: false, moving: true },
  7: { value: 7, name: "少阳", isYang: true, moving: false },
  8: { value: 8, name: "少阴", isYang: false, moving: false },
  9: { value: 9, name: "老阳", isYang: true, moving: true }
}

const TRIGRAMS = {
  "111": { name: "乾", nature: "天" },
  "110": { name: "兑", nature: "泽" },
  "101": { name: "离", nature: "火" },
  "100": { name: "震", nature: "雷" },
  "011": { name: "巽", nature: "风" },
  "010": { name: "坎", nature: "水" },
  "001": { name: "艮", nature: "山" },
  "000": { name: "坤", nature: "地" }
}

const HEXAGRAM_NAMES = {
  "乾|乾": "乾为天",
  "乾|兑": "天泽履",
  "乾|离": "天火同人",
  "乾|震": "天雷无妄",
  "乾|巽": "天风姤",
  "乾|坎": "天水讼",
  "乾|艮": "天山遁",
  "乾|坤": "天地否",

  "兑|乾": "泽天夬",
  "兑|兑": "兑为泽",
  "兑|离": "泽火革",
  "兑|震": "泽雷随",
  "兑|巽": "泽风大过",
  "兑|坎": "泽水困",
  "兑|艮": "泽山咸",
  "兑|坤": "泽地萃",

  "离|乾": "火天大有",
  "离|兑": "火泽睽",
  "离|离": "离为火",
  "离|震": "火雷噬嗑",
  "离|巽": "火风鼎",
  "离|坎": "火水未济",
  "离|艮": "火山旅",
  "离|坤": "火地晋",

  "震|乾": "雷天大壮",
  "震|兑": "雷泽归妹",
  "震|离": "雷火丰",
  "震|震": "震为雷",
  "震|巽": "雷风恒",
  "震|坎": "雷水解",
  "震|艮": "雷山小过",
  "震|坤": "雷地豫",

  "巽|乾": "风天小畜",
  "巽|兑": "风泽中孚",
  "巽|离": "风火家人",
  "巽|震": "风雷益",
  "巽|巽": "巽为风",
  "巽|坎": "风水涣",
  "巽|艮": "风山渐",
  "巽|坤": "风地观",

  "坎|乾": "水天需",
  "坎|兑": "水泽节",
  "坎|离": "水火既济",
  "坎|震": "水雷屯",
  "坎|巽": "水风井",
  "坎|坎": "坎为水",
  "坎|艮": "水山蹇",
  "坎|坤": "水地比",

  "艮|乾": "山天大畜",
  "艮|兑": "山泽损",
  "艮|离": "山火贲",
  "艮|震": "山雷颐",
  "艮|巽": "山风蛊",
  "艮|坎": "山水蒙",
  "艮|艮": "艮为山",
  "艮|坤": "山地剥",

  "坤|乾": "地天泰",
  "坤|兑": "地泽临",
  "坤|离": "地火明夷",
  "坤|震": "地雷复",
  "坤|巽": "地风升",
  "坤|坎": "地水师",
  "坤|艮": "地山谦",
  "坤|坤": "坤为地"
}

const state = {
  stage: "home",
  lines: [],
  coins: [3, 3, 3],
  isRolling: false,
  motionEnabled: false,
  clickFallback: true,
  lastMotion: null,
  lastShakeTime: 0,
  originalHexagram: null,
  changedHexagram: null,
  explanation: ""
}

const app = document.getElementById("app")

function init() {
  render()
}

function render() {
  if (state.stage === "home") renderHome()
  if (state.stage === "casting") renderCasting()
  if (state.stage === "result") renderResult()
}

function startCasting() {
  resetCasting()
  state.stage = "casting"
  render()

  requestMotionAccessIfAvailable().then(motionEnabled => {
    if (state.stage !== "casting") return

    if (motionEnabled) {
      enableMotionCasting()
    } else {
      enableClickFallback()
    }
    render()
  })
}

function resetCasting() {
  window.removeEventListener("devicemotion", handleDeviceMotion)
  state.stage = "home"
  state.lines = []
  state.coins = [3, 3, 3]
  state.isRolling = false
  state.motionEnabled = false
  state.clickFallback = true
  state.lastMotion = null
  state.lastShakeTime = 0
  state.originalHexagram = null
  state.changedHexagram = null
  state.explanation = ""
}

async function requestMotionAccessIfAvailable() {
  if (typeof DeviceMotionEvent === "undefined") {
    return false
  }

  if (typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const permission = await DeviceMotionEvent.requestPermission()
      return permission === "granted"
    } catch (error) {
      return false
    }
  }

  return true
}

function enableMotionCasting() {
  state.motionEnabled = true
  state.clickFallback = true
  state.lastMotion = null
  window.removeEventListener("devicemotion", handleDeviceMotion)
  window.addEventListener("devicemotion", handleDeviceMotion)
}

function enableClickFallback() {
  state.motionEnabled = false
  state.clickFallback = true
  window.removeEventListener("devicemotion", handleDeviceMotion)
}

function handleDeviceMotion(event) {
  if (state.stage !== "casting") return
  if (state.isRolling) return
  if (state.lines.length >= 6) return

  const acc = event.accelerationIncludingGravity || event.acceleration
  if (!acc) return

  const current = {
    x: acc.x || 0,
    y: acc.y || 0,
    z: acc.z || 0
  }

  if (!state.lastMotion) {
    state.lastMotion = current
    return
  }

  const delta =
    Math.abs(current.x - state.lastMotion.x) +
    Math.abs(current.y - state.lastMotion.y) +
    Math.abs(current.z - state.lastMotion.z)

  state.lastMotion = current

  const now = Date.now()
  if (delta > SHAKE_THRESHOLD && now - state.lastShakeTime > SHAKE_COOLDOWN_MS) {
    state.lastShakeTime = now
    castOneLine()
  }
}

function castOneLine() {
  if (state.stage !== "casting") return
  if (state.isRolling) return
  if (state.lines.length >= 6) return

  rollCoins()
}

function rollCoins() {
  const coins = generateCoins()
  state.isRolling = true
  render()

  window.setTimeout(() => finishRoll(coins), ROLLING_MS)
}

function finishRoll(coins) {
  const line = coinsToLine(coins)
  state.coins = coins
  state.lines.push(line)
  state.isRolling = false

  if (state.lines.length === 6) {
    buildResult()
  }

  render()
}

function generateCoins() {
  return Array.from({ length: 3 }, () => (Math.random() < 0.5 ? 3 : 2))
}

function coinsToLine(coins) {
  const value = coins.reduce((sum, coin) => sum + coin, 0)
  return {
    ...LINE_MAP[value],
    coins
  }
}

function buildResult() {
  state.originalHexagram = buildHexagram(state.lines, false)
  state.changedHexagram = buildHexagram(state.lines, true)

  const movingCount = state.lines.filter(line => line.moving).length
  state.explanation = buildExplanation(
    state.originalHexagram.name,
    state.changedHexagram.name,
    movingCount
  )
  state.stage = "result"
  window.removeEventListener("devicemotion", handleDeviceMotion)
}

function buildHexagram(lines, changed = false) {
  const bits = lines.map(line => {
    const isYang = changed ? changedIsYang(line) : line.isYang
    return isYang ? "1" : "0"
  })

  const lowerBits = bits.slice(0, 3).join("")
  const upperBits = bits.slice(3, 6).join("")
  const lower = TRIGRAMS[lowerBits]
  const upper = TRIGRAMS[upperBits]
  const name = HEXAGRAM_NAMES[`${upper.name}|${lower.name}`]

  return {
    name,
    lower,
    upper,
    bits
  }
}

function changedIsYang(line) {
  if (line.value === 6) return true
  if (line.value === 9) return false
  return line.isYang
}

function buildExplanation(originalName, changedName, movingCount) {
  if (movingCount === 0) {
    return "本卦未变，宜守正观势。"
  }

  if (originalName === changedName) {
    return "卦象有动而名未变，宜静中微调。"
  }

  return `由「${originalName}」之「${changedName}」，宜稳中应变。`
}

function renderHome() {
  app.innerHTML = `
    <section class="screen home-screen">
      <h1 class="title">Cyber Yarrow</h1>
      <p class="intro">Think quietly of your question.</p>
      <p class="intro">Shake your phone, or click to cast on desktop.</p>
      <button class="button" id="start-button" type="button">Start Casting</button>
      <p class="footer">For reflection only.</p>
    </section>
  `

  document.getElementById("start-button").addEventListener("click", startCasting)
}

function renderCasting() {
  const nextLine = Math.min(state.lines.length + 1, 6)
  const status = state.isRolling
    ? "Coins turning"
    : state.motionEnabled
      ? "Shake gently, or use the button"
      : "Click to cast this line"

  app.innerHTML = `
    <section class="screen casting-screen">
      <p class="progress">Line ${nextLine} / 6</p>
      ${renderCoins()}
      <p class="status">${status}</p>
      <button class="button secondary" id="cast-button" type="button" ${state.isRolling ? "disabled" : ""}>Cast This Line</button>
      ${renderLineRecord()}
      <p class="footer">For reflection only.</p>
    </section>
  `

  const castButton = document.getElementById("cast-button")
  if (castButton) {
    castButton.addEventListener("click", castOneLine)
  }
}

function renderResult() {
  app.innerHTML = `
    <section class="screen result-screen">
      <div class="result-block">
        <p class="result-title">Original</p>
        <p class="hexagram-name">${state.originalHexagram.name}</p>
        ${renderHexagram(state.lines, false)}
      </div>
      <div class="result-block">
        <p class="result-title">Changed</p>
        <p class="hexagram-name">${state.changedHexagram.name}</p>
        ${renderHexagram(state.lines, true)}
      </div>
      <p class="explanation">${state.explanation}</p>
      <button class="button" id="again-button" type="button">Cast Again</button>
      <p class="footer">For reflection only.</p>
    </section>
  `

  document.getElementById("again-button").addEventListener("click", () => {
    resetCasting()
    render()
  })
}

function renderCoins() {
  const coins = state.coins.map(coin => {
    const sideClass = coin === 3 ? "heads" : "tails"
    const label = state.isRolling ? "" : coin === 3 ? "正" : "反"
    const ariaLabel = coin === 3 ? "Coin heads" : "Coin tails"
    return `<div class="coin ${sideClass} ${state.isRolling ? "rolling" : ""}" aria-label="${ariaLabel}">${label}</div>`
  }).join("")

  return `<div class="coin-row" aria-label="Three coins">${coins}</div>`
}

function renderLineRecord() {
  const emptyRows = Array.from({ length: 6 - state.lines.length }, () => null)
  const rows = emptyRows.concat([...state.lines].reverse())
  const html = rows.map(line => renderLine(line, false, true)).join("")

  return `<div class="record" aria-label="Six line record">${html}</div>`
}

function renderHexagram(lines, changed = false) {
  const displayLines = [...lines].reverse()
  const html = displayLines.map(line => renderLine(line, changed, false)).join("")
  return `<div class="hexagram" aria-label="Hexagram diagram">${html}</div>`
}

function renderLine(line, changed = false, placeholder = false) {
  if (!line) {
    return `
      <div class="line-row">
        <span class="moving-mark" aria-hidden="true"></span>
        <div class="line placeholder" aria-hidden="true"></div>
      </div>
    `
  }

  const isYang = changed ? changedIsYang(line) : line.isYang
  const lineClass = isYang ? "yang" : "yin"
  const accessibility = `${line.moving ? "Moving " : ""}${isYang ? "yang" : "yin"} line`
  const lineHtml = isYang
    ? `<div class="line yang"></div>`
    : `<div class="line yin"><span></span><span></span></div>`

  return `
    <div class="line-row ${placeholder ? "record-row" : ""}" aria-label="${accessibility}">
      <span class="moving-mark" aria-hidden="true">${line.moving ? "✦" : ""}</span>
      ${lineHtml}
    </div>
  `
}

init()
