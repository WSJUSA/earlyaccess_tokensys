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
  const [filter, setFilter] = useState<'all' | 'active' | 'redeemed' | 'expired'>('all');
  const [exporting, setExporting] = useState(false);

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
      const response = await fetch(`${supabaseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: batchSize,
          shared_code: isShared,
          max_redemptions: isShared ? maxRedemptions : 1,
          simple_format: isShared
        })
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

          <button
            onClick={handleGenerateTokens}
            disabled={generating}
            className="generate-button"
          >
            {generating ? 'Generating...' : `Generate ${batchSize} ${tokenType === 'shared' ? 'Shared' : 'Unique'} Code${batchSize > 1 ? 's' : ''}`}
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
                <div className="token-code">{token.token_code}</div>
                <div className="token-meta">
                  <span
                    className="token-status"
                    style={{ color: getStatusColor(token) }}
                  >
                    {getTokenStatus(token)}
                  </span>

                  {/* Show usage for shared codes */}
                  {token.max_redemptions > 1 && (
                    <span className="token-usage">
                      Used: {token.current_redemptions}/{token.max_redemptions} ({Math.round((token.current_redemptions / token.max_redemptions) * 100)}%)
                    </span>
                  )}

                  <span className="token-date">
                    Created: {new Date(token.created_at).toLocaleDateString()}
                  </span>

                  {/* Show redemption info */}
                  {token.max_redemptions === 1 && token.redeemed_at && (
                    <span className="token-date">
                      Redeemed: {new Date(token.redeemed_at).toLocaleDateString()}
                    </span>
                  )}
                  {token.max_redemptions > 1 && token.current_redemptions > 0 && (
                    <span className="token-date">
                      First redeemed: {new Date(token.redeemed_at || token.created_at).toLocaleDateString()}
                    </span>
                  )}

                  {/* Show format type */}
                  <span className="token-format">
                    Type: {token.max_redemptions === 1 ? 'Unique' : `Shared (${token.max_redemptions} users)`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
