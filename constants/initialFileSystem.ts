
import { FileSystemNode, NodeType } from '../types';

const now = new Date().toISOString();

export const initialFileSystem: FileSystemNode = {
  name: "/",
  type: NodeType.DIRECTORY,
  permissions: "drwxr-xr-x",
  owner: "root",
  group: "root",
  lastModified: now,
  size: 4096,
  children: {
    "bin": {
      name: "bin",
      type: NodeType.DIRECTORY,
      permissions: "drwxr-xr-x",
      owner: "root",
      group: "root",
      lastModified: now,
      size: 4096,
      children: {}
    },
    "etc": {
      name: "etc",
      type: NodeType.DIRECTORY,
      permissions: "drwxr-xr-x",
      owner: "root",
      group: "root",
      lastModified: now,
      size: 4096,
      children: {
        "passwd": {
          name: "passwd",
          type: NodeType.FILE,
          content: "root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:user:/home/user:/bin/bash\nguest:x:1001:1001:guest:/home/guest:/bin/bash",
          permissions: "-rw-r--r--",
          owner: "root",
          group: "root",
          lastModified: now,
          size: 150
        },
        "shadow": {
          name: "shadow",
          type: NodeType.FILE,
          content: "root:password123\nuser:admin\nguest:guest",
          permissions: "-rw-------",
          owner: "root",
          group: "root",
          lastModified: now,
          size: 60
        },
        "sudoers": {
          name: "sudoers",
          type: NodeType.FILE,
          content: "root ALL=(ALL:ALL) ALL\nuser ALL=(ALL:ALL) ALL",
          permissions: "-r--r-----",
          owner: "root",
          group: "root",
          lastModified: now,
          size: 50
        },
        "motd": {
          name: "motd",
          type: NodeType.FILE,
          content: "Welcome to POSIX Nanokernel v1.2.0 LTS\nNetworking: Enabled (Shared from Host)\nSymlink Support: Active",
          permissions: "-rw-r--r--",
          owner: "root",
          group: "root",
          lastModified: now,
          size: 120
        }
      }
    },
    "home": {
      name: "home",
      type: NodeType.DIRECTORY,
      permissions: "drwxr-xr-x",
      owner: "root",
      group: "root",
      lastModified: now,
      size: 4096,
      children: {
        "user": {
          name: "user",
          type: NodeType.DIRECTORY,
          permissions: "drwxr-xr-x",
          owner: "user",
          group: "user",
          lastModified: now,
          size: 4096,
          children: {
            "README.md": {
              name: "README.md",
              type: NodeType.FILE,
              content: "# System v1.2.0\nTry: 'ping google.com', 'su root', or 'ln -s README.md link'.",
              permissions: "-rw-r--r--",
              owner: "user",
              group: "user",
              lastModified: now,
              size: 80
            }
          }
        },
        "guest": {
          name: "guest",
          type: NodeType.DIRECTORY,
          permissions: "drwxr-xr-x",
          owner: "guest",
          group: "guest",
          lastModified: now,
          size: 4096,
          children: {}
        }
      }
    },
    "root": {
      name: "root",
      type: NodeType.DIRECTORY,
      permissions: "drwx------",
      owner: "root",
      group: "root",
      lastModified: now,
      size: 4096,
      children: {}
    }
  }
};
