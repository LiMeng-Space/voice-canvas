const canvas = document.querySelector("#drawingCanvas");
const ctx = canvas.getContext("2d");
const micButton = document.querySelector("#micButton");
const micLabel = document.querySelector("#micLabel");
const supportStatus = document.querySelector("#supportStatus");
const transcriptEl = document.querySelector("#transcript");
const commandLog = document.querySelector("#commandLog");
const colorSwatch = document.querySelector("#colorSwatch");
const currentColor = document.querySelector("#currentColor");
const currentLineWidth = document.querySelector("#currentLineWidth");
const currentMode = document.querySelector("#currentMode");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const state = {
  color: "#222326",
  colorName: "墨黑",
  lineWidth: 6,
  mode: "fill",
  background: "#fffdfa",
  listening: false,
  history: [],
  redoStack: [],
  recognition: null,
};

const colors = [
  { name: "红色", value: "#d93832", keys: ["红", "红色", "赤色"] },
  { name: "橙色", value: "#e87522", keys: ["橙", "橙色", "橘色"] },
  { name: "黄色", value: "#f3c13a", keys: ["黄", "黄色", "金色"] },
  { name: "绿色", value: "#3d9b58", keys: ["绿", "绿色", "草绿"] },
  { name: "青色", value: "#23a6a0", keys: ["青", "青色", "湖蓝"] },
  { name: "蓝色", value: "#2f74d0", keys: ["蓝", "蓝色", "天蓝"] },
  { name: "紫色", value: "#7d5ac7", keys: ["紫", "紫色"] },
  { name: "粉色", value: "#e46f9b", keys: ["粉", "粉色", "粉红"] },
  { name: "棕色", value: "#8b5a33", keys: ["棕", "棕色", "咖啡"] },
  { name: "灰色", value: "#8f9399", keys: ["灰", "灰色"] },
  { name: "黑色", value: "#222326", keys: ["黑", "黑色", "墨黑"] },
  { name: "白色", value: "#fffdfa", keys: ["白", "白色"] },
  { name: "浅蓝色", value: "#cdeef5", keys: ["浅蓝", "浅蓝色", "淡蓝"] },
  { name: "浅绿色", value: "#d7efd8", keys: ["浅绿", "浅绿色", "淡绿"] },
  { name: "米色", value: "#f5f2ea", keys: ["米色", "米白"] },
];

const countUnits = ["个", "只", "朵", "颗", "棵", "座", "条", "轮"];
const drawIntentPattern = /画|绘制|添加|放|放置|生成|创建|来|画上|加上|补上/;
const textIntentPattern = /写|写上|文字|文本|标题|输入|加字/;

const shapeAliases = [
  { shape: "circle", keys: ["圆", "圆形", "圆圈", "圈"] },
  { shape: "square", keys: ["正方形", "方块"] },
  { shape: "rectangle", keys: ["矩形", "长方形"] },
  { shape: "triangle", keys: ["三角", "三角形"] },
  { shape: "line", keys: ["线", "直线", "线条"] },
  { shape: "star", keys: ["星", "星星", "五角星"] },
  { shape: "heart", keys: ["心", "爱心"] },
  { shape: "cloud", keys: ["云", "云朵"] },
  { shape: "sun", keys: ["太阳", "日头"] },
  { shape: "tree", keys: ["树", "树木", "小树"] },
  { shape: "house", keys: ["房子", "房屋", "小屋"] },
  { shape: "flower", keys: ["花", "花朵", "小花"] },
  { shape: "mountain", keys: ["山", "山峰", "群山"] },
];

