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
const historyCount = document.querySelector("#historyCount");
const undoState = document.querySelector("#undoState");
const redoState = document.querySelector("#redoState");
const latestResult = document.querySelector("#latestResult");

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
  elements: [],
  baseImage: null,
  baseBackground: "#fffdfa",
  rendering: false,
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

const countUnits = ["个", "只", "朵", "颗", "棵", "座", "条", "轮", "位", "名"];
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
  { shape: "person", keys: ["人物", "人", "男孩", "女孩", "男生", "女生", "男人", "女人", "老人", "老头", "老太太", "爷爷", "奶奶", "小孩", "孩子", "自己"] },
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

const speechCorrectionRules = [
  [/眼视|演试|掩饰|演是|演事/g, "演示"],
  [/带眼镜|带眼睛|戴眼睛/g, "戴眼镜"],
  [/羽毛求|羽毛秋|羽毛就|羽毛酋/g, "羽毛球"],
  [/兰色|篮色/g, "蓝色"],
  [/浅兰|浅篮/g, "浅蓝"],
  [/绿艹|旅色|率色/g, "绿色"],
  [/左上脚|左上叫/g, "左上角"],
  [/右上脚|右上叫/g, "右上角"],
  [/左下脚|左下叫/g, "左下角"],
  [/右下脚|右下叫/g, "右下角"],
  [/座边|坐边|左面/g, "左边"],
  [/又边|右面/g, "右边"],
  [/撤消|撤小|扯销/g, "撤销"],
  [/种做|从做|重作|重新做/g, "重做"],
  [/清孔|清空格/g, "清空"],
  [/倒出|到处|导处/g, "导出"],
  [/修该/g, "修改"],
  [/改称|改城/g, "改成"],
  [/原素/g, "元素"],
  [/上意/g, "上衣"],
  [/下妆/g, "下装"],
];

function initCanvas() {
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  resetElementBase();
  saveSnapshot("初始化画布", false);
  updateStatePanel();
}

function saveSnapshot(label, clearRedo = true) {
  state.history.push({
    label,
    image: ctx.getImageData(0, 0, WIDTH, HEIGHT),
    elements: cloneDrawingData(state.elements),
    baseImage: state.baseImage,
    baseBackground: state.baseBackground,
    background: state.background,
  });
  if (state.history.length > 60) {
    state.history.shift();
  }
  if (clearRedo) {
    state.redoStack = [];
  }
  updateStatePanel();
}

function restoreSnapshot(snapshot) {
  ctx.putImageData(snapshot.image, 0, 0);
  state.elements = cloneDrawingData(snapshot.elements || []);
  state.baseImage = snapshot.baseImage || null;
  state.baseBackground = snapshot.baseBackground || snapshot.background || state.background;
  state.background = snapshot.background || state.baseBackground;
}

function cloneDrawingData(value) {
  return JSON.parse(JSON.stringify(value));
}

function resetElementBase() {
  state.elements = [];
  state.baseImage = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  state.baseBackground = state.background;
}

function addElement(element) {
  if (state.rendering) return;
  state.elements.push(cloneDrawingData(element));
}

