'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { IconUpload, IconTrash, IconDocument, IconLogOut } from '@/components/ui/Icons';
import Toast from '@/components/ui/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { ToastMessage } from '@/types';

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: '', name: '' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetchDocuments();
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
    setDeleteModal({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    const { id } = deleteModal;
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
      setDeleteModal({ isOpen: false, id: '', name: '' });
    }
  };

  return (
    <div className="min-h-screen pt-24 px-4 pb-16">
      <Toast toasts={toasts} onRemove={removeToast} />
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Hapus Dokumen"
        message={`Apakah kamu yakin ingin menghapus "${deleteModal.name}"? File ini tidak akan bisa digunakan sebagai konteks RAG lagi.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: '', name: '' })}
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
      </div>
    </div>
  );
}
