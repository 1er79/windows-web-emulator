window.WineWindows = (() => {
  const area = document.getElementById("window-area");
  const taskbar = document.getElementById("task-buttons");
  const windows = new Map();
  let z = 10, nextId = 1, activeId = null;

  function focus(id) {
    activeId = id;
    for (const [wid, item] of windows) {
      item.el.style.zIndex = wid === id ? ++z : item.el.style.zIndex;
      item.el.classList.toggle("inactive", wid !== id);
      item.task.classList.toggle("active", wid === id);
    }
  }

  function open(title, content, status = "Pronto") {
    const id = nextId++;
    const el = document.createElement("section");
    el.className = "window";
    el.style.left = `${Math.max(12, 80 + (id - 1) * 24)}px`;
    el.style.top = `${Math.max(12, 45 + (id - 1) * 22)}px`;
    el.style.zIndex = ++z;
    el.innerHTML = `
      <header class="titlebar">
        <span class="window-title"></span>
        <span class="window-controls">
          <button data-action="min" aria-label="Minimizar">_</button>
          <button data-action="max" aria-label="Maximizar">□</button>
          <button data-action="close" aria-label="Fechar">×</button>
        </span>
      </header>
      <div class="window-content"></div><div class="window-status"></div>`;
    el.querySelector(".window-title").textContent = title;
    el.querySelector(".window-content").append(content);
    el.querySelector(".window-status").textContent = status;
    area.append(el);

    const task = document.createElement("button");
    task.className = "task-button active";
    task.textContent = title;
    task.addEventListener("click", () => {
      if (el.dataset.minimized === "true") {
        el.style.display = "flex"; el.dataset.minimized = "false"; focus(id);
      } else if (activeId === id) {
        el.style.display = "none"; el.dataset.minimized = "true";
      } else focus(id);
    });
    taskbar.append(task);
    windows.set(id, { el, task });
    focus(id);

    el.addEventListener("pointerdown", () => focus(id));
    el.querySelector('[data-action="close"]').addEventListener("click", () => {
      el.remove(); task.remove(); windows.delete(id);
      if (activeId === id) activeId = null;
    });
    el.querySelector('[data-action="min"]').addEventListener("click", () => {
      el.style.display = "none"; el.dataset.minimized = "true";
    });
    el.querySelector('[data-action="max"]').addEventListener("click", () => el.classList.toggle("maximized"));
    makeDraggable(el, el.querySelector(".titlebar"));
    return { id, element: el, content: el.querySelector(".window-content"), status: el.querySelector(".window-status") };
  }

  function makeDraggable(el, handle) {
    let startX, startY, startLeft, startTop, dragging = false;
    handle.addEventListener("pointerdown", e => {
      if (e.target.closest("button") || el.classList.contains("maximized")) return;
      dragging = true; focus([...windows].find(([,v]) => v.el === el)?.[0]);
      startX = e.clientX; startY = e.clientY;
      startLeft = el.offsetLeft; startTop = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", e => {
      if (!dragging) return;
      el.style.left = `${Math.max(0, Math.min(window.innerWidth - 100, startLeft + e.clientX - startX))}px`;
      el.style.top = `${Math.max(0, Math.min(window.innerHeight - 90, startTop + e.clientY - startY))}px`;
    });
    handle.addEventListener("pointerup", () => dragging = false);
    handle.addEventListener("pointercancel", () => dragging = false);
  }
  return { open, focus };
})();
