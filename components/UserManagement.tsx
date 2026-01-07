import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Users,
  FileText,
  X,
  Edit3,
  AlertCircle
} from 'lucide-react';
import { 
  UserWithQuota,
  getAllUsersWithQuota, 
  updateUserQuota
} from '../services/inviteService';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserWithQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 编辑配额 Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithQuota | null>(null);
  const [editTotalQuota, setEditTotalQuota] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const data = await getAllUsersWithQuota();
    setUsers(data);
    setLoading(false);
  };

  // 打开编辑 Modal
  const openEditModal = (user: UserWithQuota) => {
    setEditingUser(user);
    setEditTotalQuota(user.total_quota);
    setSaveError(null);
    setIsEditModalOpen(true);
  };

  // 保存配额
  const handleSaveQuota = async () => {
    if (!editingUser) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    const result = await updateUserQuota(editingUser.user_id, editTotalQuota);
    
    if (result.success) {
      await fetchUsers();
      setIsEditModalOpen(false);
      setEditingUser(null);
    } else {
      setSaveError(result.error_message || 'Failed to update quota');
    }
    setIsSaving(false);
  };

  // 过滤用户
  const filteredUsers = users.filter(user => 
    user.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.invite_code && user.invite_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 计算统计数据
  const totalUsers = users.length;
  const totalArticles = users.reduce((sum, u) => sum + u.used_count, 0);
  const avgQuota = users.length > 0 
    ? Math.round(users.reduce((sum, u) => sum + u.total_quota, 0) / users.length) 
    : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-2">Manage user article quotas and view usage statistics.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Users</p>
              <p className="text-xl font-bold text-slate-900">{totalUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Articles Created</p>
              <p className="text-xl font-bold text-slate-900">{totalArticles}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <Edit3 size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Average Quota</p>
              <p className="text-xl font-bold text-slate-900">{avgQuota}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">All Users</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search users..." 
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Invite Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Articles Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quota</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Remaining</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {searchTerm ? 'No users match your search' : 'No users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{user.user_email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.invite_code ? (
                        <span className="font-mono text-sm text-slate-600">{user.invite_code}</span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900">{user.used_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900">{user.total_quota}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${user.remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {user.remaining}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => openEditModal(user)}
                          className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition flex items-center gap-1"
                        >
                          <Edit3 size={14} />
                          Adjust Quota
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Quota Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Adjust Quota</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* User Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500">User</p>
                <p className="font-medium text-slate-900">{editingUser.user_email}</p>
              </div>
              
              {/* Current Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Created</p>
                  <p className="text-lg font-bold text-slate-900">{editingUser.used_count}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Current Quota</p>
                  <p className="text-lg font-bold text-slate-900">{editingUser.total_quota}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Remaining</p>
                  <p className={`text-lg font-bold ${editingUser.remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {editingUser.remaining}
                  </p>
                </div>
              </div>
              
              {/* New Quota Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Total Quota</label>
                <input 
                  type="number" 
                  min={0}
                  value={editTotalQuota}
                  onChange={(e) => setEditTotalQuota(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-semibold"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {editTotalQuota > editingUser.total_quota 
                    ? `+${editTotalQuota - editingUser.total_quota} articles will be added`
                    : editTotalQuota < editingUser.total_quota
                    ? `${editingUser.total_quota - editTotalQuota} articles will be removed`
                    : 'No change'
                  }
                </p>
                
                {/* Warning if quota less than used */}
                {editTotalQuota < editingUser.used_count && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      The new quota ({editTotalQuota}) is less than articles already created ({editingUser.used_count}). 
                      The user will not be able to create new articles until quota is increased.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Error Message */}
              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {saveError}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-white rounded-lg border border-slate-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveQuota}
                disabled={isSaving || editTotalQuota === editingUser.total_quota}
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
    </div>
  );
};

export default UserManagement;

