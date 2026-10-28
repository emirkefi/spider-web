import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Copy,
  Check,
  RefreshCw,
  Share2,
  Link2,
  ShieldCheck,
  Wifi,
  Zap,
  Server,
  Activity,
  Terminal,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  NodeStatusReport,
  createBoardTicket,
  joinBoardTicket,
  triggerPeerCatchup,
  spawnTestPeer,
  getP2PPort,
} from '../services/p2pService';

export interface P2PLogEntry {
  id: string;
  timestamp: string;
  type: 'gossip' | 'alpn_sync' | 'peer' | 'info' | 'error';
  title: string;
  detail: string;
}

interface P2PNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  isCoreOnline: boolean;
  nodeStatus: NodeStatusReport | null;
  logs: P2PLogEntry[];
  onRefreshStatus: () => Promise<void>;
  onTicketJoined: (summary: string) => void;
}

export const P2PNetworkModal: React.FC<P2PNetworkModalProps> = ({
  isOpen,
  onClose,
  isDark,
  isCoreOnline,
  nodeStatus,
  logs,
  onRefreshStatus,
  onTicketJoined,
}) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'peers' | 'logs'>('connect');
  const [generatedTicket, setGeneratedTicket] = useState<string>('');
  const [ticketPeerCount, setTicketPeerCount] = useState<number>(1);
  const [joinTicketInput, setJoinTicketInput] = useState<string>('');
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [copiedNodeId, setCopiedNodeId] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    kind: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && isCoreOnline) {
      handleGenerateTicket();
    }
  }, [isOpen, isCoreOnline]);

  if (!isOpen) return null;

  const handleGenerateTicket = async () => {
    try {
      const res = await createBoardTicket('workspace', 'SpiderWeb Workspace');
      setGeneratedTicket(res.ticket);
      setTicketPeerCount(res.bootstrapPeersCount);
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err?.message || 'Could not generate invite ticket (is Rust core running?)',
      });
    }
  };

  const handleCopyTicket = async () => {
    if (!generatedTicket) return;
    await navigator.clipboard.writeText(generatedTicket);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  const handleCopyNodeId = async () => {
    if (!nodeStatus?.nodeId) return;
    await navigator.clipboard.writeText(nodeStatus.nodeId);
    setCopiedNodeId(true);
    setTimeout(() => setCopiedNodeId(false), 2000);
  };

  const handleJoinTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinTicketInput.trim()) return;
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const res = await joinBoardTicket(joinTicketInput.trim());
      const totalSynced = res.catchupResults.reduce((acc, r) => acc + r.recordsReceived, 0);
      const msg = `Connected to ${res.bootstrapPeersAdded} bootstrap peer(s) on board "${res.boardId}". Custom ALPN catch-up merged ${totalSynced} record(s) (${res.snapshot.tasks.length} total tasks).`;
      setStatusBanner({ kind: 'success', text: msg });
      setJoinTicketInput('');
      onTicketJoined(msg);
      await onRefreshStatus();
      await handleGenerateTicket();
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err?.message || 'Failed to join board ticket',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleForceCatchup = async () => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const results = await triggerPeerCatchup('workspace');
      await onRefreshStatus();
      setStatusBanner({
        kind: 'info',
        text:
          results.length > 0
            ? `Executed /spiderweb/sync/1.0 catch-up stream with ${results.length} peer(s).`
            : 'No remote peers currently in swarm to catch up with.',
      });
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err?.message || 'Catch-up sync failed',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSpawnTestPeer = async () => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const res = await spawnTestPeer('workspace');
      await onRefreshStatus();
      await handleGenerateTicket();
      const msg = `Spawned live iroh peer ${res.shortPeerId}! Connected via QUIC, completed ALPN CRDT catch-up, and received task ${res.broadcastedTaskId} over iroh-gossip.`;
      setStatusBanner({ kind: 'success', text: msg });
      onTicketJoined(msg);
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err?.message || 'Failed to spawn test peer',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const connectedCount = nodeStatus?.connectedPeers.length || 0;
  const lanCount = nodeStatus?.lanDiscoveredPeers.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div
        className={`w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] ${
          isDark
            ? 'bg-[#11131A]/95 border-white/12 text-zinc-100'
            : 'bg-white/95 border-black/10 text-zinc-900'
        }`}
      >
        {/* Top Modal Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-white/10 bg-white/[0.02]' : 'border-black/[0.08] bg-zinc-50/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                isCoreOnline
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              <Radio size={20} className={isCoreOnline ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight">
                  iroh P2P Connectivity & CRDT Sync Engine
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                    isCoreOnline
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {isCoreOnline ? 'QUIC ENDPOINT ONLINE' : 'CORE OFFLINE'}
                </span>
              </div>
              <p className="text-xs opacity-60 mt-0.5">
                Direct QUIC hole-punching • N0 Relay fallback • LAN mDNS • iroh-gossip +{' '}
                <code className="font-mono">/spiderweb/sync/1.0</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshStatus}
              title="Refresh Endpoint Status"
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300'
                  : 'bg-black/5 border-black/10 hover:bg-black/10 text-zinc-700'
              }`}
            >
              <RefreshCw size={15} className={isBusy ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white'
                  : 'bg-black/5 border-black/10 hover:bg-black/10 text-zinc-600'
              }`}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Connectivity Stack Summary Cards */}
        <div
          className={`px-6 py-3.5 border-b grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs ${
            isDark ? 'border-white/10 bg-black/25' : 'border-black/[0.06] bg-zinc-100/60'
          }`}
        >
          {/* Stable Node Identity */}
          <div
            className={`p-2.5 rounded-2xl border ${
              isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-black/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between opacity-60 text-[10px] font-medium mb-1">
              <span className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-blue-400" />
                Stable Node ID
              </span>
              <span className="font-mono text-[9px] text-emerald-400">PERSISTED</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono font-semibold text-xs truncate">
                {nodeStatus ? nodeStatus.shortNodeId : '—'}
              </span>
              {nodeStatus && (
                <button
                  onClick={handleCopyNodeId}
                  title="Copy full Ed25519 EndpointId"
                  className="p-1 rounded-lg hover:bg-blue-500/20 text-blue-400 transition cursor-pointer"
                >
                  {copiedNodeId ? <Check size={12} /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>

          {/* Local Wi-Fi Discovery */}
          <div
            className={`p-2.5 rounded-2xl border ${
              isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-black/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between opacity-60 text-[10px] font-medium mb-1">
              <span className="flex items-center gap-1">
                <Wifi size={12} className="text-emerald-400" />
                LAN Discovery
              </span>
              <span className="font-mono text-[9px]">mDNS</span>
            </div>
            <div className="font-semibold text-xs flex items-center justify-between">
              <span>{nodeStatus?.localDiscoveryEnabled ? 'Active (Wi-Fi)' : 'Disabled'}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400">
                {lanCount} LAN
              </span>
            </div>
          </div>

          {/* Active Swarm Peers */}
          <div
            className={`p-2.5 rounded-2xl border ${
              isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-black/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between opacity-60 text-[10px] font-medium mb-1">
              <span className="flex items-center gap-1">
                <Zap size={12} className="text-purple-400" />
                Swarm Peers
              </span>
              <span className="font-mono text-[9px]">QUIC</span>
            </div>
            <div className="font-semibold text-xs flex items-center justify-between">
              <span>{connectedCount} Connected</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400">
                N0 Preset
              </span>
            </div>
          </div>

          {/* CRDT State Vector */}
          <div
            className={`p-2.5 rounded-2xl border ${
              isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-black/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between opacity-60 text-[10px] font-medium mb-1">
              <span className="flex items-center gap-1">
                <Server size={12} className="text-amber-400" />
                CRDT Clock
              </span>
              <span className="font-mono text-[9px]">LWW-SET</span>
            </div>
            <div className="font-semibold text-xs flex items-center justify-between">
              <span>{nodeStatus?.crdtRecordsCount ?? 0} Records</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400">
                v{nodeStatus?.lamportClock ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`px-6 pt-3 border-b flex items-center justify-between ${
            isDark ? 'border-white/10' : 'border-black/[0.08]'
          }`}
        >
          <div className="flex items-center gap-2">
            {(
              [
                { id: 'connect', label: 'Invite Ticket & Join', icon: Share2 },
                { id: 'peers', label: `Peers & QUIC Paths (${connectedCount})`, icon: Link2 },
                { id: 'logs', label: `Protocol Activity (${logs.length})`, icon: Activity },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition cursor-pointer ${
                    active
                      ? 'border-blue-500 text-blue-500'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-[10px] font-mono opacity-45 hidden sm:inline">
            IPC Port: {getP2PPort()}
          </span>
        </div>

        {/* Status Feedback Banner */}
        {statusBanner && (
          <div
            className={`mx-6 mt-4 p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
              statusBanner.kind === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : statusBanner.kind === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.kind === 'success' ? (
                <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle size={15} className="shrink-0" />
              )}
              <span>{statusBanner.text}</span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'connect' && (
            <>
              {/* 1. Multi-Peer Invite Ticket Generator */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-white/[0.03] border-white/10' : 'bg-zinc-50 border-black/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold flex items-center gap-2">
                      <Share2 size={14} className="text-blue-400" />
                      <span>Share Multi-Peer Board Ticket</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                        {ticketPeerCount} Bootstrap Peer{ticketPeerCount > 1 ? 's' : ''} Packed
                      </span>
                    </h3>
                    <p className="text-[11px] opacity-60 mt-0.5">
                      Packs the board ID plus up to 4 known peer endpoints (Relay URL + direct LAN/WAN sockets).
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateTicket}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      isDark
                        ? 'bg-white/5 border-white/10 hover:bg-white/10'
                        : 'bg-white border-black/10 hover:bg-zinc-100'
                    }`}
                  >
                    <RefreshCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedTicket || 'Generating ticket...'}
                    className={`flex-1 font-mono text-[11px] px-3 py-2 rounded-xl border outline-none ${
                      isDark
                        ? 'bg-black/40 border-white/10 text-zinc-300'
                        : 'bg-white border-black/10 text-zinc-700'
                    }`}
                  />
                  <button
                    onClick={handleCopyTicket}
                    disabled={!generatedTicket}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0A84FF] hover:bg-[#0070E0] text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-40"
                  >
                    {copiedTicket ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedTicket ? 'Copied!' : 'Copy Ticket'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Join a Remote Peer's Ticket */}
              <form
                onSubmit={handleJoinTicket}
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-white/[0.03] border-white/10' : 'bg-zinc-50 border-black/[0.08]'
                }`}
              >
                <div>
                  <h3 className="text-xs font-semibold flex items-center gap-2">
                    <Link2 size={14} className="text-purple-400" />
                    <span>Join Board via Peer Ticket</span>
                  </h3>
                  <p className="text-[11px] opacity-60 mt-0.5">
                    Paste a <code className="font-mono">swb1:...</code> invite ticket to dial peers via QUIC, exchange missed CRDT state over <code className="font-mono">/spiderweb/sync/1.0</code>, and subscribe to live <code className="font-mono">iroh-gossip</code> updates.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={joinTicketInput}
                    onChange={(e) => setJoinTicketInput(e.target.value)}
                    placeholder="Paste swb1:... invite ticket here"
                    className={`flex-1 font-mono text-xs px-3 py-2 rounded-xl border outline-none ${
                      isDark
                        ? 'bg-black/40 border-white/10 text-zinc-100 placeholder:text-zinc-500 focus:border-purple-500'
                        : 'bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isBusy || !joinTicketInput.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-40"
                  >
                    <ArrowUpRight size={14} />
                    <span>Connect & Sync</span>
                  </button>
                </div>
              </form>

              {/* 3. Built-In Interactive P2P Test Lab */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark
                    ? 'bg-gradient-to-br from-emerald-500/10 via-blue-500/5 to-transparent border-emerald-500/25'
                    : 'bg-gradient-to-br from-emerald-50 to-blue-50/40 border-emerald-500/25'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-semibold flex items-center gap-2">
                      <Sparkles size={14} className="text-emerald-400" />
                      <span>One-Click Live P2P Verification Lab</span>
                    </h3>
                    <p className="text-[11px] opacity-75 mt-1 leading-relaxed">
                      Want to test the entire connectivity stack right now? Click below to spin up a real second{' '}
                      <code className="font-mono">iroh::Endpoint</code> in Rust with its own keypair. It will decode your{' '}
                      <code className="font-mono">swb1:</code> ticket, establish a direct QUIC connection, run the{' '}
                      <code className="font-mono">/spiderweb/sync/1.0</code> CRDT catch-up stream, and broadcast a new task onto your board via{' '}
                      <code className="font-mono">iroh-gossip</code>!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSpawnTestPeer}
                    disabled={isBusy || !isCoreOnline}
                    className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-40"
                  >
                    <Zap size={14} />
                    <span>Spawn Test Peer & Sync</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'peers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold">
                    Connected Swarm Peers & Transport Paths
                  </h3>
                  <p className="text-[11px] opacity-60">
                    iroh tries direct UDP QUIC hole-punching first and falls back to encrypted N0 relays while probing for direct upgrades.
                  </p>
                </div>
                <button
                  onClick={handleForceCatchup}
                  disabled={isBusy || connectedCount === 0}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw size={13} className={isBusy ? 'animate-spin' : ''} />
                  <span>Force ALPN Catch-Up</span>
                </button>
              </div>

              {connectedCount === 0 ? (
                <div
                  className={`p-8 rounded-2xl border text-center space-y-2 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-zinc-50 border-black/[0.08]'
                  }`}
                >
                  <Radio size={24} className="mx-auto opacity-40" />
                  <p className="text-xs font-medium">No Remote Peers Connected Yet</p>
                  <p className="text-[11px] opacity-55 max-w-md mx-auto">
                    Share your multi-peer ticket with another instance, or click{' '}
                    <strong>"Spawn Test Peer & Sync"</strong> in the first tab to verify live QUIC connectivity.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {nodeStatus?.connectedPeers.map((peer) => (
                    <div
                      key={peer.peerId}
                      className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
                        isDark
                          ? 'bg-white/[0.03] border-white/10'
                          : 'bg-zinc-50 border-black/[0.08]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="font-mono text-xs font-semibold truncate">
                            {peer.peerId}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                              peer.isDirect
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                            }`}
                          >
                            {peer.isDirect
                              ? 'DIRECT QUIC (UDP)'
                              : 'RELAYED (UPGRADING...)'}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                            {peer.source}
                          </span>
                        </div>
                      </div>

                      {peer.activeAddrs.length > 0 && (
                        <div className="text-[11px] font-mono opacity-65 truncate">
                          Active Path: {peer.activeAddrs.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Local Node Endpoint Details */}
              {nodeStatus && (
                <div
                  className={`p-4 rounded-2xl border space-y-2 text-xs font-mono ${
                    isDark ? 'bg-black/30 border-white/10' : 'bg-zinc-100 border-black/10'
                  }`}
                >
                  <div className="text-[11px] font-sans font-semibold opacity-75">
                    Local Endpoint Telemetry
                  </div>
                  <div className="truncate opacity-70">
                    NodeId: {nodeStatus.nodeId}
                  </div>
                  <div className="truncate opacity-70">
                    Key File: {nodeStatus.keyPath}
                  </div>
                  <div className="truncate opacity-70">
                    Home Relays:{' '}
                    {nodeStatus.relayUrls.length > 0
                      ? nodeStatus.relayUrls.join(', ')
                      : 'N0 Default Relay Map (probing...)'}
                  </div>
                  <div className="truncate opacity-70">
                    Bound UDP Sockets: {nodeStatus.directSockets.join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs opacity-50">
                  No P2P protocol events recorded in this session yet.
                </div>
              ) : (
                logs.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                      isDark ? 'bg-white/[0.02] border-white/10' : 'bg-zinc-50 border-black/[0.08]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Terminal size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold">{entry.title}</div>
                        <div className="text-[11px] opacity-65 font-mono break-all mt-0.5">
                          {entry.detail}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono opacity-45 shrink-0">
                      {entry.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
