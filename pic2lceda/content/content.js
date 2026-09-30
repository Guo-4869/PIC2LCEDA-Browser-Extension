// 监听 popup 发来的消息，把 JSON 内容注入到 EDA 编辑器
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'IMPORT_LIB') {
    // LCEDA 编辑器通常把状态挂在 window 上，具体 API 需参考其文档
    // 这里给出思路：找到编辑器的导入入口并触发
    try {
      // 示例：模拟点击"打开"-"立创EDA"
      const menu = document.querySelector('[data-menu="file"]');
      if (menu) menu.click();
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  }
  return true;
});