function renderElementsFromBase() {
  if (state.baseImage) {
    ctx.putImageData(state.baseImage, 0, 0);
    state.background = state.baseBackground;
  } else {
    ctx.fillStyle = state.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  state.rendering = true;
  try {
    state.elements.forEach((element) => {
      if (element.type === "shape") {
        drawShape(element.shape, element.options);
      }
      if (element.type === "text") {
        drawText(element.text, element.options);
      }
    });
  } finally {
    state.rendering = false;
  }
}

function logCommand(message, type = "ok") {
  const item = document.createElement("li");
  const status = type === "ok" ? "完成" : "提示";
  item.innerHTML = `<span class="${type}">${status}</span> ${escapeHtml(message)}`;
  commandLog.prepend(item);
  latestResult.textContent = `${status}：${message}`;
  latestResult.className = `latest-result ${type}`;
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
  historyCount.textContent = `${Math.max(state.history.length - 1, 0)} 步`;
  undoState.textContent = state.history.length > 1 ? "可撤销" : "无";
  redoState.textContent = state.redoStack.length > 0 ? "可重做" : "无";
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
  const normalized = text
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
  return applySpeechCorrections(normalized);
}

function applySpeechCorrections(text) {
  return speechCorrectionRules.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
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

function isBadmintonSceneCommand(command) {
  if (/羽毛球|球拍|球网|羽毛球场/.test(command)) return true;
  if (/(篮球|足球|乒乓|网球|排球)/.test(command)) return false;
  return /(球场|运动场|体育场|体育馆).*(打球|运动)|打球.*(球场|运动场|体育场|体育馆)/.test(command);
}

function isEditRecentPersonCommand(command) {
  return (
    /(修改|改成|改为|换成|换为|变成|调整|改|换)/.test(command) &&
    /(上衣|衣服|T恤|短袖|衬衫|卫衣|外套|毛衣|裤子|短裤|长裤|裙子|短裙|长裙|下装|鞋|鞋子|运动鞋|球鞋|跑鞋|靴子|凉鞋|皮鞋|帽子|帽)/.test(command)
  );
}

function isDeleteRecentElementCommand(command) {
  return (
    /(删除|删掉|去掉|移除|擦掉)/.test(command) &&
    (/(最近|刚才|上一个|最后|元素|图形|画的|人物|文字)/.test(command) || Boolean(findShape(command)))
  );
}

function executeCommand(command) {
  if (!command) return false;

  if (isEditRecentPersonCommand(command)) {
    return editRecentPerson(command);
  }

  if (isDeleteRecentElementCommand(command)) {
    return deleteRecentElement(command);
  }

  if (isBadmintonSceneCommand(command)) {
    playBadmintonScene(command);
    return true;
  }

  if (/播放(演示|眼视|演试|掩饰)|开始(演示|眼视|演试|掩饰)|(演示|眼视|演试|掩饰)模式|(演示|眼视|演试|掩饰)一下|示范|样例|示例|demo/i.test(command)) {
    playDemoScene();
    return true;
  }

  if (/帮助|说明|指令/.test(command)) {
    logCommand("支持形状、颜色、位置、数量、背景、文字、演示、修改指定人物、删除指定元素、撤销、重做和导出指令");
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
    const label = shape === "person" ? personLabel(options.person) : shapeLabel(shape);
    const colorName = shape === "person" ? options.person.clothingColor.name : options.color.name;
    drawRepeatedShape(shape, options);
    saveSnapshot(`${label} x ${options.count}`);
    logCommand(`绘制 ${options.count} 个${label}，颜色 ${colorName}`);
    return true;
  }

  logCommand(`暂未理解：${command}`, "warn");
  return false;
}

function editRecentPerson(command) {
  const target = findPersonEditTarget(command);
  if (!target) {
    logCommand("请说明要修改人物的上衣、下装、鞋子或帽子", "warn");
    return false;
  }

  const element = findTargetPersonElement(command);
  if (!element) {
    logCommand("当前没有找到可修改的人物，请先画一个人物或换个位置描述", "warn");
    return false;
  }

  const color = findReplacementColor(command);
  const person = element.options.person;
  let changed = false;

  if (target === "top") {
    if (color) {
      person.topColor = color;
      person.clothingColor = color;
      element.options.color = color;
      changed = true;
    }
    if (hasTopType(command)) {
      person.topType = parseTopType(command);
      changed = true;
    }
  }

  if (target === "bottom") {
    if (color) {
      person.bottomColor = color;
      changed = true;
    }
    if (hasBottomType(command)) {
      person.bottomType = parseBottomType(command);
      changed = true;
    }
  }

  if (target === "shoe") {
    if (color) {
      person.shoeColor = color;
      changed = true;
    }
    if (hasShoeType(command)) {
      person.shoeType = parseShoeType(command);
      changed = true;
    }
  }

  if (target === "hat") {
    person.hat = true;
    if (color) {
      person.hatColor = color;
      changed = true;
    }
    if (hasHatType(command)) {
      person.hatType = parseHatType(command);
      changed = true;
    }
  }

  if (!changed) {
    logCommand("请说明要改成什么颜色或类型", "warn");
    return false;
  }

  renderElementsFromBase();
  const targetText = editTargetLabel(target);
  const colorText = color ? color.name : "";
  const scopeText = targetScopeLabel(command);
  saveSnapshot(`修改${scopeText}人物${targetText}`);
  logCommand(`已将${scopeText}人物的${targetText}改为${colorText || "新类型"}`);
  return true;
}

function deleteRecentElement(command = "") {
  const index = findTargetElementIndex(command);
  if (index === -1) {
    logCommand("当前没有找到可删除的元素，请先画图或换个目标描述", "warn");
    return false;
  }

  const [removed] = state.elements.splice(index, 1);
  renderElementsFromBase();
  const label = elementLabel(removed);
  const scopeText = targetScopeLabel(command);
  saveSnapshot(`删除${scopeText}${label}`);
  logCommand(`删除${scopeText}${label}`);
  return true;
}

function undo() {
  if (state.history.length <= 1) {
    logCommand("已经没有可撤销的步骤", "warn");
    return false;
  }
  const current = state.history.pop();
  state.redoStack.push(current);
  restoreSnapshot(state.history[state.history.length - 1]);
  updateStatePanel();
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
  updateStatePanel();
  logCommand("恢复上一项绘图");
  return true;
}

function clearCanvas() {
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  resetElementBase();
  saveSnapshot("清空画布");
  logCommand("清空画布");
}

function playDemoScene() {
  const previousColor = state.color;
  const previousColorName = state.colorName;
  const previousMode = state.mode;
  const previousLineWidth = state.lineWidth;

  const sky = { name: "浅蓝色", value: "#cdeef5" };
  state.background = sky.value;
  ctx.fillStyle = sky.value;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawShape("sun", demoOptions("黄色", WIDTH * 0.18, HEIGHT * 0.2, 130));
  drawRepeatedShape("cloud", {
    ...demoOptions("白色", WIDTH * 0.58, HEIGHT * 0.22, 120),
    count: 3,
  });
  drawRepeatedShape("mountain", {
    ...demoOptions("绿色", WIDTH * 0.5, HEIGHT * 0.72, 190),
    count: 3,
  });
  drawShape("house", demoOptions("红色", WIDTH * 0.72, HEIGHT * 0.66, 150));
  drawRepeatedShape("tree", {
    ...demoOptions("绿色", WIDTH * 0.28, HEIGHT * 0.66, 110),
    count: 2,
  });
  drawRepeatedShape("flower", {
    ...demoOptions("粉色", WIDTH * 0.45, HEIGHT * 0.78, 70),
    count: 5,
  });
  drawText("Voice Canvas", {
    ...demoOptions("黑色", WIDTH * 0.5, HEIGHT * 0.46, 150),
    mode: "fill",
  });

  state.color = previousColor;
  state.colorName = previousColorName;
  state.mode = previousMode;
  state.lineWidth = previousLineWidth;
  resetElementBase();
  updateStatePanel();
  saveSnapshot("语音演示场景");
  logCommand("播放演示场景：天空、太阳、云、山、房子、树、花和标题");
}

function playBadmintonScene(command) {
  const previousColor = state.color;
  const previousColorName = state.colorName;
  const previousMode = state.mode;
  const previousLineWidth = state.lineWidth;

  drawBadmintonCourt();

  const playerColor = colors.find((item) => item.name === "蓝色");
  const opponentColor = colors.find((item) => item.name === "红色");
  drawShape("person", {
    ...demoOptions("蓝色", WIDTH * 0.34, HEIGHT * 0.64, 136),
    person: parsePersonAttributes(buildBadmintonPlayerCommand(command), playerColor),
  });
  drawBadmintonRacket(WIDTH * 0.43, HEIGHT * 0.55, 118, 1);

  drawShape("person", {
    ...demoOptions("红色", WIDTH * 0.68, HEIGHT * 0.39, 104),
    person: parsePersonAttributes("穿红色T恤黑色短裤白色运动鞋的人", opponentColor),
  });
  drawBadmintonRacket(WIDTH * 0.62, HEIGHT * 0.33, 86, -1);
  drawShuttlecock(WIDTH * 0.52, HEIGHT * 0.38, 70);
  drawText("羽毛球场景", {
    ...demoOptions("黑色", WIDTH * 0.5, HEIGHT * 0.1, 110),
    mode: "fill",
  });

  state.color = previousColor;
  state.colorName = previousColorName;
  state.mode = previousMode;
  state.lineWidth = previousLineWidth;
  resetElementBase();
  updateStatePanel();
  saveSnapshot("羽毛球运动场景");
  logCommand("生成羽毛球场景：球场、球网、人物、球拍和羽毛球");
}

function buildBadmintonPlayerCommand(command) {
  let details = command;
  if (!/(人物|人|自己|男孩|女孩|男生|女生|男人|女人|老人|老头|老太太|爷爷|奶奶|小孩|孩子)/.test(details)) {
    details += " 自己";
  }
  if (!/(上衣|衣服|T恤|短袖|衬衫|卫衣|外套|毛衣)/.test(details)) {
    details += " 蓝色T恤";
  }
  if (!/(裤子|短裤|长裤|裙子|短裙|长裙|下装)/.test(details)) {
    details += " 黑色短裤";
  }
  if (!/(鞋|鞋子|运动鞋|球鞋|跑鞋|靴子|凉鞋|皮鞋)/.test(details)) {
    details += " 白色运动鞋";
  }
  return details;
}

function drawBadmintonCourt() {
  const courtX = WIDTH * 0.12;
  const courtY = HEIGHT * 0.17;
  const courtWidth = WIDTH * 0.76;
  const courtHeight = HEIGHT * 0.68;
  const netY = courtY + courtHeight * 0.48;

  state.background = "#d7efd8";
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#53b76d";
  drawRect(courtX, courtY, courtWidth, courtHeight, "fill");
  ctx.strokeStyle = "#fffdfa";
  ctx.lineWidth = 5;
  drawRect(courtX, courtY, courtWidth, courtHeight, "stroke");

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(courtX + courtWidth * 0.18, courtY);
  ctx.lineTo(courtX + courtWidth * 0.18, courtY + courtHeight);
  ctx.moveTo(courtX + courtWidth * 0.82, courtY);
  ctx.lineTo(courtX + courtWidth * 0.82, courtY + courtHeight);
  ctx.moveTo(courtX, courtY + courtHeight * 0.22);
  ctx.lineTo(courtX + courtWidth, courtY + courtHeight * 0.22);
  ctx.moveTo(courtX, courtY + courtHeight * 0.78);
  ctx.lineTo(courtX + courtWidth, courtY + courtHeight * 0.78);
  ctx.moveTo(courtX + courtWidth * 0.5, courtY);
  ctx.lineTo(courtX + courtWidth * 0.5, courtY + courtHeight);
  ctx.stroke();

  drawBadmintonNet(courtX, netY, courtWidth, courtHeight);
}

function drawBadmintonNet(courtX, netY, courtWidth, courtHeight) {
  const postHeight = courtHeight * 0.16;
  ctx.save();
  ctx.strokeStyle = "#263238";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(courtX - 10, netY - postHeight * 0.5);
  ctx.lineTo(courtX - 10, netY + postHeight * 0.5);
  ctx.moveTo(courtX + courtWidth + 10, netY - postHeight * 0.5);
  ctx.lineTo(courtX + courtWidth + 10, netY + postHeight * 0.5);
  ctx.moveTo(courtX, netY);
  ctx.lineTo(courtX + courtWidth, netY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 12; i += 1) {
    const x = courtX + (courtWidth * i) / 12;
    ctx.beginPath();
    ctx.moveTo(x, netY - postHeight * 0.42);
    ctx.lineTo(x, netY + postHeight * 0.42);
    ctx.stroke();
  }
  for (let i = -2; i <= 2; i += 1) {
    const y = netY + (postHeight * i) / 5;
    ctx.beginPath();
    ctx.moveTo(courtX, y);
    ctx.lineTo(courtX + courtWidth, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBadmintonRacket(x, y, size, flip) {
  const headX = x + flip * size * 0.24;
  const headY = y - size * 0.22;
  const handleStartX = x - flip * size * 0.24;
  const handleStartY = y + size * 0.3;
  const handleEndX = x + flip * size * 0.08;
  const handleEndY = y - size * 0.02;
  const radius = size * 0.17;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = Math.max(4, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(handleStartX, handleStartY);
  ctx.lineTo(handleEndX, handleEndY);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = Math.max(3, size * 0.028);
  ctx.beginPath();
  ctx.arc(headX, headY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(75,85,99,0.72)";
  ctx.lineWidth = Math.max(1.5, size * 0.012);
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(headX + i * radius * 0.34, headY - radius * 0.78);
    ctx.lineTo(headX + i * radius * 0.34, headY + radius * 0.78);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headX - radius * 0.78, headY + i * radius * 0.34);
    ctx.lineTo(headX + radius * 0.78, headY + i * radius * 0.34);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShuttlecock(x, y, size) {
  const corkX = x + size * 0.22;
  const corkY = y + size * 0.16;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.fillStyle = "#fffdfa";
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = Math.max(2, size * 0.028);
  ctx.beginPath();
  ctx.moveTo(corkX - size * 0.08, corkY - size * 0.04);
  ctx.lineTo(x - size * 0.38, y - size * 0.3);
  ctx.lineTo(x - size * 0.12, y - size * 0.43);
  ctx.lineTo(corkX + size * 0.04, corkY - size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - size * 0.34, y - size * 0.28);
  ctx.lineTo(corkX - size * 0.03, corkY - size * 0.08);
  ctx.moveTo(x - size * 0.22, y - size * 0.36);
  ctx.lineTo(corkX - size * 0.02, corkY - size * 0.08);
  ctx.moveTo(x - size * 0.12, y - size * 0.42);
  ctx.lineTo(corkX + size * 0.02, corkY - size * 0.08);
  ctx.stroke();

  ctx.fillStyle = "#f3c13a";
  drawCircle(corkX, corkY, size * 0.08, "fill");
  ctx.restore();
}

function demoOptions(colorName, x, y, size) {
  const color = colors.find((item) => item.name === colorName) || colors[0];
  return {
    color,
    position: { x, y },
    size,
    count: 1,
    mode: "fill",
    lineWidth: state.lineWidth,
    direction: "right",
  };
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
  resetElementBase();
  saveSnapshot(`背景：${color.name}`);
  logCommand(`背景改为${color.name}`);
}

function parseOptions(command) {
  const detectedColor = findColor(command);
  const color = detectedColor || {
    name: state.colorName,
    value: state.color,
  };
  const defaultPersonColor = detectedColor || colors.find((item) => item.name === "蓝色");
  return {
    color,
    position: findPosition(command),
    size: findSize(command),
    count: findCount(command),
    person: parsePersonAttributes(command, defaultPersonColor),
    source: command,
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

function findColorMentions(command) {
  const mentions = [];
  colors.forEach((color) => {
    color.keys.forEach((key) => {
      let searchFrom = 0;
      while (searchFrom < command.length) {
        const index = command.indexOf(key, searchFrom);
        if (index === -1) break;
        mentions.push({ color, index, length: key.length });
        searchFrom = index + key.length;
      }
    });
  });
  mentions.sort((a, b) => a.index - b.index || b.length - a.length);
  return mentions;
}

function findReplacementColor(command) {
  const mentions = findColorMentions(command);
  if (!mentions.length) return null;

  const markers = ["修改为", "改成", "改为", "换成", "换为", "变成", "调整为", "为", "成", "改", "换"];
  const markerEnd = markers.reduce((latest, marker) => {
    const index = command.lastIndexOf(marker);
    return index === -1 ? latest : Math.max(latest, index + marker.length);
  }, -1);

  const afterMarker = mentions
    .filter((mention) => mention.index >= markerEnd)
    .sort((a, b) => a.index - b.index || b.length - a.length);
  return afterMarker[0]?.color || mentions[mentions.length - 1].color;
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

function parsePersonAttributes(command, defaultColor) {
  const gender = /女孩|女生|女人|女性|奶奶|老太太|女/.test(command)
    ? "female"
    : /男孩|男生|男人|男性|爷爷|老头|男/.test(command)
      ? "male"
      : "neutral";
  const age = /老人|老年|爷爷|奶奶|老头|老太太/.test(command)
    ? "elder"
    : /小孩|孩子|儿童|男孩|女孩/.test(command)
      ? "child"
      : /少年|青少年|学生/.test(command)
        ? "teen"
        : "adult";
  const hair = /光头|秃头/.test(command)
    ? "bald"
    : /马尾/.test(command)
      ? "ponytail"
      : /卷发/.test(command)
        ? "curly"
        : /长发/.test(command)
          ? "long"
          : /短发/.test(command)
            ? "short"
            : gender === "female"
              ? "long"
              : "short";
  const height = /高个子|很高|高高|高的/.test(command)
    ? "tall"
    : /矮个子|很矮|矮小|矮的/.test(command)
      ? "short"
      : "normal";
  const build = /微胖|胖|圆润/.test(command)
    ? "chubby"
    : /强壮|健壮|壮/.test(command)
      ? "strong"
      : /瘦|苗条/.test(command)
        ? "slim"
        : "normal";
  const skin = /深肤色|皮肤偏深|深色皮肤|黑皮肤|小麦色/.test(command)
    ? "deep"
    : /浅肤色|皮肤白|白皮肤|白皙|浅色皮肤/.test(command)
      ? "light"
      : "medium";
  const clothingColor = findClothingColor(command) || defaultColor || colors.find((item) => item.name === "蓝色");
  const topColor = findColorByTargets(command, ["上衣", "衣服", "T恤", "短袖", "衬衫", "卫衣", "外套", "毛衣"]) || clothingColor;
  const bottomColor = findColorByTargets(command, ["裤子", "长裤", "短裤", "裙子", "短裙", "长裙", "下装"]) || colors.find((item) => item.name === "灰色");
  const shoeColor = findColorByTargets(command, ["鞋", "鞋子", "运动鞋", "皮鞋", "靴子", "凉鞋"]) || colors.find((item) => item.name === "黑色");
  const hatColor = findColorByTargets(command, ["帽子", "帽", "鸭舌帽", "棒球帽", "渔夫帽", "毛线帽", "草帽", "头盔"]) || topColor;

  return {
    gender,
    age,
    hair,
    height,
    build,
    skin,
    glasses: /眼镜/.test(command) && !/不戴眼镜|没戴眼镜|无眼镜/.test(command),
    clothingColor,
    topType: parseTopType(command),
    topColor,
    bottomType: parseBottomType(command),
    bottomColor,
    shoeType: parseShoeType(command),
    shoeColor,
    hat: /帽子|戴帽|帽/.test(command) && !/不戴帽|没戴帽|无帽/.test(command),
    hatType: parseHatType(command),
    hatColor,
  };
}

function findClothingColor(command) {
  const color = findColor(command);
  if (!color) return null;
  if (/衣服|上衣|衣|裙|外套|T恤|服装/.test(command)) return color;
  if (/肤色|皮肤/.test(command)) return null;
  return color;
}

function findColorByTargets(command, targets) {
  const matches = [];
  colors.forEach((color) => {
    color.keys.forEach((key) => {
      targets.forEach((target) => {
        let searchFrom = 0;
        while (searchFrom < command.length) {
          const colorIndex = command.indexOf(key, searchFrom);
          if (colorIndex === -1) break;
          const targetIndex = command.indexOf(target);
          if (targetIndex !== -1 && Math.abs(colorIndex - targetIndex) <= 6) {
            matches.push({ color, distance: Math.abs(colorIndex - targetIndex), length: key.length });
          }
          searchFrom = colorIndex + key.length;
        }
      });
    });
  });
  matches.sort((a, b) => a.distance - b.distance || b.length - a.length);
  return matches[0]?.color;
}

function parseTopType(command) {
  if (/卫衣/.test(command)) return "hoodie";
  if (/外套|夹克/.test(command)) return "jacket";
  if (/衬衫/.test(command)) return "shirt";
  if (/毛衣/.test(command)) return "sweater";
  if (/T恤|短袖/.test(command)) return "tshirt";
  return "top";
}

function parseBottomType(command) {
  if (/短裙/.test(command)) return "shortSkirt";
  if (/长裙/.test(command)) return "longSkirt";
  if (/裙子|半身裙/.test(command)) return "skirt";
  if (/短裤/.test(command)) return "shorts";
  if (/长裤|裤子|牛仔裤|运动裤/.test(command)) return "pants";
  return "pants";
}

function parseHatType(command) {
  if (/头盔|安全帽/.test(command)) return "helmet";
  if (/渔夫帽/.test(command)) return "bucket";
  if (/毛线帽|针织帽/.test(command)) return "beanie";
  if (/草帽|宽檐帽|遮阳帽/.test(command)) return "wideBrim";
  if (/鸭舌帽|棒球帽/.test(command)) return "baseball";
  return "baseball";
}

function parseShoeType(command) {
  if (/靴子|短靴|长靴/.test(command)) return "boots";
  if (/凉鞋/.test(command)) return "sandals";
  if (/皮鞋/.test(command)) return "dress";
  if (/运动鞋|跑鞋|球鞋/.test(command)) return "sneakers";
  return "sneakers";
}

function findTargetPersonElement(command) {
  const index = findTargetElementIndex(command, (element) => element.type === "shape" && element.shape === "person");
  return index === -1 ? null : state.elements[index];
}

function findRecentPersonElement() {
  for (let index = state.elements.length - 1; index >= 0; index -= 1) {
    const element = state.elements[index];
    if (element.type === "shape" && element.shape === "person") {
      return element;
    }
  }
  return null;
}

function findTargetElementIndex(command, customMatcher = null) {
  const matcher = customMatcher || buildElementMatcher(command);
  const indexes = [];
  for (let index = 0; index < state.elements.length; index += 1) {
    if (matcher(state.elements[index])) {
      indexes.push(index);
    }
  }
  if (!indexes.length) return -1;

  const targetPosition = findTargetPosition(command);
  if (!targetPosition) {
    return indexes[indexes.length - 1];
  }

  return indexes
    .map((index) => ({
      index,
      distance: distanceToTarget(state.elements[index], targetPosition),
    }))
    .sort((a, b) => a.distance - b.distance || b.index - a.index)[0].index;
}

function buildElementMatcher(command) {
  if (/文字|文本|标题|字/.test(command)) {
    return (element) => element.type === "text";
  }

  const shape = findShape(command);
  if (shape) {
    return (element) => element.type === "shape" && element.shape === shape;
  }

  return () => true;
}

function findTargetPosition(command) {
  const horizontal = /左上|左下|左边|左侧|左面/.test(command)
    ? "left"
    : /右上|右下|右边|右侧|右面/.test(command)
      ? "right"
      : /中间|中央|中心|正中/.test(command)
        ? "center"
        : null;
  const vertical = /左上|右上|上方|顶部|上面|上边|上侧/.test(command)
    ? "top"
    : /左下|右下|下方|底部|下面|下边|下侧/.test(command)
      ? "bottom"
      : /中间|中央|中心|正中/.test(command)
        ? "middle"
        : null;

  if (!horizontal && !vertical) return null;

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

  return {
    x: xMap[horizontal || "center"],
    y: yMap[vertical || "middle"],
  };
}

function distanceToTarget(element, targetPosition) {
  const position = element.options?.position;
  if (!position) return Number.POSITIVE_INFINITY;
  return (position.x - targetPosition.x) ** 2 + (position.y - targetPosition.y) ** 2;
}

function targetScopeLabel(command) {
  if (/最近|刚才|上一个|最后/.test(command)) return "最近";
  if (/左上/.test(command)) return "左上方";
  if (/右上/.test(command)) return "右上方";
  if (/左下/.test(command)) return "左下方";
  if (/右下/.test(command)) return "右下方";
  if (/左边|左侧|左面/.test(command)) return "左边";
  if (/右边|右侧|右面/.test(command)) return "右边";
  if (/上方|顶部|上面|上边|上侧/.test(command)) return "上方";
  if (/下方|底部|下面|下边|下侧/.test(command)) return "下方";
  if (/中间|中央|中心|正中/.test(command)) return "中间";
  return "最近";
}

function findPersonEditTarget(command) {
  if (/鞋|鞋子|运动鞋|球鞋|跑鞋|靴子|凉鞋|皮鞋/.test(command)) return "shoe";
  if (/裤子|短裤|长裤|裙子|短裙|长裙|下装/.test(command)) return "bottom";
  if (/帽子|帽/.test(command)) return "hat";
  if (/上衣|衣服|T恤|短袖|衬衫|卫衣|外套|毛衣/.test(command)) return "top";
  return null;
}

function hasTopType(command) {
  return /卫衣|外套|夹克|衬衫|毛衣|T恤|短袖/.test(command);
}

function hasBottomType(command) {
  return /短裙|长裙|裙子|半身裙|短裤|长裤|裤子|牛仔裤|运动裤/.test(command);
}

function hasHatType(command) {
  return /头盔|安全帽|渔夫帽|毛线帽|针织帽|草帽|宽檐帽|遮阳帽|鸭舌帽|棒球帽/.test(command);
}

function hasShoeType(command) {
  return /靴子|短靴|长靴|凉鞋|皮鞋|运动鞋|跑鞋|球鞋/.test(command);
}

function editTargetLabel(target) {
  const labels = {
    top: "上衣",
    bottom: "下装",
    shoe: "鞋子",
    hat: "帽子",
  };
  return labels[target] || "属性";
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
    person: () => drawPerson(x, y, size, options.person),
  };

  if (drawers[shape]) {
    drawers[shape]();
    addElement({ type: "shape", shape, options });
  }
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

function drawPerson(x, y, size, person) {
  const skinColors = {
    light: "#f5d0b5",
    medium: "#d79b70",
    deep: "#8b5a3c",
  };
  const hairColor = person.age === "elder" ? "#b8b8b8" : "#2f231f";
  const heightScale = {
    short: 0.86,
    normal: 1,
    tall: 1.18,
  }[person.height];
  const buildScale = {
    slim: 0.78,
    normal: 1,
    chubby: 1.28,
    strong: 1.2,
  }[person.build];
  const ageScale = person.age === "child" ? 0.84 : 1;
  const figureSize = size * 1.18 * ageScale;
  const totalHeight = figureSize * heightScale;
  const headRadius = figureSize * 0.18;
  const headY = y - totalHeight * 0.28;
  const shoulderY = headY + headRadius * 1.45;
  const torsoHeight = totalHeight * 0.34;
  const torsoWidth = figureSize * 0.34 * buildScale;
  const hipY = shoulderY + torsoHeight;
  const footY = y + totalHeight * 0.46;
  const skin = skinColors[person.skin] || skinColors.medium;
  const topColor = person.topColor?.value || person.clothingColor?.value || "#2f74d0";
  const bottomColor = person.bottomColor?.value || "#8f9399";
  const shoeColor = person.shoeColor?.value || "#222326";

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawPersonHairBase(x, headY, headRadius, person.hair, hairColor);

  ctx.fillStyle = skin;
  drawCircle(x, headY, headRadius, "fill");

  drawPersonHairCap(x, headY, headRadius, person.hair, hairColor);
  if (person.hat) {
    drawPersonHat(x, headY, headRadius, person.hatType, person.hatColor?.value || topColor);
  }
  drawPersonFace(x, headY, headRadius, person.glasses);

  ctx.strokeStyle = skin;
  ctx.lineWidth = Math.max(4, figureSize * 0.045);
  ctx.beginPath();
  ctx.moveTo(x - torsoWidth * 0.45, shoulderY + figureSize * 0.04);
  ctx.lineTo(x - torsoWidth * 0.78, hipY - figureSize * 0.06);
  ctx.moveTo(x + torsoWidth * 0.45, shoulderY + figureSize * 0.04);
  ctx.lineTo(x + torsoWidth * 0.78, hipY - figureSize * 0.06);
  ctx.stroke();

  drawPersonTop(x, shoulderY, torsoWidth, torsoHeight, figureSize, person.topType, topColor);
  drawPersonBottom(x, hipY, footY, torsoWidth, figureSize, person.bottomType, bottomColor);

  drawPersonShoes(x, footY, torsoWidth, figureSize, person.shoeType, shoeColor);

  if (person.age === "elder") {
    ctx.strokeStyle = "#8b5a33";
    ctx.lineWidth = Math.max(3, figureSize * 0.025);
    ctx.beginPath();
    ctx.moveTo(x + torsoWidth * 0.78, hipY - figureSize * 0.08);
    ctx.lineTo(x + torsoWidth * 0.98, footY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPersonTop(x, y, width, height, size, topType, color) {
  ctx.fillStyle = color;
  drawRect(x - width * 0.5, y, width, height, "fill");

  if (topType === "tshirt") {
    drawRect(x - width * 0.8, y + height * 0.08, width * 0.28, height * 0.24, "fill");
    drawRect(x + width * 0.52, y + height * 0.08, width * 0.28, height * 0.24, "fill");
  }

  if (topType === "shirt") {
    ctx.strokeStyle = "#fffdfa";
    ctx.lineWidth = Math.max(2, size * 0.018);
    ctx.beginPath();
    ctx.moveTo(x, y + height * 0.08);
    ctx.lineTo(x, y + height * 0.92);
    ctx.moveTo(x - width * 0.22, y + height * 0.08);
    ctx.lineTo(x, y + height * 0.22);
    ctx.lineTo(x + width * 0.22, y + height * 0.08);
    ctx.stroke();
  }

  if (topType === "hoodie") {
    ctx.strokeStyle = "#fffdfa";
    ctx.lineWidth = Math.max(2, size * 0.02);
    ctx.beginPath();
    ctx.arc(x, y + height * 0.12, width * 0.26, 0, Math.PI);
    ctx.moveTo(x - width * 0.12, y + height * 0.3);
    ctx.lineTo(x - width * 0.18, y + height * 0.56);
    ctx.moveTo(x + width * 0.12, y + height * 0.3);
    ctx.lineTo(x + width * 0.18, y + height * 0.56);
    ctx.stroke();
  }

  if (topType === "jacket") {
    ctx.strokeStyle = "#222326";
    ctx.lineWidth = Math.max(2, size * 0.017);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.moveTo(x - width * 0.35, y + height * 0.2);
    ctx.lineTo(x - width * 0.1, y + height * 0.46);
    ctx.moveTo(x + width * 0.35, y + height * 0.2);
    ctx.lineTo(x + width * 0.1, y + height * 0.46);
    ctx.stroke();
  }

  if (topType === "sweater") {
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = Math.max(1.5, size * 0.014);
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - width * 0.42, y + (height * i) / 4);
      ctx.lineTo(x + width * 0.42, y + (height * i) / 4);
      ctx.stroke();
    }
  }
}

function drawPersonBottom(x, hipY, footY, width, size, bottomType, color) {
  ctx.fillStyle = color;

  if (bottomType === "skirt" || bottomType === "shortSkirt" || bottomType === "longSkirt") {
    const skirtLength = bottomType === "longSkirt" ? size * 0.34 : bottomType === "shortSkirt" ? size * 0.18 : size * 0.26;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.42, hipY);
    ctx.lineTo(x + width * 0.42, hipY);
    ctx.lineTo(x + width * 0.66, hipY + skirtLength);
    ctx.lineTo(x - width * 0.66, hipY + skirtLength);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = Math.max(4, size * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - width * 0.2, hipY + skirtLength);
    ctx.lineTo(x - width * 0.3, footY);
    ctx.moveTo(x + width * 0.2, hipY + skirtLength);
    ctx.lineTo(x + width * 0.3, footY);
    ctx.stroke();
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = bottomType === "shorts" ? Math.max(7, size * 0.07) : Math.max(6, size * 0.06);
  const legEndY = bottomType === "shorts" ? hipY + size * 0.18 : footY - size * 0.04;
  ctx.beginPath();
  ctx.moveTo(x - width * 0.22, hipY);
  ctx.lineTo(x - width * 0.34, legEndY);
  ctx.moveTo(x + width * 0.22, hipY);
  ctx.lineTo(x + width * 0.34, legEndY);
  ctx.stroke();

  if (bottomType === "shorts") {
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = Math.max(4, size * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - width * 0.34, legEndY);
    ctx.lineTo(x - width * 0.34, footY);
    ctx.moveTo(x + width * 0.34, legEndY);
    ctx.lineTo(x + width * 0.34, footY);
    ctx.stroke();
  }
}

function drawPersonShoes(x, footY, width, size, shoeType, color) {
  ctx.fillStyle = color;
  const shoeWidth = Math.max(10, size * 0.12);
  const shoeHeight = Math.max(5, size * 0.045);

  if (shoeType === "boots") {
    drawRect(x - width * 0.45, footY - shoeHeight * 1.6, shoeWidth * 0.82, shoeHeight * 1.6, "fill");
    drawRect(x + width * 0.2, footY - shoeHeight * 1.6, shoeWidth * 0.82, shoeHeight * 1.6, "fill");
  }

  if (shoeType === "sandals") {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.018);
    ctx.beginPath();
    ctx.moveTo(x - width * 0.46, footY);
    ctx.lineTo(x - width * 0.46 + shoeWidth, footY);
    ctx.moveTo(x - width * 0.42, footY - shoeHeight * 0.5);
    ctx.lineTo(x - width * 0.36, footY + shoeHeight * 0.25);
    ctx.moveTo(x + width * 0.18, footY);
    ctx.lineTo(x + width * 0.18 + shoeWidth, footY);
    ctx.moveTo(x + width * 0.22, footY - shoeHeight * 0.5);
    ctx.lineTo(x + width * 0.28, footY + shoeHeight * 0.25);
    ctx.stroke();
    return;
  }

  drawRect(x - width * 0.46, footY - shoeHeight * 0.25, shoeWidth, shoeHeight, "fill");
  drawRect(x + width * 0.18, footY - shoeHeight * 0.25, shoeWidth, shoeHeight, "fill");

  if (shoeType === "sneakers") {
    ctx.strokeStyle = "#fffdfa";
    ctx.lineWidth = Math.max(1.5, size * 0.012);
    ctx.beginPath();
    ctx.moveTo(x - width * 0.44, footY);
    ctx.lineTo(x - width * 0.46 + shoeWidth * 0.88, footY);
    ctx.moveTo(x + width * 0.2, footY);
    ctx.lineTo(x + width * 0.18 + shoeWidth * 0.88, footY);
    ctx.stroke();
  }

  if (shoeType === "dress") {
    ctx.fillStyle = "#111827";
    drawCircle(x - width * 0.46 + shoeWidth * 0.85, footY - shoeHeight * 0.05, shoeHeight * 0.35, "fill");
    drawCircle(x + width * 0.18 + shoeWidth * 0.85, footY - shoeHeight * 0.05, shoeHeight * 0.35, "fill");
  }
}

function drawPersonHat(x, y, radius, hatType, color) {
  ctx.fillStyle = color;
  if (hatType === "beanie") {
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.72, radius * 0.68, Math.PI, 0);
    ctx.lineTo(x + radius * 0.62, y - radius * 0.48);
    ctx.lineTo(x - radius * 0.62, y - radius * 0.48);
    ctx.closePath();
    ctx.fill();
    drawCircle(x, y - radius * 1.42, radius * 0.14, "fill");
    return;
  }

  if (hatType === "wideBrim") {
    drawRect(x - radius * 1.15, y - radius * 0.65, radius * 2.3, radius * 0.16, "fill");
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.72, radius * 0.58, Math.PI, 0);
    ctx.lineTo(x + radius * 0.58, y - radius * 0.55);
    ctx.lineTo(x - radius * 0.58, y - radius * 0.55);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (hatType === "bucket") {
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.68, y - radius * 1.1);
    ctx.lineTo(x + radius * 0.68, y - radius * 1.1);
    ctx.lineTo(x + radius * 0.88, y - radius * 0.48);
    ctx.lineTo(x - radius * 0.88, y - radius * 0.48);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (hatType === "helmet") {
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.62, radius * 0.72, Math.PI, 0);
    ctx.lineTo(x + radius * 0.72, y - radius * 0.34);
    ctx.lineTo(x - radius * 0.72, y - radius * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = Math.max(2, radius * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, y - radius * 1.3);
    ctx.lineTo(x, y - radius * 0.35);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.arc(x, y - radius * 0.72, radius * 0.64, Math.PI, 0);
  ctx.lineTo(x + radius * 0.64, y - radius * 0.6);
  ctx.lineTo(x - radius * 0.64, y - radius * 0.6);
  ctx.closePath();
  ctx.fill();
  drawRect(x - radius * 0.82, y - radius * 0.62, radius * 1.64, radius * 0.16, "fill");
  drawRect(x + radius * 0.55, y - radius * 0.62, radius * 0.8, radius * 0.12, "fill");
}

function drawPersonHairBase(x, y, radius, hair, hairColor) {
  ctx.fillStyle = hairColor;
  if (hair === "long") {
    drawCircle(x - radius * 0.72, y + radius * 0.22, radius * 0.58, "fill");
    drawCircle(x + radius * 0.72, y + radius * 0.22, radius * 0.58, "fill");
  }
  if (hair === "ponytail") {
    drawCircle(x + radius * 0.98, y + radius * 0.12, radius * 0.42, "fill");
  }
  if (hair === "curly") {
    for (let i = -2; i <= 2; i += 1) {
      drawCircle(x + i * radius * 0.34, y - radius * 0.62, radius * 0.28, "fill");
    }
  }
}

function drawPersonHairCap(x, y, radius, hair, hairColor) {
  if (hair === "bald") return;
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(x, y - radius * 0.12, radius * 0.98, Math.PI, 0);
  ctx.lineTo(x + radius * 0.82, y - radius * 0.02);
  ctx.lineTo(x - radius * 0.82, y - radius * 0.02);
  ctx.closePath();
  ctx.fill();
  if (hair === "short") {
    drawCircle(x - radius * 0.34, y - radius * 0.52, radius * 0.26, "fill");
    drawCircle(x + radius * 0.24, y - radius * 0.56, radius * 0.24, "fill");
  }
}

function drawPersonFace(x, y, radius, glasses) {
  ctx.fillStyle = "#222326";
  drawCircle(x - radius * 0.35, y - radius * 0.04, radius * 0.055, "fill");
  drawCircle(x + radius * 0.35, y - radius * 0.04, radius * 0.055, "fill");
  ctx.strokeStyle = "#222326";
  ctx.lineWidth = Math.max(1.8, radius * 0.055);
  ctx.beginPath();
  ctx.arc(x, y + radius * 0.2, radius * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  if (!glasses) return;
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = Math.max(2, radius * 0.07);
  ctx.beginPath();
  ctx.arc(x - radius * 0.34, y - radius * 0.04, radius * 0.24, 0, Math.PI * 2);
  ctx.arc(x + radius * 0.34, y - radius * 0.04, radius * 0.24, 0, Math.PI * 2);
  ctx.moveTo(x - radius * 0.1, y - radius * 0.04);
  ctx.lineTo(x + radius * 0.1, y - radius * 0.04);
  ctx.stroke();
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
  addElement({ type: "text", text, options });
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
    person: "人物",
  };
  return labels[shape] || shape;
}

function elementLabel(element) {
  if (element.type === "text") {
    return `文字「${element.text}」`;
  }
  if (element.shape === "person") {
    return personLabel(element.options.person) || "人物";
  }
  return shapeLabel(element.shape);
}

function personLabel(person) {
  const genderText = {
    male: "男生",
    female: "女生",
    neutral: "人物",
  }[person.gender];
  const ageText = {
    child: "小孩",
    teen: "少年",
    adult: "",
    elder: "老人",
  }[person.age];
  const hairText = {
    short: "短发",
    long: "长发",
    curly: "卷发",
    ponytail: "马尾",
    bald: "光头",
  }[person.hair];
  const heightText = person.height === "tall" ? "高个子" : person.height === "short" ? "矮个子" : "";
  const buildText = person.build === "slim" ? "偏瘦" : person.build === "chubby" ? "微胖" : person.build === "strong" ? "强壮" : "";
  const glassesText = person.glasses ? "戴眼镜" : "";
  return [glassesText, heightText, buildText, hairText, ageText || genderText].filter(Boolean).join("");
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
