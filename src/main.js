(() => {
  const startButton = document.getElementById("start-button");
  const menu = document.getElementById("start-menu");
  const picker = document.getElementById("file-picker");
  const clock = document.getElementById("clock");

  startButton.addEventListener("click", () => {
    const opened = menu.classList.toggle("hidden") === false;
    startButton.setAttribute("aria-expanded", String(opened));
  });

  menu.addEventListener("click", async event => {
    const target = event.target.closest("[data-open], #start-load");
    if (!target) return;
    menu.classList.add("hidden");
    startButton.setAttribute("aria-expanded", "false");
    if (target.id === "start-load") picker.click();
    else await WineApps.open(target.dataset.open);
  });

  document.querySelectorAll(".desktop-icon").forEach(button => {
    button.addEventListener("dblclick", () => WineApps.open(button.dataset.open));
    button.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        WineApps.open(button.dataset.open);
      }
    });
  });

  picker.addEventListener("change", async () => {
    const files = [...picker.files];
    if (!files.length) return;
    try {
      for (const file of files) await WineStorage.saveFile(file);
      const win = await WineApps.open("files");
      win.status.textContent = `${files.length} arquivo(s) salvo(s) no IndexedDB deste navegador.`;
    } catch (error) {
      alert(`Não foi possível armazenar os arquivos: ${error.message}`);
    }
    picker.value = "";
  });

  function updateClock() {
    clock.textContent = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  }
  updateClock();
  window.setInterval(updateClock, 30000);

  // Remove o Service Worker de cache da versão 0.1, se o usuário já o tiver
  // instalado. A build oficial COI do Boxedwine64 assume essa mesma origem.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        const script = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || "";
        if (script.endsWith("/sw.js")) registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }

  if (WineRuntime.consumeAutoStart()) {
    window.setTimeout(() => WineApps.open("runtime"), 300);
  }
})();
