'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { IconUpload, IconTrash, IconDocument, IconLogOut, IconUser, IconLink, IconVideo, IconPlay } from '@/components/ui/Icons';
import Toast from '@/components/ui/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { ToastMessage } from '@/types';

const SPINNER_NAMES = ['Arifin', 'Syam', 'Regina', 'David', 'Iqbal', 'Hanifah'];

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

interface CacheEntry {
  id: string;
  question_key: string;
  original_question: string;
  response_text: string;
  has_audio: boolean;
  created_at: string;
  updated_at: string;
}

interface RecapVideo {
  id: string;
  title: string;
  url: string;
  embed_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: '', name: '', type: 'doc' as 'doc' | 'cache' | 'cache-all' | 'spinner-photo' | 'video' });
  const [spinnerPhotos, setSpinnerPhotos] = useState<Record<string, string>>({});
  const [isSpinnerLoading, setIsSpinnerLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([]);
  const [isCacheLoading, setIsCacheLoading] = useState(true);
  const [recapVideos, setRecapVideos] = useState<RecapVideo[]>([]);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isVideoAdding, setIsVideoAdding] = useState(false);
  const [videoForm, setVideoForm] = useState({ title: '', url: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetchDocuments();
    fetchCache();
    fetchSpinnerPhotos();
    fetchVideos();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/admin/documents');
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch {
      addToast('error', 'Gagal memuat dokumen');
    } finally {
      setIsLoading(false);
    }
  };

  const addToast = (type: ToastMessage['type'], message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      addToast('error', 'Hanya file PDF yang didukung');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        addToast('success', `Berhasil unggah: ${data.chunksCount} bagian diproses`);
        fetchDocuments();
      } else {
        addToast('error', data.message || 'Gagal mengunggah');
      }
    } catch {
      addToast('error', 'Terjadi kesalahan jaringan');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const promptDelete = (id: string, name: string) => {
    setDeleteModal({ isOpen: true, id, name, type: 'doc' });
  };

  const confirmDelete = async () => {
    const { id, type, name } = deleteModal;

    if (type === 'cache-all') {
      setIsDeleting(true);
      try {
        const res = await fetch('/api/admin/cache?all=true', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          addToast('success', 'Semua cache berhasil dihapus');
          fetchCache();
        } else {
          addToast('error', data.error || 'Gagal menghapus');
        }
      } catch {
        addToast('error', 'Kesalahan server');
      } finally {
        setIsDeleting(false);
        setDeleteModal({ isOpen: false, id: '', name: '', type: 'doc' });
      }
      return;
    }

    if (type === 'video') {
      setIsDeleting(true);
      try {
        const res = await fetch(`/api/admin/videos?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          addToast('success', `Video "${name}" berhasil dihapus`);
          fetchVideos();
        } else {
          addToast('error', data.message || 'Gagal menghapus video');
        }
      } catch {
        addToast('error', 'Kesalahan server');
      } finally {
        setIsDeleting(false);
        setDeleteModal({ isOpen: false, id: '', name: '', type: 'doc' });
      }
      return;
    }

    if (type === 'spinner-photo') {
      setIsDeleting(true);
      try {
        const res = await fetch(`/api/admin/spinner-photos?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          addToast('success', `Foto untuk ${name} berhasil dihapus`);
          fetchSpinnerPhotos();
        } else {
          addToast('error', data.message || 'Gagal menghapus foto');
        }
      } catch {
        addToast('error', 'Kesalahan server');
      } finally {
        setIsDeleting(false);
        setDeleteModal({ isOpen: false, id: '', name: '', type: 'doc' });
      }
      return;
    }

    if (type === 'cache') {
      setIsDeleting(true);
      try {
        const res = await fetch(`/api/admin/cache?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          addToast('success', 'Cache entry berhasil dihapus');
          fetchCache();
        } else {
          addToast('error', data.error || 'Gagal menghapus');
        }
      } catch {
        addToast('error', 'Kesalahan server');
      } finally {
        setIsDeleting(false);
        setDeleteModal({ isOpen: false, id: '', name: '', type: 'doc' });
      }
      return;
    }

    // Document delete
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/documents?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Dokumen berhasil dihapus');
        fetchDocuments();
      } else {
        addToast('error', data.message || 'Gagal menghapus');
      }
    } catch {
      addToast('error', 'Kesalahan server saat menghapus');
    } finally {
      setIsDeleting(false);
      setDeleteModal({ isOpen: false, id: '', name: '', type: 'doc' });
    }
  };

  // --- Cache Management ---
  const fetchCache = async () => {
    try {
      const res = await fetch('/api/admin/cache');
      if (res.status === 401) return;
      const data = await res.json();
      if (data.success) setCacheEntries(data.items);
    } catch {
      // silent
    } finally {
      setIsCacheLoading(false);
    }
  };

  const fetchSpinnerPhotos = async () => {
    try {
      const res = await fetch('/api/admin/spinner-photos');
      const data = await res.json();
      if (data.success) setSpinnerPhotos(data.photos);
    } catch {
      // silent
    } finally {
      setIsSpinnerLoading(false);
    }
  };

  const handleSpinnerPhotoUpload = async (name: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('error', 'Hanya file gambar yang didukung');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);

    setIsSpinnerLoading(true);
    try {
      const res = await fetch('/api/admin/spinner-photos', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Berhasil unggah foto untuk ${name}`);
        fetchSpinnerPhotos();
      } else {
        addToast('error', data.message || 'Gagal unggah foto');
      }
    } catch {
      addToast('error', 'Terjadi kesalahan jaringan');
    } finally {
      setIsSpinnerLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // --- Video Rekap ---
  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/admin/videos');
      const data = await res.json();
      if (data.success) setRecapVideos(data.videos);
    } catch {
      // silent
    } finally {
      setIsVideoLoading(false);
    }
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoForm.title.trim() || !videoForm.url.trim()) {
      addToast('error', 'Title dan URL wajib diisi');
      return;
    }
    setIsVideoAdding(true);
    try {
      const res = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoForm),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Video "${videoForm.title}" berhasil ditambahkan`);
        setVideoForm({ title: '', url: '' });
        fetchVideos();
      } else {
        addToast('error', data.message || 'Gagal menambah video');
      }
    } catch {
      addToast('error', 'Terjadi kesalahan jaringan');
    } finally {
      setIsVideoAdding(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 px-4 pb-16">
      <Toast toasts={toasts} onRemove={removeToast} />
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title={
          deleteModal.type === 'video' ? 'Hapus Video' :
          deleteModal.type === 'spinner-photo' ? 'Hapus Foto Spinner' : 
          deleteModal.type.startsWith('cache') ? 'Hapus Cache' : 
          'Hapus Dokumen'
        }
        message={
          deleteModal.type === 'video'
            ? `Hapus video "${deleteModal.name}"? Video ini tidak akan muncul lagi di halaman rekap.`
            : deleteModal.type === 'cache-all'
            ? 'Apakah kamu yakin ingin menghapus SEMUA cache? AI akan menghasilkan jawaban dan suara baru untuk semua pertanyaan.'
            : deleteModal.type === 'cache'
            ? `Hapus cache untuk "${deleteModal.name}"? Pertanyaan ini akan dijawab ulang oleh AI.`
            : deleteModal.type === 'spinner-photo'
            ? `Hapus foto untuk "${deleteModal.name}"? Orang ini akan kembali menggunakan logo default di spinner.`
            : `Apakah kamu yakin ingin menghapus "${deleteModal.name}"? File ini tidak akan bisa digunakan sebagai konteks RAG lagi.`
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: '', name: '', type: 'doc' })}
        isLoading={isDeleting}
      />
      
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">Admin Dashboard</h1>
            <p className="text-white/50 text-sm mt-1">Kelola dokumen konteks AI</p>
          </div>
          
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors text-sm font-medium"
          >
            <IconLogOut size={16} />
            Logout
          </button>
        </div>

        <div className="bg-white/4 border border-white/8 rounded-3xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Dokumen Terunggah</h2>
            
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleUploadClick}
              disabled={isUploading}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-primary to-blue-light text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 hover:shadow-lg transition-all"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mengunggah...
                </>
              ) : (
                <>
                  <IconUpload size={18} strokeWidth={2} />
                  Unggah PDF Baru
                </>
              )}
            </motion.button>
            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {isLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-orange-primary/30 border-t-orange-primary rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-2xl bg-white/2">
              <IconDocument size={48} className="text-white/20 mx-auto mb-4" strokeWidth={1} />
              <p className="text-white/50">Belum ada dokumen yang diunggah.</p>
              <p className="text-white/30 text-sm mt-1">Silakan unggah file PDF untuk dipelajari oleh AI.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 group hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-primary/10 flex items-center justify-center flex-shrink-0">
                        <IconDocument size={20} className="text-orange-primary" strokeWidth={1.5} />
                      </div>
                      <div>
                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-white font-medium hover:text-blue-light transition-colors block">
                          {doc.file_name}
                        </a>
                        <span className="text-xs text-white/40 block mt-0.5">
                          Diunggah pada {new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => promptDelete(doc.id, doc.file_name)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all border border-transparent hover:border-red-500/30"
                      title="Hapus dokumen"
                    >
                      <IconTrash size={18} strokeWidth={1.5} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Spinner Photos Section */}
        <div className="bg-white/4 border border-white/8 rounded-3xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden mt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Foto Spinner</h2>
              <p className="text-white/40 text-sm mt-1">Kelola foto yang muncul saat seseorang terpilih di spinner</p>
            </div>
          </div>

          {isSpinnerLoading && Object.keys(spinnerPhotos).length === 0 ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-orange-primary/30 border-t-orange-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SPINNER_NAMES.map((name) => (
                <div key={name} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full border-2 border-white/10 overflow-hidden mb-3 bg-white/5 flex items-center justify-center relative group">
                    {spinnerPhotos[name] ? (
                      <img src={spinnerPhotos[name]} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-white/20">
                        <IconUser size={32} strokeWidth={1} />
                      </div>
                    )}
                    
                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <IconUpload size={20} className="text-white" />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => handleSpinnerPhotoUpload(name, e)}
                        disabled={isSpinnerLoading}
                      />
                    </label>
                  </div>
                  <p className="text-white font-medium text-sm mb-3">{name}</p>
                  <div className="flex gap-2 w-full">
                    <label className="flex-1">
                      <div className="w-full py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-white/10 hover:text-white transition-all">
                        {spinnerPhotos[name] ? 'Ganti' : 'Unggah'}
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => handleSpinnerPhotoUpload(name, e)}
                        disabled={isSpinnerLoading}
                      />
                    </label>
                    {spinnerPhotos[name] && (
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, id: name, name, type: 'spinner-photo' })}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Rekap Section */}
        <div className="bg-white/4 border border-white/8 rounded-3xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden mt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Video Rekap</h2>
              <p className="text-white/40 text-sm mt-1">Kelola video rekap yang ditampilkan di halaman /video</p>
            </div>
          </div>

          {/* Add Video Form */}
          <form onSubmit={handleAddVideo} className="p-4 rounded-2xl bg-white/4 border border-white/10 mb-6 space-y-3">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Tambah Video Baru</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Judul video..."
                value={videoForm.title}
                onChange={(e) => setVideoForm((v) => ({ ...v, title: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm outline-none focus:border-blue-light/50 transition-colors"
                disabled={isVideoAdding}
              />

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <IconLink size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="url"
                    placeholder="URL YouTube atau Google Drive..."
                    value={videoForm.url}
                    onChange={(e) => setVideoForm((v) => ({ ...v, url: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm outline-none focus:border-blue-light/50 transition-colors"
                    disabled={isVideoAdding}
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={isVideoAdding || !videoForm.title.trim() || !videoForm.url.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-primary to-blue-light text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-40 hover:shadow-lg transition-all whitespace-nowrap"
                >
                  {isVideoAdding ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <IconVideo size={16} strokeWidth={2} />
                  )}
                  Tambah
                </motion.button>
              </div>
            </div>
          </form>

          {/* Video List */}
          {isVideoLoading && recapVideos.length === 0 ? (
            <div className="py-8 flex justify-center">
              <div className="w-8 h-8 border-2 border-orange-primary/30 border-t-orange-primary rounded-full animate-spin" />
            </div>
          ) : recapVideos.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl bg-white/2">
              <IconVideo size={40} className="text-white/20 mx-auto mb-3" strokeWidth={1} />
              <p className="text-white/50">Belum ada video yang ditambahkan.</p>
              <p className="text-white/30 text-sm mt-1">Tambahkan link YouTube atau Google Drive di atas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {recapVideos.map((video) => (
                  <motion.div
                    key={video.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/10 group hover:border-white/20 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="w-24 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/8 flex-shrink-0 relative">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <IconPlay size={20} className="text-white/20" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{video.title}</p>

                      <p className="text-white/25 text-xs mt-1">
                        {new Date(video.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <button
                      onClick={() => setDeleteModal({ isOpen: true, id: video.id, name: video.title, type: 'video' })}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all border border-transparent hover:border-red-500/30 flex-shrink-0"
                      title="Hapus video"
                    >
                      <IconTrash size={16} strokeWidth={1.5} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Response Cache Section */}
        <div className="bg-white/4 border border-white/8 rounded-3xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden mt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Response Cache</h2>
              <p className="text-white/40 text-sm mt-1">Jawaban & suara yang tersimpan ({cacheEntries.length} entri)</p>
            </div>

            {cacheEntries.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setDeleteModal({ isOpen: true, id: '', name: '', type: 'cache-all' })}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-red-500/20 transition-all"
              >
                <IconTrash size={16} strokeWidth={1.5} />
                Hapus Semua
              </motion.button>
            )}
          </div>

          {isCacheLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-blue-primary/30 border-t-blue-primary rounded-full animate-spin" />
            </div>
          ) : cacheEntries.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl bg-white/2">
              <p className="text-white/50">Belum ada jawaban yang di-cache.</p>
              <p className="text-white/30 text-sm mt-1">Jawaban AI akan otomatis tersimpan saat user bertanya.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {cacheEntries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 group hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Question */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-primary/15 text-blue-light font-medium">Q</span>
                          <p className="text-white font-medium text-sm truncate">{entry.original_question}</p>
                        </div>

                        {/* Response preview */}
                        <p className="text-white/50 text-xs line-clamp-2 ml-7">
                          {entry.response_text.slice(0, 200)}...
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-3 mt-2 ml-7">
                          <span className="text-[10px] text-white/30">
                            {new Date(entry.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {entry.has_audio ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🔊 Audio tersimpan</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">Tanpa audio</span>
                          )}
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, id: entry.id, name: entry.original_question, type: 'cache' })}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all border border-transparent hover:border-red-500/30 flex-shrink-0"
                        title="Hapus cache"
                      >
                        <IconTrash size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
