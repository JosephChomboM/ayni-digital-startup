export interface LocalFamilyPhoto {
  id: string;
  family_id: string;
  created_by: string;
  creator_name: string;
  name: string;
  mime_type: string;
  blob: Blob;
  created_at: string;
}

const DB_NAME = "ayni-family-media";
const STORE_NAME = "photos";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no permite guardar fotos localmente."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("family_id", "family_id", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("No pudimos abrir el espacio local de fotos."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("No pudimos guardar o consultar las fotos."));
  });
}

export async function getLocalFamilyPhotos(familyId: string): Promise<LocalFamilyPhoto[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const photos = await requestResult(transaction.objectStore(STORE_NAME).index("family_id").getAll(familyId)) as LocalFamilyPhoto[];
    return photos.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } finally { database.close(); }
}

export async function saveLocalFamilyPhoto(photo: LocalFamilyPhoto): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestResult(transaction.objectStore(STORE_NAME).put(photo));
  } finally { database.close(); }
}

export async function deleteLocalFamilyPhoto(photoId: string, familyId: string, userId: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const photo = await requestResult(store.get(photoId)) as LocalFamilyPhoto | undefined;
    if (photo?.family_id === familyId && photo.created_by === userId) {
      await requestResult(store.delete(photoId));
    }
  } finally { database.close(); }
}
