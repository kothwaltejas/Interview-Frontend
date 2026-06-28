import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from './Dashboard.module.css';

const EXPERIENCE_OPTIONS = [
  { value: 'fresher', label: 'Fresher (0-1 years)' },
  { value: 'junior', label: 'Junior (1-3 years)' },
  { value: 'mid', label: 'Mid-level (3-5 years)' },
  { value: 'senior', label: 'Senior (5+ years)' },
  { value: 'lead', label: 'Lead / Manager' },
];

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: user?.user_metadata?.full_name || '',
    phone: user?.user_metadata?.phone || '',
    experience_level: user?.user_metadata?.experience_level || '',
  });

  const getUserDisplayName = () => {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  };

  const getExperienceLabel = (value: string) => {
    return EXPERIENCE_OPTIONS.find(o => o.value === value)?.label || value || 'Not specified';
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          experience_level: form.experience_level,
        },
      });
      if (updateError) throw updateError;
      setSuccess('Profile updated successfully');
      setEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      full_name: user?.user_metadata?.full_name || '',
      phone: user?.user_metadata?.phone || '',
      experience_level: user?.user_metadata?.experience_level || '',
    });
    setEditing(false);
    setError('');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    border: '1.5px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: '#1e293b',
    background: '#f8fafc',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    color: '#64748b',
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.375rem',
    display: 'block',
  };

  const valueStyle: React.CSSProperties = {
    padding: '0.625rem 0',
    color: '#1e293b',
    fontWeight: 500,
    fontSize: '0.9rem',
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Settings</h1>
        <p className={styles.welcomeSubtitle}>Manage your account and preferences</p>
      </div>

      {success && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem',
          background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d',
          fontSize: '0.875rem', fontWeight: 500,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#15803d"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          {success}
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem',
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          fontSize: '0.875rem', fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Profile Information</h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: '#2563EB', color: 'white', border: 'none',
                padding: '0.45rem 1rem', borderRadius: '6px',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              Edit
            </button>
          )}
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Full Name */}
            <div>
              <label style={labelStyle}>Full Name</label>
              {editing ? (
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  style={inputStyle}
                  placeholder="Enter your name"
                />
              ) : (
                <div style={valueStyle}>{getUserDisplayName()}</div>
              )}
            </div>

            {/* Email (read-only) */}
            <div>
              <label style={labelStyle}>Email</label>
              <div style={valueStyle}>{user?.email}</div>
            </div>

            {/* Experience Level */}
            <div>
              <label style={labelStyle}>Experience Level</label>
              {editing ? (
                <select
                  value={form.experience_level}
                  onChange={e => setForm(f => ({ ...f, experience_level: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">Select level</option>
                  {EXPERIENCE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <div style={valueStyle}>{getExperienceLabel(user?.user_metadata?.experience_level)}</div>
              )}
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>Phone</label>
              {editing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  style={inputStyle}
                  placeholder="Enter phone number"
                />
              ) : (
                <div style={valueStyle}>{user?.user_metadata?.phone || 'Not provided'}</div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem' }}>
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: '#2563EB', color: 'white', border: 'none',
                    padding: '0.625rem 1.5rem', borderRadius: '6px',
                    fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    background: 'white', color: '#64748b', border: '1.5px solid #e2e8f0',
                    padding: '0.625rem 1.5rem', borderRadius: '6px',
                    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={signOut}
                style={{
                  background: '#dc2626', color: 'white', border: 'none',
                  padding: '0.625rem 1.5rem', borderRadius: '6px',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
