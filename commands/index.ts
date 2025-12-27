
import { Command, NodeType, SyscallContext } from '../types';
import { GoogleGenAI } from '@google/genai';

const aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAN_PAGES: Record<string, string> = {
  tar: `TAR(1)                          User Commands                         TAR(1)
NAME
       tar - an archiving utility
SYNOPSIS
       tar -cf ARCHIVE.tar FILE...
       tar -xf ARCHIVE.tar`,
  ping: `PING(1)                         User Commands                         PING(1)
NAME
       ping - send ICMP ECHO_REQUEST to network hosts`,
  ln: `LN(1)                           User Commands                          LN(1)
NAME
       ln - make links between files
SYNOPSIS
       ln -s TARGET LINK_NAME`,
  su: `SU(1)                           User Commands                          SU(1)
NAME
       su - run a command with substitute user and group ID`,
  sudo: `SUDO(8)                        System Manager's Manual                 SUDO(8)
NAME
       sudo - execute a command as another user`,
};

export const commands: Record<string, Command> = {
  ls: {
    name: 'ls',
    description: 'List directory contents',
    execute: async (ctx) => {
      const longFormat = ctx.args.includes('-l');
      const classify = ctx.args.includes('-F');
      const path = ctx.args.filter(a => !a.startsWith('-'))[0] || '.';
      const nodes = ctx.vfs.listNodes(path, ctx.cwd);
      if (!nodes) return `ls: cannot access '${path}': No such file or directory`;

      return nodes.map(n => {
        let name = n.name;
        if (classify) {
          if (n.type === NodeType.DIRECTORY) name += '/';
          else if (n.type === NodeType.SYMLINK) name += '@';
          else if (n.permissions.includes('x')) name += '*';
        }
        if (n.type === NodeType.SYMLINK && longFormat) {
          name += ` -> ${n.target}`;
        }

        if (longFormat) {
          const date = new Date(n.lastModified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          return `${n.permissions} ${n.owner} ${n.group} ${n.size.toString().padStart(5)} ${date} ${name}`;
        }
        return name;
      }).join(longFormat ? '\n' : '  ');
    }
  },
  ln: {
    name: 'ln',
    description: 'Make links',
    execute: async (ctx) => {
      if (!ctx.args.includes('-s')) return "ln: only symbolic links (-s) supported currently";
      const targets = ctx.args.filter(a => !a.startsWith('-'));
      if (targets.length < 2) return "ln: missing operand";
      const success = ctx.vfs.createSymlink(targets[1], targets[0], ctx.cwd);
      return success ? "" : "ln: failed to create symlink";
    }
  },
  ping: {
    name: 'ping',
    description: 'Network connectivity check',
    execute: async (ctx) => {
      const host = ctx.args[0] || 'localhost';
      const results = [`PING ${host} (127.0.0.1) 56(84) bytes of data.`];
      for (let i = 0; i < 4; i++) {
        const time = (Math.random() * 50 + 10).toFixed(3);
        results.push(`64 bytes from ${host}: icmp_seq=${i+1} ttl=64 time=${time} ms`);
        await new Promise(r => setTimeout(r, 200));
      }
      return results;
    }
  },
  tar: {
    name: 'tar',
    description: 'Archiving utility',
    execute: async (ctx) => {
      if (ctx.args.includes('-cf')) {
        const archiveName = ctx.args[ctx.args.indexOf('-cf') + 1];
        const files = ctx.args.slice(ctx.args.indexOf('-cf') + 2);
        if (!archiveName || files.length === 0) return "tar: usage tar -cf archive.tar files...";
        const contents = files.map(f => `[FILE: ${f}]\n${ctx.vfs.getNode(f, ctx.cwd)?.content || 'NO_CONTENT'}`).join('\n---\n');
        ctx.vfs.createNode(archiveName, ctx.cwd, NodeType.FILE, contents);
        return `Archive ${archiveName} created.`;
      }
      if (ctx.args.includes('-xf')) {
        const archiveName = ctx.args[ctx.args.indexOf('-xf') + 1];
        if (!archiveName) return "tar: missing archive name";
        return `Extracting ${archiveName}... (Mock implementation)`;
      }
      return "tar: only -cf and -xf supported";
    }
  },
  su: {
    name: 'su',
    description: 'Substitute user',
    execute: async (ctx) => {
      const targetUser = ctx.args[0] || 'root';
      const shadowFile = ctx.vfs.getNode('/etc/shadow', '/', false);
      if (!shadowFile || !shadowFile.content) return "su: authentication system failure";

      const passwords = shadowFile.content.split('\n').reduce((acc, line) => {
        const [u, p] = line.split(':');
        acc[u] = p;
        return acc;
      }, {} as Record<string, string>);

      const pass = await ctx.promptPassword(`Password for ${targetUser}: `);
      if (pass === passwords[targetUser]) {
        ctx.setUser(targetUser, targetUser);
        return `Switched to user ${targetUser}.`;
      }
      return "su: Authentication failure";
    }
  },
  sudo: {
    name: 'sudo',
    description: 'Execute as root',
    execute: async (ctx) => {
      const command = ctx.args[0];
      if (!command) return "sudo: usage: sudo command [args]";
      
      const sudoers = ctx.vfs.getNode('/etc/sudoers', '/', false)?.content || "";
      if (!sudoers.includes(ctx.username) && ctx.username !== 'root') {
        return `${ctx.username} is not in the sudoers file. This incident will be reported.`;
      }

      const pass = await ctx.promptPassword(`[sudo] password for ${ctx.username}: `);
      const shadowFile = ctx.vfs.getNode('/etc/shadow', '/', false)?.content || "";
      const currentUserPass = shadowFile.split('\n').find(l => l.startsWith(ctx.username))?.split(':')[1];

      if (pass === currentUserPass || ctx.username === 'root') {
        const cmd = commands[command];
        if (!cmd) return `sudo: ${command}: command not found`;
        
        const oldUser = ctx.username;
        const oldGroup = ctx.group;
        ctx.setUser('root', 'root');
        const result = await cmd.execute({ ...ctx, args: ctx.args.slice(1) });
        ctx.setUser(oldUser, oldGroup);
        return result;
      }
      return "sudo: 1 incorrect password attempt";
    }
  },
  cat: {
    name: 'cat',
    description: 'Concatenate files',
    execute: async (ctx) => {
      const filename = ctx.args.filter(a => !a.startsWith('-'))[0];
      if (!filename) return "cat: missing operand";
      const node = ctx.vfs.getNode(filename, ctx.cwd);
      if (!node) return `cat: ${filename}: No such file or directory`;
      if (!ctx.vfs.checkPermission(node, ctx.username, ctx.group, 'r')) return "cat: Permission denied";
      return node.content || (node.type === NodeType.SYMLINK ? `Symlink to ${node.target}` : "");
    }
  },
  find: {
    name: 'find',
    description: 'Search for files',
    execute: async (ctx) => {
      const path = !ctx.args[0] || ctx.args[0].startsWith('-') ? '.' : ctx.args[0];
      const criteria: any = {};
      for (let i = 0; i < ctx.args.length; i++) {
        if (ctx.args[i] === '-name') criteria.name = ctx.args[i+1];
        if (ctx.args[i] === '-size') criteria.size = ctx.args[i+1];
        if (ctx.args[i] === '-type') criteria.type = ctx.args[i+1] === 'd' ? NodeType.DIRECTORY : NodeType.FILE;
      }
      return ctx.vfs.find(path, ctx.cwd, criteria).join('\n');
    }
  },
  exit: {
    name: 'exit',
    description: 'Exit shell',
    execute: async (ctx) => {
      if (ctx.username !== 'user') {
        ctx.setUser('user', 'user');
        return "Logged out back to 'user'.";
      }
      return "Session closed.";
    }
  },
  mv: {
    name: 'mv',
    description: 'Move files',
    execute: async (ctx) => {
      const files = ctx.args.filter(a => !a.startsWith('-'));
      if (files.length < 2) return "mv: missing operand";
      return ctx.vfs.moveNode(files[0], files[1], ctx.cwd) ? "" : "mv: failed";
    }
  },
  cp: {
    name: 'cp',
    description: 'Copy files',
    execute: async (ctx) => {
      const recursive = ctx.args.includes('-r');
      const files = ctx.args.filter(a => !a.startsWith('-'));
      if (files.length < 2) return "cp: missing operand";
      return ctx.vfs.copyNode(files[0], files[1], ctx.cwd, recursive) ? "" : "cp: failed";
    }
  },
  mkdir: {
    name: 'mkdir',
    description: 'Make directory',
    execute: async (ctx) => {
      return ctx.vfs.createNode(ctx.args[0], ctx.cwd, NodeType.DIRECTORY) ? "" : "mkdir: failed";
    }
  },
  touch: {
    name: 'touch',
    description: 'Create file',
    execute: async (ctx) => {
      return ctx.vfs.createNode(ctx.args[0], ctx.cwd, NodeType.FILE) ? "" : "touch: failed";
    }
  },
  pwd: { name: 'pwd', description: 'Working directory', execute: async (ctx) => ctx.cwd },
  whoami: { name: 'whoami', description: 'Current user', execute: async (ctx) => ctx.username },
  clear: { name: 'clear', description: 'Clear screen', execute: async (ctx) => { ctx.clear(); return ""; } },
  man: { name: 'man', description: 'Manual', execute: async (ctx) => MAN_PAGES[ctx.args[0]] || "No manual entry." },
};
