/* Armazenamento local do Wine Web. Os arquivos ficam no navegador. */
window.WineStorage = (() => {
  const DB_NAME = "wine-web-01";
  const STORE = "files";
  let dbPromise;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB indisponível."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function saveFile(file) {
    const db = await openDB();
    const record = { id: crypto.randomUUID(), name: file.name, type: file.type || "application/octet-stream",
      size: file.size, modified: file.lastModified, data: await file.arrayBuffer(), savedAt: Date.now() };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return record;
  }

  async function listFiles() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result.sort((a,b) => a.name.localeCompare(b.name)));
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteFile(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  return { saveFile, listFiles, deleteFile };
})();
