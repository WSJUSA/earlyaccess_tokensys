import React, { useState, useEffect, useCallback } from 'react';
import { EarlyAccessToken, TokenAnalytics } from '../types';

interface TokenAdminProps {
  supabaseUrl?: string;
  onError?: (error: string) => void;
  className?: string;
}

export const TokenAdmin: React.FC<TokenAdminProps> = ({
  supabaseUrl = '/api/early-access',
  onError,
  className = ''
}) => {
  const [tokens, setTokens] = useState<EarlyAccessToken[]>([]);
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [maxRedemptions, setMaxRedemptions] = useState(25);
  const [tokenType, setTokenType] = useState<'unique' | 'shared'>('shared');
  const [filter, setFilter] = useState<'all' | 'active' | 'redeemed' | 'expired' | 'inactive'>('all');
  const [exporting, setExporting] = useState(false);
  const [customPrefix, setCustomPrefix] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [metadata, setMetadata] = useState('');
  const [useSimpleFormat, setUseSimpleFormat] = useState(false);
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());

  // Fetch tokens and analytics
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch tokens
      const tokensResponse = await fetch(`${supabaseUrl}/tokens?status=${filter}&limit=100`);
      if (!tokensResponse.ok) throw new Error('Failed to fetch tokens');
      const tokensData = await tokensResponse.json();
      setTokens(tokensData);

      // Fetch analytics
      const analyticsResponse = await fetch(`${supabaseUrl}/analytics`);
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (onError) onError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [supabaseUrl, filter, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate new tokens
  const handleGenerateTokens = async () => {
    try {
      setGenerating(true);
      const isShared = tokenType === 'shared';
      const requestBody: any = {
        count: batchSize,
        tokenType,
        simple_format: useSimpleFormat,
      };

      // Add custom prefix if provided
      if (customPrefix.trim()) {
        requestBody.custom_prefix = customPrefix.trim();
      }

      // Add max redemptions for shared tokens
      if (isShared) {
        requestBody.maxRedemptions = maxRedemptions;
      }

      // Add expiration if provided
      if (expiresAt) {
        requestBody.expires_at = new Date(expiresAt).toISOString();
      }

      // Add metadata if provided
      if (metadata.trim()) {
        try {
          requestBody.metadata = JSON.parse(metadata);
        } catch (error) {
          // If JSON parsing fails, treat as string
          requestBody.metadata = { description: metadata };
        }
      }

      const response = await fetch(`${supabaseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) throw new Error('Failed to generate tokens');

      const newTokens = await response.json();
      setTokens(prev => [...newTokens, ...prev]);

      // Update analytics (calculate new totals)
      const newTotalCreated = (analytics?.total_created || 0) + newTokens.length;
      const newTotalActive = (analytics?.total_active || 0) + newTokens.filter(t => t.current_redemptions < t.max_redemptions).length;

      setAnalytics(prev => prev ? {
        ...prev,
        total_created: newTotalCreated,
        total_active: newTotalActive
      } : null);

      // Reset form after successful generation
      setExpiresAt('');
      setMetadata('');
      setCustomPrefix('');

      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error generating tokens:', error);
      if (onError) onError(error instanceof Error ? error.message : 'Failed to generate tokens');
    } finally {
      setGenerating(false);
    }
  };

  // Export tokens to CSV
  const handleExportTokens = async () => {
    try {
      setExporting(true);
      const response = await fetch(`${supabaseUrl}/export?status=${filter}`);
      if (!response.ok) throw new Error('Failed to export tokens');

      const data = await response.json();
      const csv = convertToCSV(data.tokens || tokens);
      downloadCSV(csv, `early-access-tokens-${filter}-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Error exporting tokens:', error);
      if (onError) onError(error instanceof Error ? error.message : 'Failed to export tokens');
    } finally {
      setExporting(false);
    }
  };

  // Helper functions
  const convertToCSV = (tokens: EarlyAccessToken[]): string => {
    const headers = ['Token Code', 'Created At', 'Created By', 'Status', 'Redeemed At', 'Redeemed By', 'Expires At'];
    const rows = tokens.map(token => [
      token.token_code,
      new Date(token.created_at).toLocaleDateString(),
      token.created_by || 'System',
      getTokenStatus(token),
      token.redeemed_at ? new Date(token.redeemed_at).toLocaleDateString() : '',
      token.redeemed_by || '',
      token.expires_at ? new Date(token.expires_at).toLocaleDateString() : ''
    ]);

    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getTokenStatus = (token: EarlyAccessToken): string => {
    if (!token.is_active) return 'Inactive';
    if (token.redeemed_by) return 'Redeemed';
    if (token.expires_at && new Date(token.expires_at) < new Date()) return 'Expired';
    return 'Active';
  };

  const getStatusColor = (token: EarlyAccessToken): string => {
    const status = getTokenStatus(token);
    switch (status) {
      case 'Active': return '#10b981';
      case 'Redeemed': return '#3b82f6';
      case 'Expired': return '#ef4444';
      case 'Inactive': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const toggleTokenExpanded = (tokenId: string) => {
    setExpandedTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenId)) {
        newSet.delete(tokenId);
      } else {
        newSet.add(tokenId);
      }
      return newSet;
    });
  };

  if (loading && tokens.length === 0) {
    return <div className="token-admin-loading">Loading token data...</div>;
  }

  return (
    <div className={`token-admin ${className}`}>
      {/* Analytics Overview */}
      {analytics && (
        <div className="token-analytics">
          <h3>Token Analytics</h3>
          <div className="analytics-grid">
            <div className="analytics-item">
              <span className="analytics-label">Total Created</span>
              <span className="analytics-value">{analytics.total_created}</span>
            </div>
            <div className="analytics-item">
              <span className="analytics-label">Total Redeemed</span>
              <span className="analytics-value">{analytics.total_redeemed}</span>
            </div>
            <div className="analytics-item">
              <span className="analytics-label">Active Tokens</span>
              <span className="analytics-value">{analytics.total_active}</span>
            </div>
            <div className="analytics-item">
              <span className="analytics-label">Redemption Rate</span>
              <span className="analytics-value">{(analytics.redemption_rate * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="token-controls">
        {/* Basic Options */}
        <div className="control-group">
          <label>
            Token Type:
            <select
              value={tokenType}
              onChange={(e) => setTokenType(e.target.value as 'unique' | 'shared')}
              className="token-type-select"
            >
              <option value="shared">Shared Codes (Multiple Users)</option>
              <option value="unique">Unique Codes (One User Each)</option>
            </select>
          </label>

          <label>
            Number of Codes:
            <input
              type="number"
              min="1"
              max="50"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
              className="batch-size-input"
            />
          </label>

          {tokenType === 'shared' && (
            <label>
              Max Users per Code:
              <input
                type="number"
                min="2"
                max="1000"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(parseInt(e.target.value) || 25)}
                className="max-redemptions-input"
              />
            </label>
          )}
        </div>

        {/* Advanced Options */}
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={useSimpleFormat}
              onChange={(e) => setUseSimpleFormat(e.target.checked)}
            />
            Use simple format (BETA2025 instead of EA-XXXX-XXXX)
          </label>

          {useSimpleFormat && (
            <label>
              Custom Prefix (Optional):
              <input
                type="text"
                value={customPrefix}
                onChange={(e) => setCustomPrefix(e.target.value)}
                placeholder="e.g., VIP, LAUNCH2025"
                className="custom-prefix-input"
                maxLength={20}
              />
            </label>
          )}

          <label>
            Expiration Date (Optional):
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="expiration-input"
            />
          </label>

          <label>
            Metadata (JSON, Optional):
            <textarea
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder='{"campaign": "beta_launch"}'
              rows={2}
              className="metadata-input"
            />
          </label>
        </div>

        <div className="control-group">
          <button
            onClick={handleGenerateTokens}
            disabled={generating}
            className="generate-button"
          >
            {generating ? 'Generating...' : `Generate ${batchSize} ${tokenType === 'shared' ? 'Shared' : 'Unique'} Code${batchSize > 1 ? 's' : ''}${customPrefix ? ` (${customPrefix.toUpperCase()})` : ''}`}
          </button>
        </div>

        <div className="control-group">
          <label>
            Filter:
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">All Tokens</option>
              <option value="active">Active Only</option>
              <option value="redeemed">Redeemed Only</option>
              <option value="expired">Expired Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </label>
          <button
            onClick={handleExportTokens}
            disabled={exporting}
            className="export-button"
          >
            {exporting ? 'Exporting...' : 'Export to CSV'}
          </button>
        </div>
      </div>

      {/* Token List */}
      <div className="token-list">
        <h3>Tokens ({tokens.length})</h3>
        {tokens.length === 0 ? (
          <p className="no-tokens">No tokens found.</p>
        ) : (
          <div className="token-grid">
            {tokens.map((token) => (
              <div key={token.id} className="token-card">
                <div className="token-header">
                  <div className="token-code">{token.token_code}</div>
                  <div className="token-actions">
                    <button
                      onClick={() => toggleTokenExpanded(token.id)}
                      className="expand-button"
                    >
                      {expandedTokens.has(token.id) ? '▼' : '▶'}
                    </button>
                    <span
                      className="token-status"
                      style={{ color: getStatusColor(token) }}
                    >
                      {getTokenStatus(token)}
                    </span>
                  </div>
                </div>

                <div className="token-summary">
                  <span className="token-type">
                    {token.max_redemptions === 1 ? 'Unique' : `Shared (${token.max_redemptions} users)`}
                  </span>
                  {token.max_redemptions > 1 && (
                    <span className="token-usage">
                      Used: {token.current_redemptions}/{token.max_redemptions} ({Math.round((token.current_redemptions / token.max_redemptions) * 100)}%)
                    </span>
                  )}
                  <span className="token-date">
                    Created: {new Date(token.created_at).toLocaleDateString()}
                  </span>
                </div>

                {expandedTokens.has(token.id) && (
                  <div className="token-details">
                    {/* Usage Statistics */}
                    <div className="details-section">
                      <h4>Usage Statistics</h4>
                      <div className="stats-grid">
                        <div className="stat-item">
                          <span className="stat-label">Type:</span>
                          <span className="stat-value">{token.max_redemptions > 1 ? 'Shared' : 'Unique'}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Max Allowed:</span>
                          <span className="stat-value">{token.max_redemptions}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Redeemed:</span>
                          <span className="stat-value">{token.current_redemptions}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Remaining:</span>
                          <span className="stat-value">{token.max_redemptions - token.current_redemptions}</span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="details-section">
                      <h4>Timeline</h4>
                      <div className="timeline-grid">
                        {token.created_by && (
                          <div className="timeline-item">
                            <span className="timeline-label">Created By:</span>
                            <span className="timeline-value">{token.created_by}</span>
                          </div>
                        )}

                        <div className="timeline-item">
                          <span className="timeline-label">Created:</span>
                          <span className="timeline-value">{new Date(token.created_at).toLocaleString()}</span>
                        </div>

                        {token.redeemed_at ? (
                          <>
                            <div className="timeline-item">
                              <span className="timeline-label">Redeemed:</span>
                              <span className="timeline-value">{new Date(token.redeemed_at).toLocaleString()}</span>
                            </div>
                            {token.redeemed_by && (
                              <div className="timeline-item">
                                <span className="timeline-label">Redeemed By:</span>
                                <span className="timeline-value">{token.redeemed_by}</span>
                              </div>
                            )}
                          </>
                        ) : token.expires_at && new Date(token.expires_at) < new Date() ? (
                          <div className="timeline-item">
                            <span className="timeline-label">Expired:</span>
                            <span className="timeline-value">{new Date(token.expires_at).toLocaleString()}</span>
                          </div>
                        ) : (
                          <div className="timeline-item">
                            <span className="timeline-label">Status:</span>
                            <span className="timeline-value">{token.is_active ? 'Available for redemption' : 'Inactive'}</span>
                          </div>
                        )}

                        {token.expires_at && new Date(token.expires_at) > new Date() && (
                          <div className="timeline-item">
                            <span className="timeline-label">Expires:</span>
                            <span className="timeline-value">{new Date(token.expires_at).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    {token.metadata && Object.keys(token.metadata).length > 0 && (
                      <div className="details-section">
                        <h4>Metadata</h4>
                        <div className="metadata-display">
                          {(() => {
                            try {
                              if (typeof token.metadata === 'string') {
                                const parsed = JSON.parse(token.metadata);
                                return JSON.stringify(parsed, null, 2);
                              } else {
                                return JSON.stringify(token.metadata, null, 2);
                              }
                            } catch {
                              return String(token.metadata);
                            }
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
