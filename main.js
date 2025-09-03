// ==UserScript==
// @name         Bilibili Title Copy Enhanced
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  双击视频标题复制图文信息。
// @match        https://www.bilibili.com/video/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 样式与用户反馈 (无需修改) ---
    const STYLE = `
        @keyframes fadeOut { 0% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%); } }
        .copy-notification {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            padding: 12px 24px; background: rgba(0, 179, 138, 0.95); color: white;
            border-radius: 6px; z-index: 9999; font-size: 14px;
            font-family: "Microsoft Yahei", sans-serif; animation: fadeOut 1.2s ease-out forwards;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); backdrop-filter: blur(3px);
        }
    `;
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    const showFeedback = (text, isError = false) => {
        const div = document.createElement('div');
        div.className = 'copy-notification';
        div.textContent = text;
        if (isError) {
            div.style.background = 'rgba(217, 48, 37, 0.95)';
        }
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 1200);
    };

    // --- 核心功能 ---

    const initCopyListener = (titleElement) => {
        if (titleElement.dataset.copyListenerAttached) return;
        titleElement.addEventListener('dblclick', async () => {
            try {
                const info = gatherVideoInfo();
                await copyRichContentToClipboard(info);
                showFeedback('🎉 图文信息已复制！');
            } catch (err) {
                showFeedback('❌ 复制失败，请手动操作', true);
                console.error('Bilibili Title Copy Error:', err);
            }
        });
        titleElement.dataset.copyListenerAttached = 'true';
    };

    /**
     * 收集视频信息（精确混合模式）
     */
    const gatherVideoInfo = () => {
        const title = getTitle();
        const playCount = getPlayCount();
        const duration = getVideoDuration(); // 新增：获取视频时长
        const upNames = getUpNames().join('、');
        const uploadTime = getMetaContent('meta[itemprop="datePublished"]');
        const videoUrl = getMetaContent('meta[property="og:url"]');
        const coverUrl = getVideoCoverUrl();

        // 1. 构建用于粘贴到 Word 的 HTML
        // 【已修正】使用 <br> 标签强制换行，实现通用兼容性。
        const htmlParts = [
            `<strong>视频标题：</strong>${title}`,
            `<strong>UP主：</strong>${upNames}`,
            `<strong>播放量：</strong>${playCount}`,
            `<strong>视频时长：</strong>${duration}`, // 新增行
            `<strong>发布时间：</strong>${uploadTime}`,
            `<strong>视频链接：</strong><a href="${videoUrl}">${videoUrl}</a>`
        ];

        // 如果有封面图，添加图片HTML
        if (coverUrl) {
            // 在文本和图片之间也加一个换行
            htmlParts.push(`<img src="${coverUrl}" alt="视频封面" style="max-width:450px; border-radius:4px; margin-top: 8px;">`);
        }

        const html = htmlParts.join('<br>');

        // 2. 构建纯文本版本作为备用 (使用 \n 换行)
        const text = [
            `视频标题：${title}`,
            `UP主：${upNames}`,
            `播放量：${playCount}`,
            `视频时长：${duration}`, // 新增行
            `发布时间：${uploadTime}`,
            `视频链接：${videoUrl}`
        ].join('\n');

        return { html, text };
    };

    /**
     * 将富文本内容写入剪贴板 (无需修改)
     */
    const copyRichContentToClipboard = async (content) => {
        if (navigator.clipboard?.write) {
            const htmlBlob = new Blob([content.html], { type: 'text/html' });
            const textBlob = new Blob([content.text], { type: 'text/plain' });
            const item = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });
            await navigator.clipboard.write([item]);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = content.text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    };

    // --- 信息获取辅助函数 ---

    const getTitle = () => {
        const selector = "#viewbox_report > div.video-info-title > div > h1";
        try { return document.querySelector(selector)?.textContent?.trim() || 'N/A'; }
        catch { return 'N/A'; }
    };

    const getPlayCount = () => {
        const selector = "#viewbox_report > div.video-info-meta > div > div.view.item > div";
        try { return document.querySelector(selector)?.textContent?.trim() || 'N/A'; }
        catch { return 'N/A'; }
    };

    // 【新增】获取视频时长
    const getVideoDuration = () => {
        const selector = "span.bpx-player-ctrl-time-duration";
        try { return document.querySelector(selector)?.textContent?.trim() || 'N/A'; }
        catch { return 'N/A'; }
    };

    const getMetaContent = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute('content')?.trim() : 'N/A';
    };

    const getUpNames = () => {
        const collaborators = document.querySelectorAll('.membersinfo-upcard .staff-name');
        if (collaborators.length > 0) {
            return Array.from(collaborators).map(up => up.textContent.trim());
        }
        const singleUp = getMetaContent('meta[name="author"]');
        return singleUp !== 'N/A' ? [singleUp] : ['未知UP主'];
    };

    const getVideoCoverUrl = () => {
        let content = getMetaContent('meta[property="og:image"]');
        if (content === 'N/A') return '';
        if (content.startsWith('//')) content = 'https:' + content;
        return content.split('@')[0];
    };

    // --- 启动与监听 (无需修改) ---

    const observer = new MutationObserver(() => {
        const titleElement = document.querySelector('#viewbox_report h1');
        if (titleElement) {
            initCopyListener(titleElement);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();