const numberWords = new Map([
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);

function initCanvas() {
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  saveSnapshot("初始化画布", false);
  updateStatePanel();
}

function saveSnapshot(label, clearRedo = true) {
  state.history.push({
    label,
    image: ctx.getImageData(0, 0, WIDTH, HEIGHT),
  });
  if (state.history.length > 60) {
    state.history.shift();
  }
  if (clearRedo) {
    state.redoStack = [];
  }
}

function restoreSnapshot(snapshot) {
  ctx.putImageData(snapshot.image, 0, 0);
}

function logCommand(message, type = "ok") {
  const item = document.createElement("li");
  const status = type === "ok" ? "完成" : "提示";
  item.innerHTML = `<span class="${type}">${status}</span> ${escapeHtml(message)}`;
  commandLog.prepend(item);
  while (commandLog.children.length > 18) {
    commandLog.removeChild(commandLog.lastElementChild);
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function speak(message) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "zh-CN";
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

function updateStatePanel() {
  colorSwatch.style.background = state.color;
  currentColor.textContent = state.colorName;
  currentLineWidth.textContent = `${state.lineWidth} px`;
  currentMode.textContent = state.mode === "fill" ? "填充" : "描边";
}

function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    supportStatus.textContent = "当前浏览器不支持 Web Speech API，请使用 Chrome 或 Edge";
    micButton.disabled = true;
    return;
  }

  supportStatus.textContent = "支持普通话语音识别";
  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    state.listening = true;
    micButton.classList.add("listening");
    micLabel.textContent = "正在聆听";
    supportStatus.textContent = "请直接说绘图指令";
  };

  recognition.onend = () => {
    state.listening = false;
    micButton.classList.remove("listening");
    micLabel.textContent = "启动麦克风";
    if (!micButton.disabled) {
      supportStatus.textContent = "语音识别已暂停";
    }
  };

  recognition.onerror = (event) => {
    const message =
      event.error === "not-allowed"
        ? "麦克风权限被拒绝，请允许浏览器使用麦克风"
        : `语音识别错误：${event.error}`;
    supportStatus.textContent = message;
    logCommand(message, "warn");
  };

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }

    const visibleText = [finalText, interim].filter(Boolean).join(" ");
    if (visibleText.trim()) {
      transcriptEl.textContent = visibleText.trim();
    }

    if (finalText.trim()) {
      handleTranscript(finalText.trim());
    }
  };

  state.recognition = recognition;
}

function toggleListening() {
  if (!state.recognition) return;
  if (state.listening) {
    state.recognition.stop();
    return;
  }
  try {
    state.recognition.start();
  } catch (error) {
    supportStatus.textContent = "语音识别正在启动，请稍候";
  }
}

function handleTranscript(text) {
  const normalized = normalizeText(text);
  const commands = splitCommands(normalized);

  if (!commands.length) {
    logCommand(`未识别到有效指令：${text}`, "warn");
    return;
  }

  const results = commands.map((command) => executeCommand(command));
  const successCount = results.filter(Boolean).length;
  if (successCount > 0) {
    speak(`已执行 ${successCount} 条指令`);
  } else {
    speak("这条指令我还没有理解，请换一种说法");
  }
}

function normalizeText(text) {
  return text
    .trim()
    .replace(/\s+/g, "")
    .replace(/坐标?(\d+)[,，](\d+)/g, "坐标$1和$2")
    .replace(/[，。！？；、,.!?;]/g, ",")
    .replace(/请你|请给我|帮忙|麻烦|可以|能不能|给我/g, "")
    .replace(/一下|一下子/g, "")
    .replace(/先/g, "")
    .replace(/再来/g, "再")
    .replace(/帮我/g, "")
    .replace(/请/g, "");
}

