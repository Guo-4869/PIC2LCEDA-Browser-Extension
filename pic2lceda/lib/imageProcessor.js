// 对应 PIC2LCEDA.transformpic
const ImageProcessor = {
  /**
   * 读取文件为 ImageData
   */
  async loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = reject;
      img.src = url;
    });
  },

  /**
   * 主转换函数（对应 Python 的 transformpic）
   * @returns {ImageData, x_size_mil, y_size_mil, im_raw, im_col}
   */
  async transform(file, x_size, y_size, width, layer,
                  colorInvert, xInvert, yInvert, threshold) {
    let imageData = await this.loadImage(file);
    const im_raw = imageData.height;
    const im_col = imageData.width;

    // 单位转换（mm -> mil）: 1 mm = 100/2.54 mil ≈ 39.37 mil
    let x_size_mil = Math.floor(x_size / 2.54 * 100);
    let y_size_mil = Math.floor(y_size / 2.54 * 100);

    // 等比缩放计算
    let k;
    if (im_raw / y_size_mil > im_col / x_size_mil) {
      k = y_size_mil / im_raw;
      x_size_mil = Math.floor(im_col * k) + 1;
    } else {
      k = x_size_mil / im_col;
      y_size_mil = Math.floor(im_raw * k) + 1;
    }

    // 缩放 + 按线宽归约像素
    const newW = Math.max(1, Math.floor(im_col * k / width));
    const newH = Math.max(1, Math.floor(im_raw * k / width));
    imageData = this.resizeImageData(imageData, newW, newH);

    // 图像反相
    if (colorInvert) {
      this.bitwiseNot(imageData);
    }

    // 加 1 像素白边（对应 copyMakeBorder）
    imageData = this.addBorder(imageData, 1, [255, 255, 255]);

    // 转灰度
    this.toGray(imageData);

    // 二值化
    this.threshold(imageData, threshold);

    // 底层自动水平翻转（layer 为 2/4/6/8 时）
    if ([2, 4, 6, 8].includes(layer)) {
      this.flipHorizontal(imageData);
    }

    // 手动翻转
    if (xInvert) this.flipHorizontal(imageData);
    if (yInvert) this.flipVertical(imageData);

    return { imageData, x_size_mil, y_size_mil, im_raw, im_col };
  },

  resizeImageData(src, w, h) {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = src.width;
    srcCanvas.height = src.height;
    srcCanvas.getContext('2d').putImageData(src, 0, 0);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = w;
    dstCanvas.height = h;
    const ctx = dstCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;  // 对应 INTER_NEAREST
    ctx.drawImage(srcCanvas, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  },

  bitwiseNot(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
  },

  toGray(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = g;
    }
  },

  threshold(imageData, t) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] > t ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  },

  flipHorizontal(imageData) {
    const { width: w, height: h, data: d } = imageData;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w / 2; x++) {
        const i1 = (y * w + x) * 4;
        const i2 = (y * w + (w - 1 - x)) * 4;
        for (let k = 0; k < 4; k++) {
          const tmp = d[i1 + k];
          d[i1 + k] = d[i2 + k];
          d[i2 + k] = tmp;
        }
      }
    }
  },

  flipVertical(imageData) {
    const { width: w, height: h, data: d } = imageData;
    for (let y = 0; y < h / 2; y++) {
      for (let x = 0; x < w; x++) {
        const i1 = (y * w + x) * 4;
        const i2 = ((h - 1 - y) * w + x) * 4;
        for (let k = 0; k < 4; k++) {
          const tmp = d[i1 + k];
          d[i1 + k] = d[i2 + k];
          d[i2 + k] = tmp;
        }
      }
    }
  },

  addBorder(imageData, px, color) {
    const w = imageData.width + 2 * px;
    const h = imageData.height + 2 * px;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(0, 0, w, h);

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imageData.width;
    srcCanvas.height = imageData.height;
    srcCanvas.getContext('2d').putImageData(imageData, 0, 0);
    ctx.drawImage(srcCanvas, px, px);
    return ctx.getImageData(0, 0, w, h);
  },

  /**
   * 预览：将 ImageData 转 dataURL，显示在 canvas 上
   */
  toDataURL(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }
};