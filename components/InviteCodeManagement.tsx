import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Copy, 
  Check, 
  Pause, 
  Play, 
  Trash2, 
  X,
  Calendar,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Ticket,
  Download
} from 'lucide-react';
import { 
  InviteCode, 
  InviteRedemption,
  InviteCodeStatus,
  getAllInviteCodes, 
  generateInviteCodes, 
  updateInviteCodeStatus,
  updateInviteCode,
  deleteInviteCode,
  getRedemptionsByCode
} from '../services/inviteService';
import Modal from './Modal';

const InviteCodeManagement: React.FC = () => {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 生成邀请码 Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateMaxUses, setGenerateMaxUses] = useState(10);
  const [generateValidDays, setGenerateValidDays] = useState(30);
  const [generateNote, setGenerateNote] = useState('');
  const [generateArticleQuota, setGenerateArticleQuota] = useState(10); // 初始文章配额
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  
  // 编辑 Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<InviteCode | null>(null);
  const [editMaxUses, setEditMaxUses] = useState(10);
  const [editValidTo, setEditValidTo] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editArticleQuota, setEditArticleQuota] = useState(10); // 初始文章配额
  const [isSaving, setIsSaving] = useState(false);
  
  // 兑换记录 Modal
  const [isRedemptionsModalOpen, setIsRedemptionsModalOpen] = useState(false);
  const [selectedCodeForRedemptions, setSelectedCodeForRedemptions] = useState<InviteCode | null>(null);
  const [redemptions, setRedemptions] = useState<InviteRedemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  
  // 删除确认 Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<InviteCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 复制提示
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // 展开的行
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchInviteCodes();
  }, []);

  const fetchInviteCodes = async () => {
    setLoading(true);
    const codes = await getAllInviteCodes();
    setInviteCodes(codes);
    setLoading(false);
  };

  // 复制邀请码
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 生成邀请码
  const handleGenerate = async () => {
    setIsGenerating(true);
    const result = await generateInviteCodes(generateCount, {
      maxUses: generateMaxUses,
      validDays: generateValidDays,
      note: generateNote,
      articleQuota: generateArticleQuota
    });
    
    if (result.success) {
      setGeneratedCodes(result.codes.map(c => c.code));
      await fetchInviteCodes();
    } else {
      alert('Failed to generate invite codes: ' + result.error);
    }
    setIsGenerating(false);
  };

  // 关闭生成 Modal 并重置
  const closeGenerateModal = () => {
    setIsGenerateModalOpen(false);
    setGeneratedCodes([]);
    setGenerateCount(10);
    setGenerateMaxUses(10);
    setGenerateValidDays(30);
    setGenerateNote('');
    setGenerateArticleQuota(10);
  };

  // 切换状态
  const handleToggleStatus = async (code: InviteCode) => {
    const newStatus: InviteCodeStatus = code.status === 'active' ? 'paused' : 'active';
    const success = await updateInviteCodeStatus(code.id, newStatus);
    if (success) {
      await fetchInviteCodes();
    }
  };

  // 打开编辑 Modal
  const openEditModal = (code: InviteCode) => {
    setEditingCode(code);
    setEditMaxUses(code.max_uses);
    setEditValidTo(code.valid_to.split('T')[0]); // 只取日期部分
    setEditNote(code.note || '');
    setEditArticleQuota(code.article_quota || 10);
    setIsEditModalOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingCode) return;
    
    setIsSaving(true);
    const success = await updateInviteCode(editingCode.id, {
      max_uses: editMaxUses,
      valid_to: new Date(editValidTo).toISOString(),
      note: editNote,
      article_quota: editArticleQuota
    });
    
    if (success) {
      await fetchInviteCodes();
      setIsEditModalOpen(false);
      setEditingCode(null);
    } else {
      alert('Failed to update invite code');
    }
    setIsSaving(false);
  };

  // 查看兑换记录
  const handleViewRedemptions = async (code: InviteCode) => {
    setSelectedCodeForRedemptions(code);
    setLoadingRedemptions(true);
    setIsRedemptionsModalOpen(true);
    
    const records = await getRedemptionsByCode(code.id);
    setRedemptions(records);
    setLoadingRedemptions(false);
  };

  // 删除邀请码
  const handleDelete = async () => {
    if (!codeToDelete) return;
    
    setIsDeleting(true);
    const success = await deleteInviteCode(codeToDelete.id);
    
    if (success) {
      await fetchInviteCodes();
      setIsDeleteModalOpen(false);
      setCodeToDelete(null);
    } else {
      alert('Failed to delete invite code');
    }
    setIsDeleting(false);
  };

  // 导出生成的邀请码为 CSV
  const exportGeneratedCodes = () => {
    const csv = generatedCodes.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invite-codes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 过滤邀请码
  const filteredCodes = inviteCodes.filter(code => 
    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (code.note && code.note.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 状态颜色
  const getStatusColor = (status: InviteCodeStatus) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'revoked': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // 检查是否过期
  const isExpired = (validTo: string) => {
    return new Date(validTo) < new Date();
  };

  // 检查是否用完
  const isUsedUp = (code: InviteCode) => {
    return code.used_count >= code.max_uses;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invite Codes</h1>
          <p className="text-slate-500 mt-2">Manage invitation codes for user registration.</p>
        </div>
        <button 
          onClick={() => setIsGenerateModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-md"
        >
          <Plus size={18} />
          Generate Codes
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
              <Ticket size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Codes</p>
              <p className="text-xl font-bold text-slate-900">{inviteCodes.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
              <Play size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active</p>
              <p className="text-xl font-bold text-slate-900">
                {inviteCodes.filter(c => c.status === 'active' && !isExpired(c.valid_to) && !isUsedUp(c)).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Redemptions</p>
              <p className="text-xl font-bold text-slate-900">
                {inviteCodes.reduce((sum, c) => sum + c.used_count, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Expiring Soon</p>
              <p className="text-xl font-bold text-slate-900">
                {inviteCodes.filter(c => {
                  const daysLeft = Math.ceil((new Date(c.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return daysLeft > 0 && daysLeft <= 7 && c.status === 'active';
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">All Invite Codes</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search codes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Usage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Valid Until</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Note</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {searchTerm ? 'No codes match your search' : 'No invite codes yet. Generate some!'}
                  </td>
                </tr>
              ) : (
                filteredCodes.map((code) => {
                  const expired = isExpired(code.valid_to);
                  const usedUp = isUsedUp(code);
                  
                  return (
                    <tr key={code.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 tracking-wider">{code.code}</span>
                          <button
                            onClick={() => handleCopyCode(code.code)}
                            className="p-1 hover:bg-slate-200 rounded transition"
                            title="Copy code"
                          >
                            {copiedCode === code.code ? (
                              <Check size={14} className="text-green-600" />
                            ) : (
                              <Copy size={14} className="text-slate-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(code.status)}`}>
                            {code.status}
                          </span>
                          {expired && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              expired
                            </span>
                          )}
                          {usedUp && !expired && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              used up
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewRedemptions(code)}
                          className="text-sm text-slate-600 hover:text-indigo-600 transition"
                        >
                          <span className="font-semibold">{code.used_count}</span>
                          <span className="text-slate-400"> / {code.max_uses}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${expired ? 'text-red-600' : 'text-slate-600'}`}>
                          {new Date(code.valid_to).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500 truncate max-w-[200px] block">
                          {code.note || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(code)}
                            className={`p-1.5 rounded transition ${
                              code.status === 'active' 
                                ? 'hover:bg-yellow-100 text-yellow-600' 
                                : 'hover:bg-green-100 text-green-600'
                            }`}
                            title={code.status === 'active' ? 'Pause' : 'Activate'}
                          >
                            {code.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                          <button
                            onClick={() => openEditModal(code)}
                            className="p-1.5 hover:bg-slate-200 rounded transition text-slate-500"
                            title="Edit"
                          >
                            <Calendar size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setCodeToDelete(code);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-red-100 rounded transition text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Generate Invite Codes</h3>
              <button 
                onClick={closeGenerateModal}
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            {generatedCodes.length === 0 ? (
              <>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Number of Codes</label>
                    <input 
                      type="number" 
                      min={1}
                      max={100}
                      value={generateCount}
                      onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Uses per Code</label>
                    <input 
                      type="number" 
                      min={1}
                      value={generateMaxUses}
                      onChange={(e) => setGenerateMaxUses(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valid for (days)</label>
                    <input 
                      type="number" 
                      min={1}
                      value={generateValidDays}
                      onChange={(e) => setGenerateValidDays(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Article Quota per User</label>
                    <input 
                      type="number" 
                      min={1}
                      value={generateArticleQuota}
                      onChange={(e) => setGenerateArticleQuota(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-slate-400 mt-1">Initial article quota for users who register with this code</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
                    <input 
                      type="text" 
                      value={generateNote}
                      onChange={(e) => setGenerateNote(e.target.value)}
                      placeholder="e.g., Marketing campaign Q1 2024"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button 
                    onClick={closeGenerateModal}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-white rounded-lg border border-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Generate
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4 text-green-600">
                    <Check size={20} />
                    <span className="font-medium">Generated {generatedCodes.length} codes successfully!</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {generatedCodes.map((code, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-slate-200">
                          <span className="font-mono font-bold text-slate-900">{code}</span>
                          <button
                            onClick={() => handleCopyCode(code)}
                            className="p-1 hover:bg-slate-100 rounded"
                          >
                            {copiedCode === code ? (
                              <Check size={14} className="text-green-600" />
                            ) : (
                              <Copy size={14} className="text-slate-400" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between">
                  <button 
                    onClick={exportGeneratedCodes}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-white rounded-lg border border-slate-200 transition flex items-center gap-2"
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                  <button 
                    onClick={closeGenerateModal}
                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                Edit Code: <span className="font-mono">{editingCode.code}</span>
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Uses</label>
                <input 
                  type="number" 
                  min={editingCode.used_count}
                  value={editMaxUses}
                  onChange={(e) => setEditMaxUses(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Current usage: {editingCode.used_count}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
                <input 
                  type="date" 
                  value={editValidTo}
                  onChange={(e) => setEditValidTo(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Article Quota per User</label>
                <input 
                  type="number" 
                  min={1}
                  value={editArticleQuota}
                  onChange={(e) => setEditArticleQuota(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Initial article quota for new users (won't affect existing users)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                <input 
                  type="text" 
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-white rounded-lg border border-slate-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redemptions Modal */}
      {isRedemptionsModalOpen && selectedCodeForRedemptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                Redemptions: <span className="font-mono">{selectedCodeForRedemptions.code}</span>
              </h3>
              <button 
                onClick={() => setIsRedemptionsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {loadingRedemptions ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Loading...
                </div>
              ) : redemptions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No redemptions yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {redemptions.map((redemption) => (
                    <div key={redemption.id} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{redemption.redeemed_email}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(redemption.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        redemption.state === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {redemption.state}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsRedemptionsModalOpen(false)}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Invite Code"
        type="error"
        size="sm"
        closeOnOutsideClick={false}
        footer={
          <>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to delete invite code{' '}
          <span className="font-mono font-bold">{codeToDelete?.code}</span>?
          This will also delete all redemption records.
        </p>
      </Modal>
    </div>
  );
};

export default InviteCodeManagement;

