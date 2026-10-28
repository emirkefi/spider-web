import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Group, Project, Role, Task, User } from '../types';

export type EntityKind = 'task' | 'project' | 'user' | 'group' | 'role';

export interface PeerConnectionDetail {
  peerId: string;
  shortId: string;
  pathType: 'direct_quic' | 'relayed' | 'probing';
  isDirect: boolean;
  activeAddrs: string[];
  allAddrs: string[];
  source: string;
}

export interface NodeStatusReport {
  nodeId: string;
  shortNodeId: string;
  keyPersisted: boolean;
  keyPath: string;
  relayUrls: string[];
  directSockets: string[];
  localDiscoveryEnabled: boolean;
  customAlpn: string;
  gossipAlpn: string;
  activeBoardId: string;
  connectedPeers: PeerConnectionDetail[];
  lanDiscoveredPeers: string[];
  crdtRecordsCount: number;
  lamportClock: number;
  spawnedTestPeers: number;
}

export interface BoardSnapshot {
  boardId: string;
  lamportClock: number;
  versionVector: Record<string, number>;
  tasks: Task[];
  projects: Project[];
  users: User[];
  groups: Group[];
  roles: Role[];
}

export interface TicketCreationResponse {
  ticket: string;
  boardId: string;
  bootstrapPeersCount: number;
  bootstrapPeerIds: string[];
}

export interface CatchupResult {
  boardId: string;
  remotePeerId: string;
  recordsReceived: number;
  recordsSent: number;
  totalRecords: number;
  lamportClock: number;
}

export interface JoinTicketResponse {
  boardId: string;
  bootstrapPeersAdded: number;
  catchupResults: CatchupResult[];
  snapshot: BoardSnapshot;
}

export interface TestPeerSpawnResult {
  testPeerId: string;
  shortPeerId: string;
  catchupResult: CatchupResult;
  broadcastedTaskId?: string;
  snapshot: BoardSnapshot;
}

export interface P2PEventEnvelope {
  event: string;
  payload: any;
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__TAURI_INTERNALS__);
}

export function getP2PPort(): number {
  if (typeof window === 'undefined') return 17420;
  const params = new URLSearchParams(window.location.search);
  const p = params.get('p2p_port');
  if (p) {
    const parsed = parseInt(p, 10);
    if (!Number.isNaN(parsed) && parsed > 1024 && parsed < 65535) {
      return parsed;
    }
  }
  return 17420;
}

function getIpcBaseUrl(): string {
  return `http://127.0.0.1:${getP2PPort()}`;
}

/**
 * Invokes a command on the Rust iroh core (via Tauri IPC when in Tauri runtime,
 * or via the local Rust core loopback bridge).
 */
export async function invokeP2PCommand<T = any>(
  command: string,
  args: Record<string, any> = {}
): Promise<T> {
  if (isTauriRuntime()) {
    return await invoke<T>(command, args);
  }

  const res = await fetch(`${getIpcBaseUrl()}/invoke/${command}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Command ${command} failed`);
  }
  return json.data as T;
}

export async function getNodeStatus(boardId = 'workspace'): Promise<NodeStatusReport> {
  return invokeP2PCommand<NodeStatusReport>('get_node_status', { boardId });
}

export async function createBoardTicket(
  boardId = 'workspace',
  boardName?: string
): Promise<TicketCreationResponse> {
  return invokeP2PCommand<TicketCreationResponse>('create_board_ticket', {
    boardId,
    boardName,
  });
}

export async function joinBoardTicket(ticket: string): Promise<JoinTicketResponse> {
  return invokeP2PCommand<JoinTicketResponse>('join_board_ticket', { ticket });
}

export async function broadcastBoardOp(params: {
  boardId?: string;
  kind: EntityKind;
  id: string;
  deleted?: boolean;
  data?: any;
}): Promise<any> {
  return invokeP2PCommand('broadcast_board_op', params);
}

export async function reconcileBoardSnapshot(params: {
  boardId?: string;
  tasks: Task[];
  projects: Project[];
  users: User[];
  groups: Group[];
  roles: Role[];
}): Promise<BoardSnapshot> {
  return invokeP2PCommand<BoardSnapshot>('reconcile_board_snapshot', params);
}

export async function triggerPeerCatchup(boardId = 'workspace'): Promise<CatchupResult[]> {
  return invokeP2PCommand<CatchupResult[]>('trigger_peer_catchup', { boardId });
}

export async function spawnTestPeer(
  boardId = 'workspace',
  customTask?: Partial<Task>
): Promise<TestPeerSpawnResult> {
  return invokeP2PCommand<TestPeerSpawnResult>('spawn_test_peer', {
    boardId,
    customTask,
  });
}

/**
 * Subscribes to live events emitted by the Rust iroh networking engine:
 * - `board://state-synced` (full CRDT catch-up or batch state update)
 * - `board://remote-op` (live incremental `iroh-gossip` operation)
 * - `network://peer-event` (NeighborUp, NeighborDown, LAN mDNS discovery, ALPN catch-up)
 */
export function subscribeP2PEvents(
  onEvent: (envelope: P2PEventEnvelope) => void,
  onConnectionChange?: (connected: boolean) => void
): () => void {
  if (isTauriRuntime()) {
    const eventNames = [
      'board://state-synced',
      'board://remote-op',
      'network://peer-event',
      'network://connected',
    ];
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    Promise.all(
      eventNames.map((evName) =>
        listen(evName, (ev) => {
          if (!cancelled) {
            onEvent({ event: evName, payload: ev.payload });
          }
        })
      )
    ).then((fns) => {
      if (cancelled) {
        fns.forEach((f) => f());
      } else {
        unlisteners.push(...fns);
        onConnectionChange?.(true);
      }
    });

    return () => {
      cancelled = true;
      unlisteners.forEach((f) => f());
    };
  }

  let es: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const connect = () => {
    if (disposed) return;
    es = new EventSource(`${getIpcBaseUrl()}/events`);

    es.onopen = () => {
      onConnectionChange?.(true);
    };

    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as P2PEventEnvelope;
        onEvent(parsed);
      } catch {
        // ignore malformed frame
      }
    };

    es.onerror = () => {
      onConnectionChange?.(false);
      es?.close();
      es = null;
      if (!disposed) {
        retryTimer = setTimeout(connect, 2500);
      }
    };
  };

  connect();

  return () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    es?.close();
  };
}
