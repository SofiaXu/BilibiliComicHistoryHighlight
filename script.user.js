// ==UserScript==
// @name         B 漫工具箱
// @namespace    https://github.com/SofiaXu/BilibiliComicToolBox
// @version      2.5.1
// @description  进行一键购买和下载漫画的工具箱，对历史/收藏已读完漫画进行高亮为绿色，将阅读页面图片替换成原图大小
// @author       Aoba Xu
// @match        https://manga.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @require      https://cdn.bootcdn.net/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        none
// @license      MIT
// ==/UserScript==

(async function () {
  "use strict";
  const api = {
    getComicDetail: async (comicId) => {
      const res = await fetch(
        "https://manga.bilibili.com/twirp/comic.v1.Comic/ComicDetail?device=pc&platform=web",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
          },
          body: `{\"comic_id\":${comicId}}`,
          method: "POST",
          credentials: "include",
        }
      );
      return await res.json();
    },
    buyEpisode: async (epId, buyMethod = 1, couponIds = undefined) => {
      const body = {
        buy_method: buyMethod,
        ep_id: epId,
      };
      if (couponIds) {
        body.coupon_ids = couponIds;
      }
      const res = await fetch(
        "https://manga.bilibili.com/twirp/comic.v1.Comic/BuyEpisode?device=pc&platform=web",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
          },
          body: JSON.stringify(body),
          method: "POST",
          credentials: "include",
        }
      );
      return await res.json();
    },
    getEpisodeBuyInfo: async (epId) => {
      const res = await fetch(
        "https://manga.bilibili.com/twirp/comic.v1.Comic/GetEpisodeBuyInfo?device=pc&platform=web",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
          },
          body: `{\"ep_id\":${epId}}`,
          method: "POST",
          credentials: "include",
        }
      );
      return await res.json();
    },
    updateAutoBuyComic: async (autoPayId, status = 1) => {
      const res = await fetch(
        "https://manga.bilibili.com/twirp/user.v1.User/UpdateAutoBuyComic?device=pc&platform=web",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
          },
          body: `{\"id\":${autoPayId},\"order\":[2,3,1],\"auto_pay_status\":${status},\"biz_type\":0}`,
          method: "POST",
          credentials: "include",
        }
      );
      return await res.json();
    },
    getImageIndex: async (epId) => {
      const res = await fetch(
        "https://manga.bilibili.com/twirp/comic.v1.Comic/GetImageIndex?device=pc&platform=web",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
          },
          body: `{"ep_id":${epId}}`,
          method: "POST",
          credentials: "include",
        }
      );
      return await res.json();
    },
    getImageToken: async (urls) => {
      const res = await fetch(
        "https://manga.bilibili.com/twirp/comic.v1.Comic/ImageToken?device=pc&platform=web",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
          },
          body: JSON.stringify({ urls: JSON.stringify(urls) }),
          method: "POST",
          credentials: "include",
        }
      );
      return await res.json();
    },
    listFavorite: async (page, order) => {
      const result = await fetch(
        "https://manga.bilibili.com/twirp/bookshelf.v1.Bookshelf/ListFavorite?device=pc&platform=web",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
          },
          body: `{"page_num":${page},"page_size":15,"order":${
            order === 4 ? 3 : order
          },"wait_free":${order === 4 ? 1 : 0}}`,
          method: "POST",
          credentials: "include",
        }
      );
      return await result.json();
    },
    listHistory: async (page) => {
      const result = await fetch(
        "https://manga.bilibili.com/twirp/bookshelf.v1.Bookshelf/ListHistory?device=pc&platform=web",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
          },
          body: `{"page_num":${page},"page_size":15}`,
          method: "POST",
          credentials: "include",
        }
      );
      return await result.json();
    },
  };
  const createStyles = () => {
    const style = document.createElement("style");
    style.innerText += `.b-toolbox-d-flex { display: flex } .b-toolbox-d-none { display: none } .b-toolbox-flex-column { flex-direction: column }`;
    document.head.append(style);
    return {
      element: style,
      addStyle: (newStyle) => {
        style.innerText += newStyle;
      },
    };
  };
  const createPopupPanel = (styles) => {
    const panel = document.createElement("div");
    styles.addStyle(
      `.b-toolbox-popup { top:70px; right: 1rem; position: fixed; border-radius: 6px; max-height: 50% }`
    );
    panel.className = "b-toolbox-popup b-toolbox-d-flex";
    document.body.append(panel);
    return panel;
  };
  const createToolboxPanel = (parentPanel, styles) => {
    const panel = document.createElement("div");
    styles.addStyle(
      `.b-toolbox-panel { margin-right: 1.5rem; background: rgba(255, 255, 255, 0.8); padding: 1rem; gap: 1rem }`
    );
    panel.className = "b-toolbox-panel b-toolbox-d-none b-toolbox-flex-column";
    parentPanel.append(panel);
    return panel;
  };
  const createToolboxShowBtn = (parentPanel, showablePanel, styles) => {
    const container = document.createElement("div");
    container.className = "b-toolbox-d-flex b-toolbox-flex-column";
    parentPanel.append(container);
    const btn = document.createElement("button");
    btn.role = "button";
    btn.insertAdjacentHTML("beforeEnd", "<div>工具箱</div>");
    styles.addStyle(
      `.b-toolbox-toolbox-btn { align-items: center; background-color: #32aaff; border: none; border-radius: 6px; color: #fff; cursor: pointer; display: flex; justify-content: center; padding: 1rem 0.5rem }`
    );
    btn.className += "b-toolbox-toolbox-btn";
    container.append(btn);
    btn.onclick = () => {
      showablePanel.classList.toggle("b-toolbox-d-none");
      showablePanel.classList.toggle("b-toolbox-d-flex");
    };
  };
  const styles = createStyles();
  if (location.pathname.match(/^\/detail\/mc\d+$/)) {
    const popupPanel = createPopupPanel(styles);
    const toolboxPanel = createToolboxPanel(popupPanel, styles);
    createToolboxShowBtn(popupPanel, toolboxPanel, styles);
    const comicId = location.pathname.split("mc")[1];
    const comicInfo = await api.getComicDetail(comicId);
    const createStatusDisplay = (parentPanel) => {
      const panel = document.createElement("div");
      panel.className = "b-toolbox-d-flex b-toolbox-flex-column";
      panel.style.overflow = "auto";
      panel.insertAdjacentHTML("beforeEnd", "<div>等待任务</div>");
      parentPanel.append(panel);
      let timer = 0;
      const complete = () => {
        panel.insertAdjacentHTML("beforeEnd", "<div>已完成</div>");
        timer = setTimeout(() => {
          panel.innerHTML = "";
          panel.insertAdjacentHTML("beforeEnd", "<div>等待任务</div>");
        }, 2000);
      };
      return {
        element: panel,
        complete,
        clear: () => {
          clearTimeout(timer);
          panel.innerHTML = "";
          panel.insertAdjacentHTML("beforeEnd", "<div>等待任务</div>");
        },
        addStatus: (status) => {
          panel.insertAdjacentHTML("beforeEnd", `<div>${status}</div>`);
        },
      };
    };
    const statusDisplay = createStatusDisplay(toolboxPanel);
    const createBatchAutoPayBtn = (parentPanel, statusDisplay) => {
      const inputContainer = document.createElement("div");
      inputContainer.className = "b-toolbox-d-flex";
      parentPanel.append(inputContainer);
      const checkBox = document.createElement("input");
      checkBox.type = "checkbox";
      checkBox.checked = false;
      inputContainer.append(checkBox);
      const checkBoxLabel = document.createElement("label");
      checkBoxLabel.innerText = "使用通用券";
      inputContainer.append(checkBoxLabel);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.insertAdjacentHTML("beforeEnd", "<div>用券购买剩余项</div>");
      btn.className += "b-toolbox-toolbox-btn";
      parentPanel.append(btn);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const epList = comicInfo.data.ep_list;
        epList.reverse();
        const lockedEps = epList.filter((x) => x.is_locked);
        statusDisplay.addStatus(`共${lockedEps.length}个未解锁章节`);
        const canUseSilver = checkBox.checked;
        for (let i = 0; i < lockedEps.length; i++) {
          const ep = lockedEps[i];
          statusDisplay.addStatus(`正在购买第${ep.title}话`);
          const res = await api.getEpisodeBuyInfo(ep.id);
          if (res.data.allow_coupon && res.data.remain_coupon > 0) {
            const buyRes = await api.buyEpisode(
              ep.id,
              2,
              res.data.recommend_coupon_ids
            );
            if (buyRes.msg === "本话无需购买") {
              statusDisplay.addStatus(`第${ep.ord}话${ep.title}无需购买`);
            } else {
              statusDisplay.addStatus(
                `第${ep.ord}话${ep.title}话购买成功${
                  buyRes.data?.auto_use_item
                    ? "使用" + buyRes.data?.auto_use_item
                    : ""
                }`
              );
            }
          } else if (res.data.remain_silver > 0 && canUseSilver) {
            const buyRes = await api.buyEpisode(ep.id, 5);
            if (buyRes.msg === "本话无需购买") {
              statusDisplay.addStatus(`第${ep.ord}话${ep.title}无需购买`);
            } else {
              statusDisplay.addStatus(
                `第${ep.ord}话${ep.title}话购买成功${
                  buyRes.data?.auto_use_item
                    ? "使用" + buyRes.data?.auto_use_item
                    : ""
                }`
              );
            }
          } else {
            if (!res.data.allow_coupon) {
              statusDisplay.addStatus(`第${ep.ord}话${ep.title}不可用券购买`);
            }
            if (res.data.remain_coupon <= 0) {
              statusDisplay.addStatus(`券不足`);
              break;
            } else {
              statusDisplay.addStatus(`未知错误, 退出 ${res.msg}`);
              break;
            }
          }
          if (i % 5 === 0) {
            const delay = Math.floor(Math.random() * 1000) + 500;
            statusDisplay.addStatus(`等待${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        statusDisplay.complete();
        btn.disabled = false;
      });
    };
    createBatchAutoPayBtn(toolboxPanel, statusDisplay);
    const safeFileName = (name) => {
      return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\.\.$/, "_");
    };
    const createDownloadBtn = (parentPanel, statusDisplay) => {
      const inputContainer = document.createElement("div");
      inputContainer.className = "b-toolbox-d-flex b-toolbox-flex-column";
      parentPanel.append(inputContainer);
      const label = document.createElement("label");
      label.innerText = "下载范围（空则下载全部）";
      inputContainer.append(label);
      const rangeInput = document.createElement("input");
      rangeInput.type = "text";
      rangeInput.placeholder = "1-10, 12, 15-20";
      inputContainer.append(rangeInput);
      const formatSelectionContainer = document.createElement("div");
      formatSelectionContainer.className =
        "b-toolbox-d-flex b-toolbox-flex-column";
      parentPanel.append(formatSelectionContainer);
      const formatLabel = document.createElement("label");
      formatLabel.innerText = "下载格式";
      formatSelectionContainer.append(formatLabel);
      const formatSelect = document.createElement("select");
      formatSelect.insertAdjacentHTML(
        "afterbegin",
        `
      ${
        window.showDirectoryPicker
          ? `<option value="folder">文件夹</option>
          <option value="folder-cbz">文件夹+章节 CBZ</option>
          `
          : ""
      }
      <option value="zip">ZIP</option>
      <option value="cbz">CBZ</option>
      <option value="zip-cbz">ZIP+章节 CBZ</option>
      `
      );
      formatSelectionContainer.append(formatSelect);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.insertAdjacentHTML("beforeEnd", "<div>下载本书已购内容</div>");
      btn.className += "b-toolbox-toolbox-btn";
      parentPanel.append(btn);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const format = formatSelect.value;
        const { storage, needExport } = (() => {
          if (window.showDirectoryPicker && format.startsWith("folder")) {
            return {
              storage: window.showDirectoryPicker({
                id: "b-toolbox-download-folder",
                startIn: "desktop",
                mode: "readwrite",
              }),
              needExport: false,
            };
          } else {
            return {
              storage: navigator.storage.getDirectory(),
              needExport: true,
            };
          }
        })();
        const epList = comicInfo.data.ep_list;
        epList.reverse();
        let unlockedEps = epList.filter((x) => !x.is_locked);
        statusDisplay.addStatus(`共${unlockedEps.length}个已解锁章节`);
        const rangeValue = rangeInput.value;
        if (rangeValue) {
          const range = rangeValue.split(",").flatMap((x) => {
            if (x.includes("-")) {
              const [start, end] = x.split("-").map((y) => parseInt(y.trim()));
              return Array.from(
                { length: end - start + 1 },
                (_, i) => i + start
              );
            }
            return parseInt(x.trim());
          });
          if (range.length > 0) {
            unlockedEps = unlockedEps.filter((x) => range.includes(x.ord));
            statusDisplay.addStatus(`筛选${unlockedEps.length}个章节`);
          }
        }
        if (unlockedEps.length === 0) {
          statusDisplay.addStatus(`无需下载`);
          statusDisplay.complete();
          btn.disabled = false;
          return;
        }
        const dir = await storage;
        const comicFolder = await dir.getDirectoryHandle(
          safeFileName(comicInfo.data.title),
          {
            create: true,
          }
        );
        const epPadding = Math.ceil(Math.log10(epList.length));
        for (let i = 0; i < unlockedEps.length; i++) {
          const ep = unlockedEps[i];
          statusDisplay.addStatus(`正在下载第${ep.ord}话 ${ep.title}`);
          const res = await api.getImageIndex(ep.id);
          const urls = res.data.images.map((x) => x.path);
          const token = await api.getImageToken(urls);
          const downloadUrls = token.data.map(
            (x) => x.url + "?token=" + x.token
          );
          const epOrdString = ep.ord.toString();
          const epLocalPadding = epOrdString.includes(".")
            ? epOrdString.split(".")[1].length + 1 + epPadding
            : epPadding;
          const epTitle = `${ep.ord.toString().padStart(epLocalPadding, "0")}-${
            ep.title
          }`;
          const epFolder = await comicFolder.getDirectoryHandle(
            safeFileName(epTitle),
            {
              create: true,
            }
          );
          const padding = Math.ceil(Math.log10(downloadUrls.length));
          const tasks = downloadUrls.map(async (url, j) => {
            const file = await epFolder.getFileHandle(
              `${(j + 1).toString().padStart(padding, "0")}.jpg`,
              { create: true }
            );
            const writable = await file.createWritable();
            const res = await fetch(url);
            await res.body.pipeTo(writable);
          });
          await Promise.all(tasks);
          if (format.endsWith("-cbz")) {
            const comicInfoXml = `
            <?xml version="1.0" encoding="UTF-8"?>
            <ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
              <Title>${comicInfo.data.title}</Title>
              <Series>${comicInfo.data.title}</Series>
              <Volume>1</Volume>
              <Number>${ep.ord}</Number>
              <Writer>${comicInfo.data.author_name.join("; ")}</Writer>
              <Cover>${comicInfo.data.horizontal_cover}</Cover>
              <PageCount>${downloadUrls.length}</PageCount>
              <Summary>${comicInfo.data.evaluate}</Summary>
              <Manga>YesAndRightToLeft</Manga>
            </ComicInfo>
            `;
            const comicInfoFile = await epFolder.getFileHandle(
              "ComicInfo.xml",
              { create: true }
            );
            const writable = await comicInfoFile.createWritable();
            await writable.write(comicInfoXml);
            await writable.close();
            const zip = new JSZip();
            const epZipFolder = zip.folder(epFolder.name);
            const files = epFolder.values();
            for await (const file of files) {
              const content = await file.getFile();
              epZipFolder.file(file.name, content);
            }
            const blob = await zip.generateAsync({ type: "blob" });
            const cbzFile = await comicFolder.getFileHandle(
              `${epFolder.name}.cbz`,
              { create: true }
            );
            const writableCbz = await cbzFile.createWritable();
            await writableCbz.write(blob);
            await writableCbz.close();
            comicFolder.removeEntry(epFolder.name, { recursive: true });
          }
          if (i % 5 === 0 && i !== unlockedEps.length - 1) {
            const delay = Math.floor(Math.random() * 1000) + 500;
            statusDisplay.addStatus(`等待${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        if (needExport) {
          statusDisplay.addStatus(`导出下载文件`);
          const zip = new JSZip();
          const comicZipFolder = zip.folder(comicFolder.name);
          const eps = comicFolder.values();
          if (format === "zip-cbz") {
            for await (const ep of eps) {
              if (ep.name.endsWith(".cbz")) {
                const epCbzContent = await ep.getFile();
                comicZipFolder.file(ep.name, epCbzContent);
              }
            }
          } else {
            for await (const ep of eps) {
              const epZipFolder = comicZipFolder.folder(ep.name);
              const files = ep.values();
              for await (const file of files) {
                const content = await file.getFile();
                epZipFolder.file(file.name, content);
              }
            }
          }
          if (format === "cbz") {
            const comicInfoXml = `
            <?xml version="1.0" encoding="UTF-8"?>
            <ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
              <Title>${comicInfo.data.title}</Title>
              <Series>${comicInfo.data.title}</Series>
              <Volume>1</Volume>
              <Number>1</Number>
              <Writer>${comicInfo.data.author_name.join("; ")}</Writer>
              <Cover>${comicInfo.data.horizontal_cover}</Cover>
              <Summary>${comicInfo.data.evaluate}</Summary>
              <Manga>YesAndRightToLeft</Manga>
            </ComicInfo>
            `;
            comicZipFolder.file("ComicInfo.xml", comicInfoXml);
          }
          const blob = await zip.generateAsync({ type: "blob" });
          dir.removeEntry(comicFolder.name, { recursive: true });
          const a = document.createElement("a");
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = `${comicFolder.name}.${
            format === "cbz" ? "cbz" : "zip"
          }`;
          a.click();
          URL.revokeObjectURL(url);
        }
        statusDisplay.complete();
        btn.disabled = false;
      });
    };
    createDownloadBtn(toolboxPanel, statusDisplay);
  }
  if (
    location.pathname === "/account-center/my-favourite" ||
    location.pathname === "/account-center/read-history"
  ) {
    const config = { childList: true, subtree: true };
    const targetNode = document.body;
    const mangaMap = new Map();
    const createTag = (mangaData) => {
      const tag = document.createElement("div");
      tag.textContent =
        (mangaData.price === 0 ? "免费" : `${mangaData.price} 币`) +
        ` 未读 ${
          mangaData.readIndex > -1 ? mangaData.readIndex : mangaData.ordCount
        } 话`;
      if (mangaData.dislockedEpCount && mangaData.dislockedEpCount > 0) {
        tag.textContent += ` 未解锁 ${mangaData.dislockedEpCount} 话`;
      }
      tag.className = "b-toolbox-price-tag";
      return tag;
    };
    const reloadMangaData = async (manga) => {
      let { data } = await api.getComicDetail(manga.comic_id);
      const price =
        data?.comic_type === 0
          ? 0
          : data?.ep_list?.find((ep) => ep?.pay_gold !== 0)?.pay_gold ?? 0;
      const latestEpId = data?.ep_list?.[0]?.id;
      const latestEpShortTitle = data?.ep_list?.[0]?.short_title;
      const readIndex = data?.ep_list?.findIndex(
        (ep) => ep.short_title === manga.last_ep_short_title
      );
      const readEpId = data?.ep_list?.[readIndex]?.id;
      const readEpShortTitle = data?.ep_list?.[readIndex]?.short_title;
      const ordCount = data?.ep_list?.length;
      const dislockedEpCount = data?.ep_list?.filter((x) => x.is_locked).length;
      return {
        price,
        latestEpId,
        latestEpShortTitle,
        readEpId,
        readEpShortTitle,
        ordCount,
        readIndex,
        dislockedEpCount,
      };
    };
    const processUnreadManga = async (manga, node) => {
      const isUnread =
        manga.last_ep_short_title !== manga.latest_ep_short_title;
      node.classList.add(
        isUnread ? "b-toolbox-manga-card-unread" : "b-toolbox-manga-card-read"
      );

      if (isUnread) {
        try {
          const mangaCacheKey = `bToolboxMangaCache:${manga.comic_id}`;
          const cachedManga = localStorage.getItem(mangaCacheKey);
          if (cachedManga) {
            let mangaData = JSON.parse(cachedManga);
            if (
              mangaData.ordCount !== manga.ord_count ||
              mangaData.readEpShortTitle !== manga.last_ep_short_title ||
              !mangaData.readIndex
            ) {
              mangaData = await reloadMangaData(manga);
              localStorage.setItem(mangaCacheKey, JSON.stringify(mangaData));
            }
            node.appendChild(createTag(mangaData));
          } else {
            const mangaData = await reloadMangaData(manga);
            localStorage.setItem(mangaCacheKey, JSON.stringify(mangaData));
            node.appendChild(createTag(mangaData));
          }
        } catch (error) {
          console.error(`获取漫画：${manga.comic_id} 价格失败:`, error);
        }
      }
    };
    let page = 1;
    let order = parseInt(localStorage.getItem("BilibiliManga:favListOrder"));
    let lastPathname = location.pathname;
    let getNext =
      lastPathname === "/account-center/my-favourite"
        ? api.listFavorite
        : api.listHistory;
    styles.addStyle(`
        .b-toolbox-manga-card-read { background-color: rgb(123, 213, 85) }
        .b-toolbox-manga-card-unread { background-color: rgb(61, 180, 242) }
        .b-toolbox-price-tag {
          position: absolute;
          left: 0;
          top: 0;
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 2px 4px;
          font-size: 12px;
          border-radius: 0 0 4px 4px;
        }
      `);
    const observer = new MutationObserver(async (mutationsList) => {
      const newOrder = parseInt(
        localStorage.getItem("BilibiliManga:favListOrder")
      );
      if (newOrder !== order) {
        order = newOrder;
        page = 1;
      }
      const newPathname = location.pathname;
      if (newPathname !== lastPathname) {
        if (newPathname === "/account-center/my-favourite") {
          getNext = api.listFavorite;
        } else {
          getNext = api.listHistory;
        }
        page = 1;
        lastPathname = newPathname;
      }
      const mangaList = (await getNext(page++, order)).data;
      mangaList.forEach((manga) => {
        mangaMap.set(manga.comic_id, manga);
      });
      const tasks = [];
      for (const mutation of mutationsList) {
        if (mutation.target.className === "p-relative") {
          if (mutation.addedNodes.length > 0) {
            const node = mutation.addedNodes[0].querySelector(
              ".manga-card-vertical.manga-card"
            );
            if (node) {
              const id = JSON.parse(node.dataset.biliMangaMsg).manga_id;
              const manga = mangaMap.get(id);
              if (manga) {
                tasks.push(processUnreadManga(manga, node));
              }
            }
          }
        } else if (
          mutation.target.className ===
          "list-item dp-i-block p-relative v-top a-move-in-top"
        ) {
          const node = mutation.addedNodes[0];
          if (node) {
            if (!node.dataset) continue;
            const id = JSON.parse(node.dataset.biliMangaMsg).manga_id;
            const manga = mangaMap.get(id);
            if (manga) {
              tasks.push(processUnreadManga(manga, node));
            }
          }
        }
      }
      await Promise.all(tasks);
    });
    observer.observe(targetNode, config);
  }
  if (location.pathname.match(/^\/mc\d+\/\d+$/)) {
    const popupPanel = createPopupPanel(styles);
    const toolboxPanel = createToolboxPanel(popupPanel, styles);
    createToolboxShowBtn(popupPanel, toolboxPanel, styles);
    styles.addStyle(`
    .b-toolbox-popup { z-index:1000; top:70px; right: 2%; position: fixed; border-radius: 6px; max-height: 50% }
    .b-toolbox-toolbox-btn {
      font-family: inherit;
      outline: none;
      user-select: none;
      cursor: pointer;
      transform-origin: center center;
      background-color: rgba(0, 0, 0, .95);
      border: 1px solid #3e3e3e;
      color: hsla(0, 0%, 100%, .7);
      font-size: 12px;
      margin: 5px 0;
      border-radius: 40px;
      padding: 5px 16px;
      width: 135px;
      margin-right: 27px;
    }
    .b-toolbox-toolbox-btn>div {
      font-family: inherit;
      user-select: none;
      cursor: pointer;
      color: hsla(0, 0%, 100%, .7);
      font-size: 12px;
      line-height: 28px;
    }
    .b-toolbox-panel {
      background: rgba(39, 39, 39, .9);
      border-radius: 16px;
      padding: 16px 16px 24px;
      color: #fff;
      animation: scale-in-ease .4s cubic-bezier(.22,.58,.12,.98);
    }
    `);
    const key = "bToolboxResolution";
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const createResolutionSelector = (parentPanel) => {
      const resolutionSelectionContainer = document.createElement("div");
      resolutionSelectionContainer.className =
        "b-toolbox-d-flex b-toolbox-flex-column";
      parentPanel.append(resolutionSelectionContainer);
      const resolutionLabel = document.createElement("label");
      resolutionLabel.innerText = "分辨率选择";
      resolutionSelectionContainer.append(resolutionLabel);
      const resolutionSelect = document.createElement("select");
      resolutionSelect.insertAdjacentHTML(
        "afterbegin",
        `
        <option value="@800w.jpg">低清 - 800w - JPG</option>
        <option value="@1100w.jpg">默认设置 - 1100w - JPG</option>
        <option value="@1400w.jpg">超清 - 1400w - JPG</option>
        <option value="">原图 - 无宽度缩放 - JPG</option>
        <option value="@800w.webp">低清 - 800w - WebP</option>
        <option value="@1100w.webp">高清 - 1100w - WebP</option>
        <option value="@1400w.webp">超清 - 1400w - WebP</option>
        <option value="@1100w.png">仅转码 - 无宽度缩放 - WebP</option>
      `
      );
      resolutionSelectionContainer.append(resolutionSelect);
      const resolution = localStorage.getItem(key);
      if (resolution) {
        resolutionSelect.value = resolution;
      } else {
        resolutionSelect.value = "";
        localStorage.setItem(key, "");
      }
      XMLHttpRequest.prototype.resolution = resolutionSelect.value;
      resolutionSelect.addEventListener("change", () => {
        localStorage.setItem(key, resolutionSelect.value);
        XMLHttpRequest.prototype.resolution = resolutionSelect.value;
      });
    };
    createResolutionSelector(toolboxPanel);
    const createAutoPlayBtn = (parentPanel) => {
      const settingsKey = "bToolboxAutoPlaySettings";
      const settings = JSON.parse(localStorage.getItem(settingsKey)) || {
        interval: 5000,
        stopAtEnd: false,
      };
      const inputContainer = document.createElement("div");
      inputContainer.className = "b-toolbox-d-flex b-toolbox-flex-column";
      parentPanel.append(inputContainer);
      const label = document.createElement("label");
      label.innerText = "自动翻页时间（秒）";
      inputContainer.append(label);
      const input = document.createElement("input");
      input.type = "number";
      input.min = 1;
      input.value = settings.interval / 1000;
      input.step = 1;
      input.addEventListener("change", () => {
        settings.interval = parseInt(input.value) * 1000;
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      });
      inputContainer.append(input);
      const checkBoxContainer = document.createElement("div");
      checkBoxContainer.className = "b-toolbox-d-flex";
      inputContainer.append(checkBoxContainer);
      const checkBox = document.createElement("input");
      checkBox.type = "checkbox";
      checkBox.checked = settings.stopAtEnd;
      checkBox.addEventListener("change", () => {
        settings.stopAtEnd = checkBox.checked;
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      });
      checkBoxContainer.append(checkBox);
      const checkBoxLabel = document.createElement("label");
      checkBoxLabel.innerText = "每话最后一页停止";
      checkBoxContainer.append(checkBoxLabel);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.insertAdjacentHTML("beforeEnd", "<div>自动翻页</div>");
      btn.className = "b-toolbox-toolbox-btn";
      parentPanel.append(btn);
      const tooltips = document.createElement("div");
      tooltips.innerText = "Ctrl + 空格键 暂停/继续 自动翻页";
      tooltips.style.fontSize = "12px";
      parentPanel.append(tooltips);
      let timer = 0;
      const startAutoPlay = () => {
        if (timer) {
          clearInterval(timer);
          timer = 0;
          btn.textContent = "自动翻页";
          input.disabled = false;
          checkBox.disabled = false;
        } else {
          const interval = settings.interval;
          input.disabled = true;
          checkBox.disabled = true;
          timer = setInterval(() => {
            if (settings.stopAtEnd) {
              const endOfEp = document.querySelector(".app-promo");
              if (endOfEp) {
                clearInterval(timer);
                timer = 0;
                btn.textContent = "自动翻页";
                input.disabled = false;
                checkBox.disabled = false;
                return;
              }
            }
            const event = new KeyboardEvent("keyup", {
              key: "ArrowDown",
              code: "ArrowDown",
              bubbles: true,
            });
            document.dispatchEvent(event);
          }, interval);
          btn.textContent = "停止翻页";
        }
      };
      btn.addEventListener("click", startAutoPlay);
      window.addEventListener("keyup", (event) => {
        if (event.key === " " && event.ctrlKey) {
          startAutoPlay();
        }
      });
    };
    createAutoPlayBtn(toolboxPanel);
    XMLHttpRequest.prototype.needModifyBody = false;
    XMLHttpRequest.prototype.open = function (
      method,
      url,
      async,
      user,
      password
    ) {
      if (
        url === "/twirp/comic.v1.Comic/ImageToken?device=pc&platform=web" &&
        method === "POST" &&
        XMLHttpRequest.prototype.resolution !== "@1100w.jpg"
      ) {
        XMLHttpRequest.prototype.needModifyBody = true;
      } else {
        XMLHttpRequest.prototype.needModifyBody = false;
      }
      originalXhrOpen.apply(this, arguments);
    };
    const originalXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      if (this.needModifyBody) {
        const json = JSON.parse(body);
        const urls = JSON.parse(json.urls);
        body = JSON.stringify({
          urls: JSON.stringify(
            urls.map((x) => x.replace(/\@1100w\.jpg$/, this.resolution))
          ),
        });
        originalXhrSend.apply(this, [body]);
      } else {
        originalXhrSend.apply(this, arguments);
      }
    };
  }
})();