function splitCommands(text) {
  const roughParts = text
    .split(/,|然后|接着|随后|之后|接下来|再|并且|同时|最后|另外|还有|then|and/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  return roughParts.flatMap((part) => {
    if (!/(和|以及)/.test(part)) return [part];
    const pieces = part.split(/和|以及/).filter(Boolean);
    if (pieces.length < 2) return [part];
    const firstHasAction = hasDrawIntent(pieces[0]);
    const laterHasShape = pieces.slice(1).some((piece) => findShape(piece));
    if (!firstHasAction || !laterHasShape) return [part];
    return pieces.map((piece, index) =>
      index === 0 ? piece : `画${piece}`,
    );
  });
}

function hasDrawIntent(command) {
  return drawIntentPattern.test(command);
}

function hasVisualOptions(command) {
  const unitPattern = countUnits.join("|");
  return (
    Boolean(findColor(command)) ||
    /左|右|上|下|中|顶|底|大|小|描边|填充|空心|实心/.test(command) ||
    new RegExp(`\\d+(${unitPattern})|[一二两三四五六七八九十]+(${unitPattern})`).test(command)
  );
}

function executeCommand(command) {
  if (!command) return false;

  if (/帮助|说明|指令/.test(command)) {
    logCommand("支持形状、颜色、位置、数量、背景、文字、撤销、重做和导出指令");
    return true;
  }

  if (/撤销|退回|取消上/.test(command)) {
    return undo();
  }

  if (/重做|恢复/.test(command)) {
    return redo();
  }

  if (/清空|清除|重新开始/.test(command)) {
    clearCanvas();
    return true;
  }

  if (/导出|保存|下载/.test(command)) {
    exportCanvas();
    return true;
  }

  if (/背景|底色|画布颜色/.test(command)) {
    const color = findColor(command) || colors.find((item) => item.name === "白色");
    setBackground(color);
    return true;
  }

  if (/画笔|笔刷|笔触|线宽|粗|细|颜色|描边|填充|空心|实心/.test(command) && !findShape(command)) {
    updateBrush(command);
    return true;
  }

  if (textIntentPattern.test(command)) {
    const options = parseOptions(command);
    const text = extractText(command);
    drawText(text, options);
    saveSnapshot(`文字：${text}`);
    logCommand(`写入文字「${text}」`);
    return true;
  }

  const shape = findShape(command);
  if (shape && (hasDrawIntent(command) || hasVisualOptions(command))) {
    const options = parseOptions(command);
    drawRepeatedShape(shape, options);
    saveSnapshot(`${shapeLabel(shape)} x ${options.count}`);
    logCommand(`绘制 ${options.count} 个${shapeLabel(shape)}，颜色 ${options.color.name}`);
    return true;
  }

  logCommand(`暂未理解：${command}`, "warn");
  return false;
}

function undo() {
  if (state.history.length <= 1) {
    logCommand("已经没有可撤销的步骤", "warn");
    return false;
  }
  const current = state.history.pop();
  state.redoStack.push(current);
  restoreSnapshot(state.history[state.history.length - 1]);
  logCommand("撤销上一项绘图");
  return true;
}

function redo() {
  const next = state.redoStack.pop();
  if (!next) {
    logCommand("已经没有可重做的步骤", "warn");
    return false;
  }
  state.history.push(next);
  restoreSnapshot(next);
  logCommand("恢复上一项绘图");
  return true;
}

function clearCanvas() {
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  saveSnapshot("清空画布");
  logCommand("清空画布");
}

function exportCanvas() {
  const link = document.createElement("a");
  link.download = `voice-canvas-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  logCommand("导出 PNG 图片");
}

function updateBrush(command) {
  const color = findColor(command);
  if (color) {
    state.color = color.value;
    state.colorName = color.name;
  }
  if (/描边|空心|轮廓/.test(command)) {
    state.mode = "stroke";
  }
  if (/填充|实心/.test(command)) {
    state.mode = "fill";
  }
  if (/细/.test(command)) {
    state.lineWidth = 3;
  }
  if (/粗/.test(command)) {
    state.lineWidth = 12;
  }
  const widthMatch = command.match(/(\d+)(像素|px)?/i);
  if (widthMatch) {
    state.lineWidth = clamp(Number(widthMatch[1]), 1, 48);
  }
  updateStatePanel();
  logCommand(`更新画笔：${state.colorName}，${state.lineWidth}px，${currentMode.textContent}`);
}

function setBackground(color) {
  const previous = hexToRgb(state.background);
  const next = hexToRgb(color.value);
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const pixels = image.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const isBackground =
      Math.abs(pixels[i] - previous.r) < 4 &&
      Math.abs(pixels[i + 1] - previous.g) < 4 &&
      Math.abs(pixels[i + 2] - previous.b) < 4 &&
      pixels[i + 3] > 250;

    if (isBackground) {
      pixels[i] = next.r;
      pixels[i + 1] = next.g;
      pixels[i + 2] = next.b;
      pixels[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  state.background = color.value;
  saveSnapshot(`背景：${color.name}`);
  logCommand(`背景改为${color.name}`);
}

function parseOptions(command) {
  const color = findColor(command) || {
    name: state.colorName,
    value: state.color,
  };
  return {
    color,
    position: findPosition(command),
    size: findSize(command),
    count: findCount(command),
    mode: /描边|空心|轮廓/.test(command)
      ? "stroke"
      : /填充|实心/.test(command)
        ? "fill"
        : state.mode,
    lineWidth: findLineWidth(command),
    direction: findDirection(command),
  };
}

function findColor(command) {
  const matches = [];
  colors.forEach((color) => {
    color.keys.forEach((key) => {
      if (command.includes(key)) {
        matches.push({ color, length: key.length });
      }
    });
  });
  matches.sort((a, b) => b.length - a.length);
  return matches[0]?.color;
}

function findShape(command) {
  const matched = shapeAliases.find((item) =>
    item.keys.some((key) => command.includes(key)),
  );
  return matched?.shape || null;
}

function findPosition(command) {
  const direct = command.match(/x(\d+)y(\d+)/i);
  if (direct) {
    return { x: clamp(Number(direct[1]), 0, WIDTH), y: clamp(Number(direct[2]), 0, HEIGHT) };
  }

  const coordinate = command.match(/坐标?(\d+)[,，和](\d+)/);
  if (coordinate) {
    return {
      x: clamp(Number(coordinate[1]), 0, WIDTH),
      y: clamp(Number(coordinate[2]), 0, HEIGHT),
    };
  }

  const horizontal = /左|左侧|左边/.test(command)
    ? "left"
    : /右|右侧|右边/.test(command)
      ? "right"
      : "center";
  const vertical = /上|顶|顶部|上方/.test(command)
    ? "top"
    : /下|底|底部|下方/.test(command)
      ? "bottom"
      : "middle";

  const xMap = {
    left: WIDTH * 0.24,
    center: WIDTH * 0.5,
    right: WIDTH * 0.76,
  };
  const yMap = {
    top: HEIGHT * 0.24,
    middle: HEIGHT * 0.5,
    bottom: HEIGHT * 0.74,
  };

  if (/中间|中央|中心|正中|画面中央/.test(command)) {
    return { x: WIDTH * 0.5, y: HEIGHT * 0.5 };
  }

  return { x: xMap[horizontal], y: yMap[vertical] };
}

function findSize(command) {
  const numberMatch = command.match(/(\d+)(像素|px|大小|半径|边长)?/i);
  if (numberMatch) {
    return clamp(Number(numberMatch[1]), 20, 260);
  }
  if (/很大|巨大|大/.test(command)) return 150;
  if (/很小|小/.test(command)) return 55;
  if (/中等|普通/.test(command)) return 95;
  return 100;
}

function findCount(command) {
  const digitMatch = command.match(/(\d+)(个|只|朵|颗|棵|座|条|轮)?/);
  if (digitMatch) return clamp(Number(digitMatch[1]), 1, 12);

  const unitPattern = countUnits.join("|");
  const chineseMatch = command.match(new RegExp(`([一二两三四五六七八九十]+)(${unitPattern})`));
  if (chineseMatch) return clamp(parseChineseNumber(chineseMatch[1]), 1, 12);

  return 1;
}

function findLineWidth(command) {
  if (/细/.test(command)) return 3;
  if (/粗/.test(command)) return 12;
  return state.lineWidth;
}

function findDirection(command) {
  if (/左到右|向右|水平/.test(command)) return "right";
  if (/右到左|向左/.test(command)) return "left";
  if (/上到下|向下|竖/.test(command)) return "down";
  if (/下到上|向上/.test(command)) return "up";
  return "right";
}

function extractText(command) {
  const cleaned = command
    .replace(/^(写|写上|添加|加上|输入|画|绘制)?(一段|一些|几个)?(文字|文本|标题|字)?/, "")
    .replace(/在(左上角?|右上角?|左下角?|右下角?|中间|中央|中心|正中|画面中央|上方|下方|顶部|底部|左边|右边|左侧|右侧).*/, "")
    .trim();
  return cleaned || "Voice Canvas";
}

function parseChineseNumber(text) {
  if (numberWords.has(text)) return numberWords.get(text);
  if (!text.includes("十")) return numberWords.get(text) || 1;

  const [tensText, onesText] = text.split("十");
  const tens = tensText ? numberWords.get(tensText) || 1 : 1;
  const ones = onesText ? numberWords.get(onesText) || 0 : 0;
  return tens * 10 + ones;
}

function drawRepeatedShape(shape, options) {
  const spacing = Math.max(options.size * 0.82, 54);
  const totalWidth = (options.count - 1) * spacing;
  for (let index = 0; index < options.count; index += 1) {
    const offsetX = index * spacing - totalWidth / 2;
    const offsetY = options.count > 1 && index % 2 ? -options.size * 0.16 : 0;
    drawShape(shape, {
      ...options,
      position: {
        x: clamp(options.position.x + offsetX, 42, WIDTH - 42),
        y: clamp(options.position.y + offsetY, 42, HEIGHT - 42),
      },
    });
  }
}

function drawShape(shape, options) {
  const { x, y } = options.position;
  const size = options.size;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = options.lineWidth;
  ctx.strokeStyle = options.color.value;
  ctx.fillStyle = options.color.value;

  const drawers = {
    circle: () => drawCircle(x, y, size * 0.45, options.mode),
    square: () => drawRect(x - size * 0.45, y - size * 0.45, size * 0.9, size * 0.9, options.mode),
    rectangle: () => drawRect(x - size * 0.62, y - size * 0.36, size * 1.24, size * 0.72, options.mode),
    triangle: () => drawTriangle(x, y, size, options.mode),
    line: () => drawLine(x, y, size, options.direction),
    star: () => drawStar(x, y, size * 0.48, size * 0.22, options.mode),
    heart: () => drawHeart(x, y, size, options.mode),
    cloud: () => drawCloud(x, y, size, options.mode),
    sun: () => drawSun(x, y, size),
    tree: () => drawTree(x, y, size),
    house: () => drawHouse(x, y, size),
    flower: () => drawFlower(x, y, size),
    mountain: () => drawMountain(x, y, size, options.mode),
  };

  drawers[shape]?.();
  ctx.restore();
}

function drawCircle(x, y, radius, mode) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  paint(mode);
}

function drawRect(x, y, width, height, mode) {
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  paint(mode);
}

function drawTriangle(x, y, size, mode) {
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.55);
  ctx.lineTo(x + size * 0.56, y + size * 0.48);
  ctx.lineTo(x - size * 0.56, y + size * 0.48);
  ctx.closePath();
  paint(mode);
}

function drawLine(x, y, size, direction) {
  const vector = {
    right: [size, 0],
    left: [-size, 0],
    down: [0, size],
    up: [0, -size],
  }[direction];
  ctx.beginPath();
  ctx.moveTo(x - vector[0] / 2, y - vector[1] / 2);
  ctx.lineTo(x + vector[0] / 2, y + vector[1] / 2);
  ctx.stroke();
}

function drawStar(x, y, outerRadius, innerRadius, mode) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  paint(mode);
}

function drawHeart(x, y, size, mode) {
  const scale = size / 110;
  ctx.beginPath();
  ctx.moveTo(x, y + 34 * scale);
  ctx.bezierCurveTo(x - 80 * scale, y - 24 * scale, x - 44 * scale, y - 74 * scale, x, y - 34 * scale);
  ctx.bezierCurveTo(x + 44 * scale, y - 74 * scale, x + 80 * scale, y - 24 * scale, x, y + 34 * scale);
  ctx.closePath();
  paint(mode);
}

function drawCloud(x, y, size, mode) {
  const r = size * 0.24;
  ctx.beginPath();
  ctx.arc(x - r * 1.45, y + r * 0.18, r, Math.PI * 0.85, Math.PI * 1.85);
  ctx.arc(x - r * 0.45, y - r * 0.5, r * 1.16, Math.PI, Math.PI * 1.9);
  ctx.arc(x + r * 0.7, y - r * 0.52, r * 1.25, Math.PI * 1.12, Math.PI * 2.05);
  ctx.arc(x + r * 1.7, y + r * 0.18, r, Math.PI * 1.18, Math.PI * 0.22);
  ctx.lineTo(x - r * 1.45, y + r * 1.18);
  ctx.closePath();
  paint(mode);
}

function drawSun(x, y, size) {
  const radius = size * 0.32;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = Math.max(4, size * 0.06);
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 1.32, y + Math.sin(angle) * radius * 1.32);
    ctx.lineTo(x + Math.cos(angle) * radius * 1.78, y + Math.sin(angle) * radius * 1.78);
    ctx.stroke();
  }
  ctx.restore();
  drawCircle(x, y, radius, "fill");
}

function drawTree(x, y, size) {
  const primaryColor = ctx.fillStyle;
  ctx.save();
  ctx.fillStyle = "#8b5a33";
  ctx.fillRect(x - size * 0.1, y + size * 0.12, size * 0.2, size * 0.45);
  ctx.fillStyle = primaryColor;
  drawCircle(x, y - size * 0.08, size * 0.34, "fill");
  drawCircle(x - size * 0.24, y + size * 0.04, size * 0.26, "fill");
  drawCircle(x + size * 0.24, y + size * 0.04, size * 0.26, "fill");
  ctx.restore();
}

function drawHouse(x, y, size) {
  const primaryColor = ctx.fillStyle;
  ctx.save();
  ctx.fillStyle = primaryColor;
  drawRect(x - size * 0.46, y - size * 0.02, size * 0.92, size * 0.58, "fill");
  ctx.fillStyle = "#8b5a33";
  drawTriangle(x, y - size * 0.2, size * 1.08, "fill");
  ctx.fillStyle = "#fffdfa";
  drawRect(x - size * 0.12, y + size * 0.2, size * 0.24, size * 0.36, "fill");
  ctx.restore();
}

function drawFlower(x, y, size) {
  const primaryColor = ctx.fillStyle;
  ctx.save();
  ctx.strokeStyle = "#3d9b58";
  ctx.lineWidth = Math.max(4, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.12);
  ctx.lineTo(x, y + size * 0.52);
  ctx.stroke();
  ctx.fillStyle = primaryColor;
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    drawCircle(x + Math.cos(angle) * size * 0.2, y - size * 0.06 + Math.sin(angle) * size * 0.2, size * 0.14, "fill");
  }
  ctx.fillStyle = "#f3c13a";
  drawCircle(x, y - size * 0.06, size * 0.12, "fill");
  ctx.restore();
}

function drawMountain(x, y, size, mode) {
  ctx.beginPath();
  ctx.moveTo(x - size * 0.72, y + size * 0.42);
  ctx.lineTo(x - size * 0.22, y - size * 0.45);
  ctx.lineTo(x + size * 0.08, y + size * 0.12);
  ctx.lineTo(x + size * 0.36, y - size * 0.36);
  ctx.lineTo(x + size * 0.76, y + size * 0.42);
  ctx.closePath();
  paint(mode);
}

function drawText(text, options) {
  const { x, y } = options.position;
  ctx.save();
  ctx.fillStyle = options.color.value;
  ctx.font = `700 ${Math.max(24, options.size * 0.28)}px "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y, Math.min(WIDTH * 0.86, options.size * 5));
  ctx.restore();
}

function paint(mode) {
  if (mode === "stroke") {
    ctx.stroke();
  } else {
    ctx.fill();
  }
}

function shapeLabel(shape) {
  const labels = {
    circle: "圆形",
    square: "正方形",
    rectangle: "矩形",
    triangle: "三角形",
    line: "线条",
    star: "星星",
    heart: "爱心",
    cloud: "云朵",
    sun: "太阳",
    tree: "树",
    house: "房子",
    flower: "花朵",
    mountain: "山峰",
  };
  return labels[shape] || shape;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const number = Number.parseInt(value, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

micButton.addEventListener("click", toggleListening);
initCanvas();
setupSpeechRecognition();
