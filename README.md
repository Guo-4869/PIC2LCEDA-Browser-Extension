# PIC2LCEDA · 浏览器插件版

> 把任意图片转换成 **立创EDA / 嘉立创EDA** 的 PCB 库文件（LIB）+ 边框文件（PCB），
> 直接在浏览器里用，无需安装 Python、OpenCV，也无需下载 exe。

[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-yellow.svg)](#安装)
[![Origin](https://img.shields.io/badge/Based%20on-PIC2LCEDA-orange.svg)](https://github.com/KnightSin/PIC2LCEDA)

---

## 这是什么？

本项目是 [PIC2LCEDA](https://github.com/KnightSin/PIC2LCEDA) 的**浏览器插件版**。

原版是 Python + PyQt5 桌面程序，需要安装 Python、OpenCV、NumPy 才能跑；
本版本把整套图像处理与 JSON 生成逻辑用 **纯 JavaScript** 重写，做成 Chrome 扩展，
**双击安装、离线可用、不依赖任何后端**。

核心算法与原版保持一致：读图 → 缩放 → 反相/翻转 → 灰度 → 二值化 →
逐行扫描生成水平线段 → 组装成立创EDA可识别的 `LIB_xxx.json` / `PCB_xxx.json`。

---

## 效果预览

> ![preview](docs/preview.png)

- 左：原图
- 中：插件处理后的二值预览
- 右：导入嘉立创EDA后的效果

---

## 功能特性

- ✅ **图片转 LCEDA 库**：生成 `LIB_xxx.json`，可直接被立创EDA/嘉立创EDA导入
- ✅ **自动生成 PCB 边框**：生成 `PCB_xxx.json`，包含板框尺寸
- ✅ **实时预览**：修改参数立即看到二值化效果
- ✅ **完整参数支持**：
  - X/Y 最大尺寸（mm）
  - 线宽（mil）
  - 图层选择（顶层/底层/丝印/阻焊/边框/文档 等 10 个层）
  - 图像阈值（0–255 滑块）
  - 图像反相
  - 水平/垂直翻转
  - 创建铜皮（SOLIDREGION 实心填充）
- ✅ **纯前端实现**：不上传图片，不联网，隐私安全
- ✅ **生成 info.txt**：记录本次转换的全部参数，方便复现
- ✅ **跨平台**：Chrome / Edge / Brave 等 Chromium 内核浏览器均可

---

## 安装

### 方式一：开发者模式加载（推荐，最新版）

1. 下载本仓库（`Code` → `Download ZIP`，或 `git clone`）
2. 打开浏览器扩展页：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
   - Brave：`brave://extensions/`
3. 右上角开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择本仓库根目录
5. 工具栏出现插件图标，安装完成

### 方式二：从 Release 安装 crx（如果发布了的话）

下载 `pic2lceda.crx`，拖入扩展页即可。

---

## 使用步骤

### 1. 处理图片（可选，但强烈推荐）

先用 [PCB照片_附带生成脚本](https://lceda.cn/Knight_Sin/PCBzhao-pian) 把照片处理成高对比度黑白图，
效果会比直接转好很多。

### 2. 转换

1. 点击工具栏插件图标
2. 点击 **选取文件**，选择要转换的图片
3. 调整参数：
   - **X/Y 最大尺寸**：最终在 PCB 上的物理尺寸，单位 mm
   - **线宽**：每条扫描线的粗细，单位 mil（越小越细腻，但文件越大）
   - **层级**：决定生成到哪一层（默认"顶层阻焊层"）
   - **图像阈值**：二值化分界，127 是中间值
   - **图像反相 / 水平翻转 / 垂直翻转 / 创建铜皮**：按需勾选
4. 点击 **生成文件**，浏览器会下载一个文件夹：

```
LCEDA_<图片名>_<时间戳>/
├── LIB_<图片名>.json    ← 库文件（导入这个）
├── PCB_<图片名>.json    ← 边框文件
└── info.txt             ← 参数记录
```

### 3. 导入立创EDA / 嘉立创EDA

1. 打开立创EDA编辑器
2. 顶部菜单：**文件 → 打开 → 立创EDA**
3. 选择刚才生成的 `LIB_xxx.json`
4. 在库编辑器中会看到生成的封装，删掉多余图层，保存
5. 在 PCB 绘制界面：左侧 **元件库 → 立创EDA → 封装**，找到刚保存的封装，放置到画布

---

## 原理简介

图像处理的每一步都对应原 Python 版的 `PIC2LCEDA.py::transformpic`：

| 步骤 | Python (OpenCV) | 本插件 (JS) |
|---|---|---|
| 读图 | `cv2.imdecode` | `FileReader` + `Canvas` |
| 缩放 | `cv2.resize(INTER_NEAREST)` | `drawImage(imageSmoothingEnabled=false)` |
| 反相 | `cv2.bitwise_not` | `255 - pixel` |
| 加白边 | `cv2.copyMakeBorder` | `Canvas.fillRect` |
| 转灰度 | `cv2.cvtColor(BGR2GRAY)` | `0.299R + 0.587G + 0.114B` |
| 二值化 | `cv2.threshold` | 逐像素比较 |
| 水平/垂直翻转 | `cv2.flip` | 像素重排 |
| 提取线段 | 逐行扫描 | 逐行扫描（同算法） |
| 生成 JSON | 手写字符串 | `JSON.stringify` |

生成的 `LIB_xxx.json` 与 Python 版格式完全一致，均可被立创EDA识别。

---

## 目录结构

```
PIC2LCEDA-Browser-Extension/
├── manifest.json              # 扩展配置（Manifest V3）
├── popup/
│   ├── popup.html             # 插件弹窗界面
│   ├── popup.css
│   └── popup.js               # 交互逻辑
├── lib/
│   ├── imageProcessor.js      # 图像处理（对应 transformpic）
│   └── lcedaGenerator.js      # JSON 生成（对应 makepcb）
├── icons/
│   └── icon128.png
├── docs/
│   └── preview.png
└── README.md
```

---

## 与原版对比

| 特性 | Python 版 | 本插件版 |
|---|---|---|
| 安装 | 需装 Python + OpenCV + PyQt5 | 加载即用 |
| 平台 | Windows / Linux | 任意 Chromium 浏览器 |
| 图片路径 | 本地文件系统 | 浏览器文件对象 |
| 输出位置 | 源图片同目录 | 浏览器下载目录 |
| 批量处理 | 单张 | 单张（可扩展） |
| 实时预览 | 是 | 是（popup 内） |
| 依赖 | NumPy 2.x 有兼容问题 | 无依赖 |

---

## 已知限制

- 浏览器扩展弹窗尺寸有限，超大图预览会缩略显示
- 逐像素处理在百万像素级图片上会略卡，建议先用脚本预处理图片
- 无法像 Python 版那样在源图目录下建文件夹，输出统一进下载目录
- 暂不支持批量转换（欢迎 PR）

---

## 路线图

- [ ] 支持拖拽图片到弹窗
- [ ] 支持批量转换并打包 zip
- [ ] Web Worker 加速大图处理
- [ ] 一键导入立创EDA（content script 注入）
- [ ] 保存上次使用的参数（`chrome.storage`）

---

## 贡献

欢迎 Issue 和 PR！

- 发现 Bug：请附上**原图、参数、生成的 JSON 前 50 行**，方便定位
- 提新功能：先开 Issue 讨论，避免白做
- 一个 Issue 一次 Commit，保持提交历史清晰

---

## 致谢

- 原项目：[KnightSin/PIC2LCEDA](https://github.com/KnightSin/PIC2LCEDA)（作者：矛盾聚合体 & Kearney）
- 立创EDA文档格式：[EasyEDA Format Standard](https://docs.lceda.cn/cn/DocumentFormat/EasyEDA-Format-Standard/index.html)
- 图片预处理脚本：[PCB照片_附带生成脚本](https://lceda.cn/Knight_Sin/PCBzhao-pian)

---

## License

[GPL-3.0](LICENSE)

本项目基于原版 PIC2LCEDA（GPL-3.0）二次开发，同样以 GPL-3.0 发布。
