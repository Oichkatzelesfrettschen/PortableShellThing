
import { FileSystemNode, NodeType, VirtualFileSystem, PermissionOp } from '../types';

export class VFS implements VirtualFileSystem {
  private root: FileSystemNode;

  constructor(initialRoot: FileSystemNode) {
    this.root = JSON.parse(JSON.stringify(initialRoot));
  }

  private resolvePath(path: string, currentDir: string): string[] {
    const absolutePath = path.startsWith('/') ? path : `${currentDir}/${path}`;
    const parts = absolutePath.split('/').filter(p => p !== '' && p !== '.');
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }
    return resolved;
  }

  getNode(path: string, currentDir: string, followLinks: boolean = true): FileSystemNode | null {
    if (path === '/') return this.root;
    const parts = this.resolvePath(path, currentDir);
    let current = this.root;
    let linkDepth = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (current.type !== NodeType.DIRECTORY || !current.children || !current.children[part]) {
        return null;
      }
      current = current.children[part];

      if (followLinks && current.type === NodeType.SYMLINK && current.target) {
        if (++linkDepth > 10) return null; // Prevent cycles
        const remaining = parts.slice(i + 1).join('/');
        const resolvedTarget = current.target.startsWith('/') ? current.target : `${parts.slice(0, i).join('/')}/${current.target}`;
        return this.getNode(remaining ? `${resolvedTarget}/${remaining}` : resolvedTarget, '/', followLinks);
      }
    }
    return current;
  }

  checkPermission(node: FileSystemNode, user: string, group: string, op: PermissionOp): boolean {
    if (user === 'root') return true;
    const perms = node.permissions;
    let checkStr = "";
    if (user === node.owner) {
      checkStr = perms.slice(1, 4);
    } else if (group === node.group) {
      checkStr = perms.slice(4, 7);
    } else {
      checkStr = perms.slice(7, 10);
    }
    return checkStr.includes(op);
  }

  createNode(path: string, currentDir: string, type: NodeType, content: string = ""): boolean {
    const parts = this.resolvePath(path, currentDir);
    const nodeName = parts.pop();
    if (!nodeName) return false;

    let current = this.root;
    for (const part of parts) {
      if (!current.children || !current.children[part]) return false;
      current = current.children[part];
    }

    if (current.children?.[nodeName]) return false;

    if (!current.children) current.children = {};
    current.children[nodeName] = {
      name: nodeName,
      type,
      content: type === NodeType.FILE ? content : undefined,
      children: type === NodeType.DIRECTORY ? {} : undefined,
      permissions: type === NodeType.DIRECTORY ? "drwxr-xr-x" : "-rw-r--r--",
      owner: "user",
      group: "user",
      lastModified: new Date().toISOString(),
      size: content.length || 0,
    };
    return true;
  }

  createSymlink(path: string, target: string, currentDir: string): boolean {
    const parts = this.resolvePath(path, currentDir);
    const nodeName = parts.pop();
    if (!nodeName) return false;

    let current = this.root;
    for (const part of parts) {
      if (!current.children || !current.children[part]) return false;
      current = current.children[part];
    }

    if (!current.children) current.children = {};
    current.children[nodeName] = {
      name: nodeName,
      type: NodeType.SYMLINK,
      target,
      permissions: "lrwxrwxrwx",
      owner: "user",
      group: "user",
      lastModified: new Date().toISOString(),
      size: target.length,
    };
    return true;
  }

  removeNode(path: string, currentDir: string, recursive: boolean = false): boolean {
    const parts = this.resolvePath(path, currentDir);
    const nodeName = parts.pop();
    if (!nodeName) return false;

    let current = this.root;
    for (const part of parts) {
      if (!current.children || !current.children[part]) return false;
      current = current.children[part];
    }

    const target = current.children?.[nodeName];
    if (!target) return false;

    if (target.type === NodeType.DIRECTORY && !recursive && Object.keys(target.children || {}).length > 0) {
      return false;
    }

    delete current.children[nodeName];
    return true;
  }

  listNodes(path: string, currentDir: string): FileSystemNode[] | null {
    const node = this.getNode(path, currentDir);
    if (!node || node.type !== NodeType.DIRECTORY || !node.children) return null;
    return Object.values(node.children);
  }

  updateFileContent(path: string, currentDir: string, content: string): boolean {
    const node = this.getNode(path, currentDir);
    if (!node || node.type !== NodeType.FILE) return false;
    node.content = content;
    node.size = content.length;
    node.lastModified = new Date().toISOString();
    return true;
  }

  copyNode(srcPath: string, destPath: string, currentDir: string, recursive: boolean = false): boolean {
    const srcNode = this.getNode(srcPath, currentDir);
    if (!srcNode) return false;
    if (srcNode.type === NodeType.DIRECTORY && !recursive) return false;

    const copyOfNode = JSON.parse(JSON.stringify(srcNode));
    const destParts = this.resolvePath(destPath, currentDir);
    const destName = destParts.pop();
    if (!destName) return false;

    let parent = this.root;
    for (const part of destParts) {
      if (!parent.children || !parent.children[part]) return false;
      parent = parent.children[part];
    }

    if (!parent.children) parent.children = {};
    parent.children[destName] = copyOfNode;
    copyOfNode.name = destName;
    return true;
  }

  moveNode(srcPath: string, destPath: string, currentDir: string): boolean {
    const success = this.copyNode(srcPath, destPath, currentDir, true);
    if (success) {
      return this.removeNode(srcPath, currentDir, true);
    }
    return false;
  }

  chmod(path: string, mode: string, currentDir: string): boolean {
    const node = this.getNode(path, currentDir);
    if (!node) return false;
    if (/^[0-7]{3}$/.test(mode)) {
      const octals = mode.split('').map(n => parseInt(n, 10));
      const convert = (val: number) => {
        return (val & 4 ? 'r' : '-') + (val & 2 ? 'w' : '-') + (val & 1 ? 'x' : '-');
      };
      const typeChar = node.type === NodeType.DIRECTORY ? 'd' : node.type === NodeType.SYMLINK ? 'l' : '-';
      node.permissions = typeChar + octals.map(convert).join('');
      return true;
    }
    return false;
  }

  chown(path: string, ownerGroup: string, currentDir: string): boolean {
    const node = this.getNode(path, currentDir);
    if (!node) return false;
    const [owner, group] = ownerGroup.split(':');
    if (owner) node.owner = owner;
    if (group) node.group = group;
    return true;
  }

  find(path: string, currentDir: string, criteria: { name?: string, type?: NodeType, size?: string, mtime?: string }): string[] {
    const results: string[] = [];
    const baseNode = this.getNode(path, currentDir);
    if (!baseNode) return [];

    const traverse = (node: FileSystemNode, currentPath: string) => {
      let match = true;
      if (criteria.name && !node.name.includes(criteria.name)) match = false;
      if (criteria.type && node.type !== criteria.type) match = false;
      
      if (criteria.size) {
        const sizeLimit = parseInt(criteria.size.replace(/[+-]/, ''));
        if (criteria.size.startsWith('+') && node.size <= sizeLimit) match = false;
        if (criteria.size.startsWith('-') && node.size >= sizeLimit) match = false;
        if (!criteria.size.startsWith('+') && !criteria.size.startsWith('-') && node.size !== sizeLimit) match = false;
      }

      if (match) results.push(currentPath);

      if (node.type === NodeType.DIRECTORY && node.children) {
        for (const childName of Object.keys(node.children)) {
          traverse(node.children[childName], `${currentPath}/${childName}`);
        }
      }
    };

    const absPathBase = path.startsWith('/') ? path : (currentDir === '/' ? `/${path}` : `${currentDir}/${path}`);
    traverse(baseNode, absPathBase.endsWith('/') ? absPathBase.slice(0, -1) : absPathBase);
    return results;
  }
}
