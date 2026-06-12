import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import './UploadModal.css';

export default function UploadModal({ onClose, onSuccess }) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError('请填写 Markdown 内容');
      return;
    }
    setLoading(true);
    try {
      const tagArr = tags
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.publish({
        content,
        title: title.trim() || undefined,
        tags: tagArr
      });
      onSuccess(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-mask" onClick={onClose}>
      <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upload-header">
          <h3>发布新内容</h3>
          <button className="upload-close" onClick={onClose} aria-label="关闭">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {error && <div className="upload-error">{error}</div>}

          <div className="form-field">
            <label>标题（留空则从内容自动提取）</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="可选"
              maxLength={200}
            />
          </div>

          <div className="form-field">
            <label>标签（逗号或空格分隔）</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="如：技术, 笔记, 2026"
            />
          </div>

          <div className="form-field">
            <label>Markdown 内容 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# 标题&#10;&#10;开始书写你的 Markdown..."
              rows={14}
              required
            />
          </div>

          <div className="upload-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '发布中…' : '发布'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
