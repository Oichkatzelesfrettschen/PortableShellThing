
export enum NodeType {
  FILE = "FILE",
  DIRECTORY = "DIRECTORY",
  SYMLINK = "SYMLINK",
}

export interface FileSystemNode {
  name: string;
  type: NodeType;
  content?: string;
  target?: string; // For symlinks
  children?: Record<string, FileSystemNode>;
  permissions: string;
  owner: string;
  group: string;
  lastModified: string;
  size: number;
}

export interface HistoryItem {
  command: string;
  output: { text: string; type: 'default' | 'error' | 'system' | 'ai' | 'man' | 'ssh' | 'network' }[];
  cwd: string;
  timestamp: number;
}

export interface SyscallContext {
  args: string[];
  vfs: VirtualFileSystem;
  cwd: string;
  username: string;
  group: string;
  hostname: string;
  setCwd: (path: string) => void;
  setHostname: (host: string) => void;
  setUser: (user: string, group: string) => void;
  clear: () => void;
  openEditor: (filename: string, initialContent: string, onSave: (content: string) => void) => void;
  promptPassword: (prompt: string) => Promise<string>;
}

export interface Command {
  name: string;
  description: string;
  execute: (ctx: SyscallContext) => Promise<string | string[]>;
}

export type PermissionOp = 'r' | 'w' | 'x';

export interface VirtualFileSystem {
  getNode: (path: string, currentDir: string, followLinks?: boolean) => FileSystemNode | null;
  createNode: (path: string, currentDir: string, type: NodeType, content?: string) => boolean;
  createSymlink: (path: string, target: string, currentDir: string) => boolean;
  removeNode: (path: string, currentDir: string, recursive?: boolean) => boolean;
  listNodes: (path: string, currentDir: string) => FileSystemNode[] | null;
  copyNode: (srcPath: string, destPath: string, currentDir: string, recursive?: boolean) => boolean;
  moveNode: (srcPath: string, destPath: string, currentDir: string) => boolean;
  updateFileContent: (path: string, currentDir: string, content: string) => boolean;
  checkPermission: (node: FileSystemNode, user: string, group: string, op: PermissionOp) => boolean;
  chmod: (path: string, mode: string, currentDir: string) => boolean;
  chown: (path: string, ownerGroup: string, currentDir: string) => boolean;
  find: (path: string, currentDir: string, criteria: { name?: string, type?: NodeType, size?: string, mtime?: string }) => string[];
}
