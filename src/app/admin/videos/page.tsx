"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface GalleryVideo {
  id: string;
  bunnyVideoId: string;
  title: string;
  sortOrder: number;
  visible: number;
  createdAt: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const syncVideos = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/videos/sync");
      if (res.ok) setVideos(await res.json());
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    syncVideos();
  }, [syncVideos]);

  const toggleVisible = async (id: string, currentVisible: number) => {
    await fetch("/api/admin/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visible: currentVisible ? 0 : 1 }),
    });
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, visible: currentVisible ? 0 : 1 } : v
      )
    );
  };

  const moveVideo = async (id: string, direction: "up" | "down") => {
    const idx = videos.findIndex((v) => v.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= videos.length) return;

    const current = videos[idx];
    const swap = videos[swapIdx];

    await Promise.all([
      fetch("/api/admin/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, sortOrder: swap.sortOrder }),
      }),
      fetch("/api/admin/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: swap.id, sortOrder: current.sortOrder }),
      }),
    ]);

    setVideos((prev) => {
      const next = [...prev];
      next[idx] = { ...current, sortOrder: swap.sortOrder };
      next[swapIdx] = { ...swap, sortOrder: current.sortOrder };
      next.sort((a, b) => a.sortOrder - b.sortOrder);
      return next;
    });
  };

  const startEdit = (video: GalleryVideo) => {
    setEditingId(video.id);
    setEditTitle(video.title);
  };

  const saveTitle = async (id: string) => {
    if (!editTitle.trim()) return;
    await fetch("/api/admin/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editTitle.trim() }),
    });
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, title: editTitle.trim() } : v))
    );
    setEditingId(null);
  };

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h2 className={styles.title}>Gallery Videos</h2>
            <button
              className={styles.syncBtn}
              onClick={syncVideos}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync from Bunny"}
            </button>
          </div>

          <p className={styles.hint}>
            Upload videos in the Bunny Stream dashboard, then sync here to manage visibility and order.
          </p>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Title</span>
              <span>Video ID</span>
              <span>Order</span>
              <span>Visible</span>
            </div>
            {videos.map((v) => (
              <div
                key={v.id}
                className={`${styles.tableRow} ${!v.visible ? styles.hidden : ""}`}
              >
                <span className={styles.titleCell}>
                  {editingId === v.id ? (
                    <form
                      className={styles.editForm}
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveTitle(v.id);
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
                      onClick={() => startEdit(v)}
                    >
                      {v.title}
                    </button>
                  )}
                </span>
                <span className={styles.idCell}>{v.bunnyVideoId.slice(0, 8)}…</span>
                <span className={styles.orderCell}>
                  <button
                    className={styles.arrowBtn}
                    onClick={() => moveVideo(v.id, "up")}
                    disabled={videos.indexOf(v) === 0}
                  >
                    ↑
                  </button>
                  <button
                    className={styles.arrowBtn}
                    onClick={() => moveVideo(v.id, "down")}
                    disabled={videos.indexOf(v) === videos.length - 1}
                  >
                    ↓
                  </button>
                </span>
                <button
                  className={`${styles.toggleBtn} ${v.visible ? styles.toggleActive : styles.toggleInactive}`}
                  onClick={() => toggleVisible(v.id, v.visible)}
                >
                  {v.visible ? "Visible" : "Hidden"}
                </button>
              </div>
            ))}
            {videos.length === 0 && !syncing && (
              <p className={styles.empty}>
                No videos found. Upload videos to Bunny Stream and click "Sync from Bunny".
              </p>
            )}
            {syncing && videos.length === 0 && (
              <p className={styles.empty}>Syncing…</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
