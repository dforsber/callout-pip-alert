import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  CloudBackend,
  getBackends,
  addBackend,
  updateBackend,
  deleteBackend,
  getActiveBackendId,
  setActiveBackendId,
} from "../lib/backends";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-4">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface BackendFormData {
  name: string;
  apiUrl: string;
  region: string;
  userPoolId: string;
  userPoolClientId: string;
}

const emptyFormData: BackendFormData = {
  name: "",
  apiUrl: "",
  region: "",
  userPoolId: "",
  userPoolClientId: "",
};

export default function SettingsPage() {
  const { user, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [backends, setBackends] = useState<CloudBackend[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BackendFormData>(emptyFormData);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; backendId: string | null; backendName: string }>({
    isOpen: false,
    backendId: null,
    backendName: "",
  });

  useEffect(() => {
    setBackends(getBackends());
    setActiveId(getActiveBackendId());
  }, []);

  const resetForm = () => {
    setFormData(emptyFormData);
    setShowForm(false);
    setEditingId(null);
  };

  const handleAddClick = () => {
    setFormData(emptyFormData);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEditClick = (backend: CloudBackend) => {
    setFormData({
      name: backend.name,
      apiUrl: backend.apiUrl,
      region: backend.region,
      userPoolId: backend.userPoolId,
      userPoolClientId: backend.userPoolClientId,
    });
    setEditingId(backend.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.apiUrl || !formData.region || !formData.userPoolId || !formData.userPoolClientId) {
      return;
    }

    if (editingId) {
      updateBackend(editingId, formData);
    } else {
      addBackend(formData);
    }

    setBackends(getBackends());
    setActiveId(getActiveBackendId());
    resetForm();
  };

  const handleDeleteClick = (backend: CloudBackend) => {
    setDeleteConfirm({
      isOpen: true,
      backendId: backend.id,
      backendName: backend.name,
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm.backendId) {
      deleteBackend(deleteConfirm.backendId);
      setBackends(getBackends());
      setActiveId(getActiveBackendId());
    }
    setDeleteConfirm({ isOpen: false, backendId: null, backendName: "" });
  };

  const handleSelectBackend = (id: string) => {
    setActiveBackendId(id);
    setActiveId(id);
    window.location.reload();
  };

  return (
    <div className="min-h-full bg-gray-100 p-4">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Settings</h1>

      {/* Cloud Backends Section */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Cloud Backends</h2>
            <button
              onClick={showForm ? resetForm : handleAddClick}
              className="text-sm text-blue-600 font-medium"
            >
              {showForm ? "Cancel" : "+ Add"}
            </button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g., Production"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">API URL</label>
                <input
                  type="text"
                  placeholder="https://xxx.execute-api.region.amazonaws.com"
                  value={formData.apiUrl}
                  onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Region</label>
                <input
                  type="text"
                  placeholder="e.g., eu-west-1"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">User Pool ID</label>
                <input
                  type="text"
                  placeholder="e.g., eu-west-1_xxxxxxxxx"
                  value={formData.userPoolId}
                  onChange={(e) => setFormData({ ...formData, userPoolId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">User Pool Client ID</label>
                <input
                  type="text"
                  placeholder="e.g., xxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={formData.userPoolClientId}
                  onChange={(e) => setFormData({ ...formData, userPoolClientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <button
                onClick={handleSubmit}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                {editingId ? "Save Changes" : "Add Backend"}
              </button>
            </div>
          </div>
        )}

        {/* Backend List */}
        {backends.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No backends configured. Add one to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {backends.map((backend) => (
              <div
                key={backend.id}
                className={`p-4 ${activeId === backend.id ? "bg-blue-50" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{backend.name}</span>
                      {activeId === backend.id && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-1">{backend.apiUrl}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{backend.region}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {activeId !== backend.id && (
                      <button
                        onClick={() => handleSelectBackend(backend.id)}
                        className="text-xs text-blue-600 font-medium px-2 py-1"
                      >
                        Select
                      </button>
                    )}
                    <button
                      onClick={() => handleEditClick(backend)}
                      className="text-xs text-gray-600 font-medium px-2 py-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(backend)}
                      className="text-xs text-red-600 font-medium px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User info */}
      {isAuthenticated && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Account</h2>
          <p className="font-medium text-gray-900">{user?.getUsername() || "Not signed in"}</p>
        </div>
      )}

      {/* App info */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">App Version</h2>
        <p className="text-gray-900">0.1.0</p>
      </div>

      {/* Sign out or Go to Login */}
      {isAuthenticated ? (
        <button
          onClick={signOut}
          className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-medium"
        >
          Sign Out
        </button>
      ) : (
        <button
          onClick={() => navigate("/login")}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium"
        >
          Go to Login
        </button>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Backend"
        message={`Are you sure you want to delete "${deleteConfirm.backendName}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ isOpen: false, backendId: null, backendName: "" })}
      />
    </div>
  );
}
