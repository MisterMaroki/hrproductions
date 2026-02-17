"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface GalleryPhoto {
  id: string;
  filename: string;
  title: string;
  sortOrder: number;
  visible: number;
  createdAt: string;
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const syncPhotos = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/photos/sync");
      if (res.ok) setPhotos(await res.json());
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    syncPhotos();
  }, [syncPhotos]);

  const toggleVisible = async (id: string, currentVisible: number) => {
    await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visible: currentVisible ? 0 : 1 }),
    });
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, visible: currentVisible ? 0 : 1 } : p
      )
    );
  };

  const movePhoto = async (id: string, direction: "up" | "down") => {
    const idx = photos.findIndex((p) => p.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= photos.length) return;

    const current = photos[idx];
    const swap = photos[swapIdx];

    await Promise.all([
      fetch("/api/admin/photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, sortOrder: swap.sortOrder }),
      }),
      fetch("/api/admin/photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: swap.id, sortOrder: current.sortOrder }),
      }),
    ]);

    setPhotos((prev) => {
      const next = [...prev];
      next[idx] = { ...current, sortOrder: swap.sortOrder };
      next[swapIdx] = { ...swap, sortOrder: current.sortOrder };
      next.sort((a, b) => a.sortOrder - b.sortOrder);
      return next;
    });
  };

  const startEdit = (photo: GalleryPhoto) => {
    setEditingId(photo.id);
    setEditTitle(photo.title);
  };

  const saveTitle = async (id: string) => {
    if (!editTitle.trim()) return;
    await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editTitle.trim() }),
    });
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: editTitle.trim() } : p))
    );
    setEditingId(null);
  };

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h2 className={styles.title}>Gallery Photos</h2>
            <button
              className={styles.syncBtn}
              onClick={syncPhotos}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync from Bunny"}
            </button>
          </div>

          <p className={styles.hint}>
            Upload photos to the Bunny Storage Zone images/ folder, then sync here to manage visibility and order.
          </p>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Title</span>
              <span>Filename</span>
              <span>Order</span>
              <span>Visible</span>
            </div>
            {photos.map((p) => (
              <div
                key={p.id}
                className={`${styles.tableRow} ${!p.visible ? styles.hidden : ""}`}
              >
                <span className={styles.titleCell}>
                  {editingId === p.id ? (
                    <form
                      className={styles.editForm}
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveTitle(p.id);
                      }}
                    >
                      <input
                        className={styles.editInput}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                      />
                      <button className={styles.saveBtn} type="submit">
                        Save
                      </button>
                      <button
                        className={styles.cancelBtn}
                        type="button"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      className={styles.titleBtn}
                      onClick={() => startEdit(p)}
                    >
                      {p.title}
                    </button>
                  )}
                </span>
                <span className={styles.idCell}>{p.filename}</span>
                <span className={styles.orderCell}>
                  <button
                    className={styles.arrowBtn}
                    onClick={() => movePhoto(p.id, "up")}
                    disabled={photos.indexOf(p) === 0}
                  >
                    ↑
                  </button>
                  <button
                    className={styles.arrowBtn}
                    onClick={() => movePhoto(p.id, "down")}
                    disabled={photos.indexOf(p) === photos.length - 1}
                  >
                    ↓
                  </button>
                </span>
                <button
                  className={`${styles.toggleBtn} ${p.visible ? styles.toggleActive : styles.toggleInactive}`}
                  onClick={() => toggleVisible(p.id, p.visible)}
                >
                  {p.visible ? "Visible" : "Hidden"}
                </button>
              </div>
            ))}
            {photos.length === 0 && !syncing && (
              <p className={styles.empty}>
                No photos found. Upload images to Bunny Storage and click "Sync from Bunny".
              </p>
            )}
            {syncing && photos.length === 0 && (
              <p className={styles.empty}>Syncing…</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
