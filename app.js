/* ==========================================================================
   微波论坛 · 交互逻辑
   数据层（localStorage） / 渲染层 / 交互层
   ========================================================================== */
(function () {
  "use strict";

  var KEY_POSTS = "mwb.posts.v1";
  var KEY_USER = "mwb.user.v1";
  var LIMIT = 140;

  var AVATARS = [
    "linear-gradient(140deg,#FFC28A,#FF6B2C)",
    "linear-gradient(140deg,#9BD8FF,#2B7CF6)",
    "linear-gradient(140deg,#A9E9C6,#2FA36B)",
    "linear-gradient(140deg,#FFC2CF,#E0483C)",
    "linear-gradient(140deg,#D6C6FF,#6F4CE0)",
    "linear-gradient(140deg,#FFE7A3,#F0A020)"
  ];

  var SVG_NS = "http://www.w3.org/2000/svg";
  var HEART_PATH = "M12 20s-7-4.2-7-9a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 4.8-7 9-7 9Z";
  var TRASH_PATHS = ["M4.5 7h15", "M9.5 7V4.8h5V7", "M6.8 7l.9 12.2h8.6L17.2 7", "M10.4 10.6v5.4", "M13.6 10.6v5.4"];

  var state = {
    posts: [],
    user: null,
    query: "",
    filter: "all"
  };

  var dom = {};
  var toastTimer = null;
  var storageWarned = false;

  /* ------------------------------------------------------------------ 工具 */

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function countChars(text) {
    return Array.from(text || "").length;
  }

  function hashOf(text) {
    var hash = 0;
    var source = String(text || "");
    for (var i = 0; i < source.length; i += 1) {
      hash = (hash * 31 + source.charCodeAt(i)) % 9973;
    }
    return hash;
  }

  function gradientOf(seed) {
    return AVATARS[hashOf(seed) % AVATARS.length];
  }

  function initialOf(name) {
    var chars = Array.from(String(name || "?").trim());
    return (chars[0] || "?").toUpperCase();
  }

  function pad(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function formatTime(timestamp) {
    var now = Date.now();
    var diff = Math.max(0, now - timestamp);
    var minute = 60000;
    var hour = 60 * minute;
    var day = 24 * hour;

    if (diff < minute) return "刚刚";
    if (diff < hour) return Math.floor(diff / minute) + " 分钟前";
    if (diff < day) return Math.floor(diff / hour) + " 小时前";
    if (diff < 7 * day) return Math.floor(diff / day) + " 天前";

    var date = new Date(timestamp);
    var sameYear = date.getFullYear() === new Date(now).getFullYear();
    var stamp = date.getMonth() + 1 + " 月 " + date.getDate() + " 日";
    return sameYear ? stamp : date.getFullYear() + " 年 " + stamp;
  }

  function fullTime(timestamp) {
    var date = new Date(timestamp);
    return (
      date.getFullYear() +
      "-" + pad(date.getMonth() + 1) +
      "-" + pad(date.getDate()) +
      " " + pad(date.getHours()) +
      ":" + pad(date.getMinutes())
    );
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function svgIcon(paths) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    paths.forEach(function (d) {
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    });
    return svg;
  }

  function paintAvatar(node, name, seed) {
    node.textContent = initialOf(name);
    node.style.backgroundImage = gradientOf(seed || name);
  }

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      dom.toast.classList.remove("is-visible");
    }, 2200);
  }

  /* -------------------------------------------------------------- 数据层 */

  function readJSON(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (!storageWarned) {
        storageWarned = true;
        toast("本地存储不可用，内容仅保留在本次会话中");
      }
      return false;
    }
  }

  function normalizePosts(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(function (item) {
        return item && typeof item.content === "string" && item.content.trim();
      })
      .map(function (item) {
        return {
          id: typeof item.id === "string" && item.id ? item.id : uid(),
          authorId: typeof item.authorId === "string" ? item.authorId : "unknown",
          author: typeof item.author === "string" && item.author ? item.author : "匿名用户",
          content: item.content,
          createdAt: Number(item.createdAt) || Date.now(),
          likes: Math.max(0, Number(item.likes) || 0),
          likedByMe: Boolean(item.likedByMe)
        };
      });
  }

  function buildSeeds(now) {
    var seeds = [
      {
        author: "微波小厨",
        content: "新的一天，先把水烧上。热水冲开的茶叶，比任何提醒都更像一句“开始吧”。",
        minutes: 6,
        likes: 12
      },
      {
        author: "深夜放映员",
        content: "凌晨的街道只有便利店还亮着。买了一瓶温热的豆奶，站在门口喝完，忽然觉得这座城市也挺温柔。",
        minutes: 74,
        likes: 28
      },
      {
        author: "图层收藏家",
        content: "今日小结：\n1. 把桌面清空了一次\n2. 走了 8200 步\n3. 认真吃完了一顿饭\n微小但确切的三件事。",
        minutes: 320,
        likes: 7
      }
    ];

    return seeds.map(function (seed, index) {
      return {
        id: "seed-" + (index + 1),
        authorId: "seed-author-" + (index + 1),
        author: seed.author,
        content: seed.content,
        createdAt: now - seed.minutes * 60000,
        likes: seed.likes,
        likedByMe: false
      };
    });
  }

  function loadState() {
    var now = Date.now();
    var storedPosts = readJSON(KEY_POSTS);
    state.posts = storedPosts === null ? buildSeeds(now) : normalizePosts(storedPosts);
    if (storedPosts === null) writeJSON(KEY_POSTS, state.posts);

    var storedUser = readJSON(KEY_USER);
    if (storedUser && typeof storedUser.name === "string" && storedUser.name.trim()) {
      state.user = {
        id: typeof storedUser.id === "string" && storedUser.id ? storedUser.id : uid(),
        name: storedUser.name.trim().slice(0, 12)
      };
    } else {
      state.user = { id: uid(), name: "微波过客" };
      writeJSON(KEY_USER, state.user);
    }
    if (!storedUser || storedUser.id !== state.user.id) writeJSON(KEY_USER, state.user);
  }

  function savePosts() {
    writeJSON(KEY_POSTS, state.posts);
  }

  function saveUser() {
    writeJSON(KEY_USER, state.user);
  }

  /* -------------------------------------------------------------- 渲染层 */

  function renderUser() {
    dom.userName.textContent = state.user.name;
    paintAvatar(dom.userAvatar, state.user.name, state.user.id + state.user.name);
    paintAvatar(dom.composerAvatar, state.user.name, state.user.id + state.user.name);
  }

  function visiblePosts() {
    var query = state.query.trim().toLowerCase();
    return state.posts
      .filter(function (post) {
        if (state.filter === "mine" && post.authorId !== state.user.id) return false;
        if (!query) return true;
        return (
          post.content.toLowerCase().indexOf(query) !== -1 ||
          post.author.toLowerCase().indexOf(query) !== -1
        );
      })
      .sort(function (a, b) {
        return b.createdAt - a.createdAt;
      });
  }

  function createPostNode(post) {
    var article = document.createElement("article");
    article.className = "post";
    article.dataset.id = post.id;

    var head = el("header", "post__head");
    var avatar = el("span", "avatar");
    paintAvatar(avatar, post.author, post.authorId + post.author);

    var who = el("div", "post__who");
    var nameRow = el("span", "post__name");
    nameRow.appendChild(document.createTextNode(post.author));
    if (post.authorId === state.user.id) nameRow.appendChild(el("span", "post__badge", "我"));
    var time = el("time", "post__time", formatTime(post.createdAt));
    time.dateTime = new Date(post.createdAt).toISOString();
    time.title = fullTime(post.createdAt);
    who.appendChild(nameRow);
    who.appendChild(time);

    head.appendChild(avatar);
    head.appendChild(who);

    var body = el("p", "post__body", post.content);

    var actions = el("div", "post__actions");

    var likeBtn = el("button", "post__action" + (post.likedByMe ? " is-liked" : ""));
    likeBtn.type = "button";
    likeBtn.dataset.action = "like";
    likeBtn.setAttribute("aria-pressed", post.likedByMe ? "true" : "false");
    likeBtn.setAttribute("aria-label", post.likedByMe ? "取消点赞" : "点赞");
    likeBtn.appendChild(svgIcon([HEART_PATH]));
    likeBtn.appendChild(el("span", "post__action-count", String(post.likes)));
    actions.appendChild(likeBtn);

    if (post.authorId === state.user.id) {
      var delBtn = el("button", "post__action post__action--delete");
      delBtn.type = "button";
      delBtn.dataset.action = "delete";
      delBtn.setAttribute("aria-label", "删除这条动态");
      delBtn.appendChild(svgIcon(TRASH_PATHS));
      delBtn.appendChild(el("span", null, "删除"));
      actions.appendChild(delBtn);
    }

    article.appendChild(head);
    article.appendChild(body);
    article.appendChild(actions);
    return article;
  }

  function createEmptyNode(totalCount) {
    var wrap = el("div", "empty");

    var art = el("div", "empty__art");
    art.setAttribute("aria-hidden", "true");
    art.appendChild(el("span", "empty__ring"));
    art.appendChild(el("span", "empty__core"));

    var title = "这里还很安静";
    var desc = "发布第一条动态，记录此刻的微波时刻。";
    var action = "开始发布";

    if (state.query.trim()) {
      title = "没有找到相关内容";
      desc = "换个关键词试试，或清空搜索看看全部动态。";
      action = "清空搜索";
    } else if (state.filter === "mine" && totalCount > 0) {
      title = "你还没有发布过";
      desc = "时间线里有 " + totalCount + " 条动态，写下你的第一条吧。";
      action = "去发布";
    } else if (state.filter === "mine") {
      title = "你的主页还是空的";
      desc = "发布一条动态，让这里留下你的第一句话。";
      action = "去发布";
    }

    wrap.appendChild(art);
    wrap.appendChild(el("p", "empty__title", title));
    wrap.appendChild(el("p", "empty__desc", desc));

    var btn = el("button", "btn btn--primary");
    btn.type = "button";
    btn.dataset.action = "empty-cta";
    btn.appendChild(el("span", null, action));
    wrap.appendChild(btn);
    return wrap;
  }

  function renderTimeline() {
    var list = visiblePosts();
    var fragment = document.createDocumentFragment();

    if (!list.length) {
      fragment.appendChild(createEmptyNode(state.posts.length));
    } else {
      list.forEach(function (post, index) {
        var node = createPostNode(post);
        node.style.animationDelay = Math.min(index, 6) * 0.03 + "s";
        fragment.appendChild(node);
      });
    }

    dom.timeline.replaceChildren(fragment);
  }

  function updateComposerState() {
    var text = dom.composerInput.value;
    var length = countChars(text);
    var over = length > LIMIT;

    dom.charCount.textContent = length + " / " + LIMIT;
    dom.charCount.classList.toggle("is-warn", length > LIMIT - 20 && !over);
    dom.charCount.classList.toggle("is-danger", over);
    dom.publishBtn.disabled = !text.trim() || over;
  }

  function setFilter(filter) {
    state.filter = filter;
    dom.segmented.dataset.active = filter;
    Array.prototype.forEach.call(dom.segmented.querySelectorAll("[data-filter]"), function (btn) {
      var active = btn.dataset.filter === filter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  /* -------------------------------------------------------------- 交互层 */

  function publish() {
    var text = dom.composerInput.value.trim();
    if (!text) {
      toast("写点什么再发布吧");
      dom.composerInput.focus();
      return;
    }
    if (countChars(text) > LIMIT) {
      toast("超出 " + LIMIT + " 字上限，请精简后再试");
      dom.composerInput.classList.add("is-shaking");
      window.setTimeout(function () {
        dom.composerInput.classList.remove("is-shaking");
      }, 460);
      return;
    }

    state.posts.unshift({
      id: uid(),
      authorId: state.user.id,
      author: state.user.name,
      content: text,
      createdAt: Date.now(),
      likes: 0,
      likedByMe: false
    });

    savePosts();
    dom.composerInput.value = "";
    updateComposerState();
    renderTimeline();
    toast("已发布");
    if (state.filter === "mine" || state.query.trim()) {
      setFilter("all");
      dom.searchInput.value = "";
      state.query = "";
      renderTimeline();
    }
  }

  function toggleLike(button, id) {
    var post = state.posts.find(function (item) {
      return item.id === id;
    });
    if (!post) return;

    post.likedByMe = !post.likedByMe;
    post.likes = Math.max(0, post.likes + (post.likedByMe ? 1 : -1));
    savePosts();

    button.classList.toggle("is-liked", post.likedByMe);
    button.setAttribute("aria-pressed", post.likedByMe ? "true" : "false");
    button.setAttribute("aria-label", post.likedByMe ? "取消点赞" : "点赞");
    var counter = button.querySelector(".post__action-count");
    if (counter) counter.textContent = String(post.likes);

    button.classList.remove("is-bumping");
    void button.offsetWidth;
    button.classList.add("is-bumping");
    window.setTimeout(function () {
      button.classList.remove("is-bumping");
    }, 440);
  }

  function deletePost(article, id) {
    var post = state.posts.find(function (item) {
      return item.id === id;
    });
    if (!post) return;
    if (post.authorId !== state.user.id) {
      toast("只能删除自己发布的内容");
      return;
    }
    if (!window.confirm("确定删除这条动态吗？删除后无法恢复。")) return;

    article.classList.add("is-removing");
    window.setTimeout(function () {
      state.posts = state.posts.filter(function (item) {
        return item.id !== id;
      });
      savePosts();
      renderTimeline();
      toast("已删除");
    }, 260);
  }

  function openUserDialog() {
    dom.userNameInput.value = state.user.name;
    document.body.classList.add("is-locked");
    if (typeof dom.userDialog.showModal === "function") {
      dom.userDialog.showModal();
    } else {
      dom.userDialog.setAttribute("open", "");
    }
    window.setTimeout(function () {
      dom.userNameInput.focus();
      dom.userNameInput.select();
    }, 40);
  }

  function closeUserDialog() {
    document.body.classList.remove("is-locked");
    if (typeof dom.userDialog.close === "function") {
      dom.userDialog.close();
    } else {
      dom.userDialog.removeAttribute("open");
    }
  }

  function saveUserName(event) {
    event.preventDefault();
    var name = dom.userNameInput.value.trim();
    if (!name) {
      toast("昵称不能为空");
      dom.userNameInput.focus();
      return;
    }
    name = Array.from(name).slice(0, 12).join("");

    state.user.name = name;
    state.posts.forEach(function (post) {
      if (post.authorId === state.user.id) post.author = name;
    });
    saveUser();
    savePosts();
    closeUserDialog();
    renderUser();
    renderTimeline();
    toast("昵称已更新");
  }

  /* ------------------------------------------------------------------ 初始化 */

  function cacheDom() {
    dom.timeline = document.getElementById("timeline");
    dom.composerInput = document.getElementById("composerInput");
    dom.publishBtn = document.getElementById("publishBtn");
    dom.charCount = document.getElementById("charCount");
    dom.searchInput = document.getElementById("searchInput");
    dom.segmented = document.getElementById("segmented");
    dom.userAvatar = document.getElementById("userAvatar");
    dom.userName = document.getElementById("userName");
    dom.composerAvatar = document.getElementById("composerAvatar");
    dom.editUserBtn = document.getElementById("editUserBtn");
    dom.userDialog = document.getElementById("userDialog");
    dom.userForm = document.getElementById("userForm");
    dom.userNameInput = document.getElementById("userNameInput");
    dom.cancelUserBtn = document.getElementById("cancelUserBtn");
    dom.toast = document.getElementById("toast");
    dom.topbar = document.getElementById("topbar");
  }

  function bindEvents() {
    dom.composerInput.addEventListener("input", updateComposerState);
    dom.composerInput.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (!dom.publishBtn.disabled) publish();
      }
    });
    dom.publishBtn.addEventListener("click", publish);

    dom.searchInput.addEventListener("input", function () {
      state.query = dom.searchInput.value;
      renderTimeline();
    });

    dom.segmented.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-filter]");
      if (!btn) return;
      if (btn.dataset.filter === state.filter) return;
      setFilter(btn.dataset.filter);
      renderTimeline();
    });

    dom.timeline.addEventListener("click", function (event) {
      var cta = event.target.closest('[data-action="empty-cta"]');
      if (cta) {
        if (state.query.trim()) {
          dom.searchInput.value = "";
          state.query = "";
          renderTimeline();
          dom.searchInput.focus();
        } else {
          dom.composerInput.focus();
          dom.composerInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      var actionBtn = event.target.closest("[data-action]");
      if (!actionBtn) return;
      var article = actionBtn.closest(".post");
      if (!article) return;
      var id = article.dataset.id;

      if (actionBtn.dataset.action === "like") toggleLike(actionBtn, id);
      if (actionBtn.dataset.action === "delete") deletePost(article, id);
    });

    dom.editUserBtn.addEventListener("click", openUserDialog);
    dom.cancelUserBtn.addEventListener("click", function () {
      closeUserDialog();
    });
    dom.userForm.addEventListener("submit", saveUserName);
    dom.userDialog.addEventListener("close", function () {
      document.body.classList.remove("is-locked");
    });
    dom.userDialog.addEventListener("click", function (event) {
      if (event.target === dom.userDialog) closeUserDialog();
    });

    window.addEventListener(
      "scroll",
      function () {
        dom.topbar.classList.toggle("is-scrolled", window.scrollY > 8);
      },
      { passive: true }
    );
  }

  function init() {
    cacheDom();
    loadState();
    renderUser();
    updateComposerState();
    setFilter("all");
    renderTimeline();
    bindEvents();
    dom.topbar.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
