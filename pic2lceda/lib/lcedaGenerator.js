// lib/lcedaGenerator.js
// 对应 Python 版 PIC2LCEDA.py 的 makepcb 生成逻辑
// 关键：shape / layers / objects 必须是真正的 JS 数组，交给 JSON.stringify 序列化

const LcedaGenerator = {

  /**
   * 主入口
   * @returns { libJson, pcbJson, info, baseName, ts }
   */
  generate(imageData, width, layer, copper, x_size, y_size,
           x_size_mil, y_size_mil, im_raw, im_col,
           colorInvert, xInvert, yInvert, threshold, filename) {

    // 参数合法性检查，防止 NaN / Infinity 混入 JSON
    if (!Number.isFinite(x_size) || !Number.isFinite(y_size) ||
        x_size <= 0 || y_size <= 0) {
      throw new Error('尺寸参数非法');
    }
    if (!Number.isFinite(width) || width <= 0) {
      throw new Error('线宽参数非法');
    }
    if (!imageData || imageData.width < 2 || imageData.height < 2) {
      throw new Error('图片太小');
    }

    const lines = this.extractLines(imageData, width, x_size_mil, y_size_mil);

    const baseName = filename.split('.')[0];
    const ts = new Date().toISOString()
      .replace(/[-:T]/g, '_')
      .slice(0, 19);

    const libJson = this.buildLibJson(
      lines, baseName, x_size_mil, y_size_mil, width, layer, copper
    );
    const pcbJson = this.buildPcbJson(lines, x_size_mil, y_size_mil);

    const info = this.buildInfo({
      im_raw, im_col, width, x_size, y_size, x_size_mil, y_size_mil,
      layer, filename, colorInvert, xInvert, yInvert, copper, threshold
    });

    return { libJson, pcbJson, info, baseName, ts };
  },

  /**
   * 逐行扫描生成线段
   *   o------>x (col)     o---0-->o
   *   |                   ^       |1
   *   |                 3 |       v
   *   v                   o<--2---o
   *   y (raw)
   */
  extractLines(imageData, width, x_size_mil, y_size_mil) {
    const lines = [
      [0, 0, x_size_mil / 10, 0],                              // 0
      [x_size_mil / 10, 0, x_size_mil / 10, y_size_mil / 10],  // 1
      [x_size_mil / 10, y_size_mil / 10, 0, y_size_mil / 10],  // 2
      [0, y_size_mil / 10, 0, 0]                               // 3
    ];

    const { width: w, height: h, data: d } = imageData;

    for (let i = 0; i < h; i++) {
      let lastPix = d[(i * w + 0) * 4];   // 取 R 通道
      for (let j = 0; j < w; j++) {
        const cur = d[(i * w + j) * 4];

        if (lastPix !== cur && lastPix === 255) {
          // 白 -> 黑，记录起点
          this._lineStart = j;
        } else if (lastPix !== cur && lastPix === 0) {
          // 黑 -> 白，记录终点并推入线段
          const lineStart = this._lineStart || 0;
          const lineEnd = j;
          lines.push([
            lineStart / 10 * width, i * width / 10,
            lineEnd   / 10 * width, i * width / 10
          ]);
        }
        lastPix = cur;
      }
    }
    return lines;
  },

  /**
   * 生成 LIB_xxx.json 的对象结构
   * shape / layers / objects 都是数组
   */
  buildLibJson(lines, packageName, x_size_mil, y_size_mil, width, layer, copper) {
    const cx = (lines[0][0] + lines[2][0]) / 2;
    const cy = (lines[0][1] + lines[2][1]) / 2;

    // ✅ 真正的数组
    const shape = [];

    // 铜皮 SOLIDREGION
    if (copper) {
      const region =
        `M ${lines[0][0].toFixed(4)} ${lines[0][1].toFixed(4)} ` +
        `L ${lines[0][2].toFixed(4)} ${lines[0][3].toFixed(4)} ` +
        `L ${lines[2][0].toFixed(4)} ${lines[2][1].toFixed(4)} ` +
        `L ${lines[2][2].toFixed(4)} ${lines[2][3].toFixed(4)} Z`;

      shape.push(`SOLIDREGION~1~~${region}~solid~ggb0~~~~0`);
      shape.push(`SOLIDREGION~2~~${region}~solid~ggb1~~~~0`);
    }

    // 4 条边框
    for (let i = 0; i < 4; i++) {
      shape.push(
        `TRACK~1~${layer}~~` +
        `${lines[i][0].toFixed(4)} ${lines[i][1].toFixed(4)} ` +
        `${lines[i][2].toFixed(4)} ${lines[i][3].toFixed(4)}~ggc${i}~0`
      );
    }

    // 图像线段
    for (let i = 4; i < lines.length; i++) {
      shape.push(
        `TRACK~${(width / 10).toFixed(1)}~${layer}~~` +
        `${lines[i][0].toFixed(4)} ${lines[i][1].toFixed(4)} ` +
        `${lines[i][2].toFixed(4)} ${lines[i][3].toFixed(4)}~gge${i}~0`
      );
    }

    // 检查有没有 NaN / null 混入
    if (shape.some(s => typeof s !== 'string' || s.includes('NaN'))) {
      throw new Error('生成 shape 数据异常（含 NaN）');
    }

    return {
      head: {
        docType: "4",
        editorVersion: "6.4.2",
        newGId: true,
        c_para: {
          package: packageName,
          pre: "PIC?",
          Contributor: "LCNB",
          link: ""
        },
        hasIdFlag: true,
        x: cx,
        y: cy
      },
      canvas: `CA~1000~1000~#000000~yes~#FFFFFF~10~1000~1000~line~10~mil~1~45~~0.5~${cx.toFixed(4)}~${cy.toFixed(4)}~0~none`,
      shape: shape,                    // ✅ 数组
      layers: this.getLayersArray(),   // ✅ 数组
      objects: this.getObjectsArray(), // ✅ 数组
      BBox: {
        x: cx,
        y: cy,
        width: x_size_mil,
        height: y_size_mil
      },
      netColors: {}
    };
  },

  /**
   * 生成 PCB_xxx.json 的对象结构
   */
  buildPcbJson(lines, x_size_mil, y_size_mil) {
    const cx = (lines[0][0] + lines[2][0]) / 2;
    const cy = (lines[0][1] + lines[2][1]) / 2;

    // ✅ 真正的数组
    const shape = [];
    for (let i = 0; i < 4; i++) {
      shape.push(
        `TRACK~1~10~S$998~` +
        `${lines[i][0].toFixed(4)} ${lines[i][1].toFixed(4)} ` +
        `${lines[i][2].toFixed(4)} ${lines[i][3].toFixed(4)}~ggc${i}~0`
      );
    }

    return {
      head: {
        docType: "3",
        editorVersion: "6.4.2",
        newGId: true,
        c_para: {},
        hasIdFlag: true
      },
      canvas: `CA~1000~1000~#000000~yes~#FFFFFF~39.370079~1000~1000~line~3.937008~mm~1~45~~0.5~${cx.toFixed(4)}~${cy.toFixed(4)}~0~yes`,
      shape: shape,                    // ✅ 数组
      layers: this.getLayersArray(),   // ✅ 数组
      objects: this.getObjectsArray(), // ✅ 数组
      BBox: {
        x: cx,
        y: cy,
        width: x_size_mil,
        height: y_size_mil
      },
      preference: {
        hideFootprints: "",
        hideNets: ""
      },
      DRCRULE: {
        Default: {
          trackWidth: 1,
          clearance: 0.6,
          viaHoleDiameter: 2.4,
          viaHoleD: 1.2
        },
        isRealtime: false,
        isDrcOnRoutingOrPlaceVia: false,
        checkObjectToCopperarea: true,
        showDRCRangeLine: true
      },
      netColors: {}
    };
  },

  // ✅ 返回数组，不是字符串
  getLayersArray() {
    return [
      "1~TopLayer~#FF0000~true~true~true~",
      "2~BottomLayer~#0000FF~true~false~true~",
      "3~TopSilkLayer~#FFCC00~true~false~true~",
      "4~BottomSilkLayer~#66CC33~true~false~true~",
      "5~TopPasteMaskLayer~#808080~true~false~true~",
      "6~BottomPasteMaskLayer~#800000~true~false~true~",
      "7~TopSolderMaskLayer~#800080~true~false~true~0.3",
      "8~BottomSolderMaskLayer~#AA00FF~true~false~true~0.3",
      "9~Ratlines~#6464FF~false~false~true~",
      "10~BoardOutLine~#FF00FF~true~false~true~",
      "11~Multi-Layer~#C0C0C0~true~false~true~",
      "12~Document~#FFFFFF~true~false~true~"
    ];
  },

  // ✅ 返回数组，不是字符串
  getObjectsArray() {
    return [
      "All~true~false",
      "Component~true~true",
      "Prefix~true~true",
      "Name~true~false",
      "Track~true~true",
      "Pad~true~true",
      "Via~true~true",
      "Hole~true~true",
      "Copper_Area~true~true",
      "Circle~true~true",
      "Arc~true~true",
      "Solid_Region~true~true",
      "Text~true~true",
      "Image~true~true",
      "Rect~true~true",
      "Dimension~true~true",
      "Protractor~true~true"
    ];
  },

  buildInfo(p) {
    const layerNames = [
      'NULL', '顶层', '底层', '顶层丝印层', '底层丝印层',
      '顶层焊盘层', '底层焊盘层', '顶层阻焊层', '底层阻焊层', '边框层', '文档层'
    ];
    return [
      `| 原图X像素\t| ${p.im_col} pix`,
      `| 原图y像素\t| ${p.im_raw} pix`,
      `| 线宽\t\t| ${p.width} mil`,
      `| X最大尺寸\t| ${p.x_size} mm`,
      `| y最大尺寸\t| ${p.y_size} mm`,
      `| X实际像素\t| ${p.x_size_mil} pix`,
      `| y实际像素\t| ${p.y_size_mil} pix`,
      `| X实际尺寸\t| ${(p.x_size_mil / 100 * 2.54).toFixed(4)} mm`,
      `| y实际尺寸\t| ${(p.y_size_mil / 100 * 2.54).toFixed(4)} mm`,
      `| 所在层\t\t| ${layerNames[p.layer]}`,
      `| 源文件名称\t| ${p.filename}`,
      `| 图像取反\t| ${p.colorInvert ? 'true' : 'false'}`,
      `| 水平翻转\t| ${p.xInvert ? 'true' : 'false'}`,
      `| 垂直翻转\t| ${p.yInvert ? 'true' : 'false'}`,
      `| 创建铜皮\t| ${p.copper ? 'true' : 'false'}`,
      `| 阈值\t\t| ${p.threshold}`
    ].join('\n');
  },

  // ---- 下载辅助 ----

  downloadJson(obj, filename) {
    const text = JSON.stringify(obj, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    this.downloadBlob(blob, filename);
  },

  downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    this.downloadBlob(blob, filename);
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};