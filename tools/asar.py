"""读取和重建 ASAR，保留未修改项、unpacked 标记与文件完整性元数据。"""
import copy
import hashlib
import json
import struct
from pathlib import Path


class Archive:
    def __init__(self, path):
        self.path = Path(path)
        self.raw = self.path.read_bytes()
        header_size, text_size = struct.unpack_from('<I', self.raw, 4)[0], struct.unpack_from('<I', self.raw, 12)[0]
        self.header = json.loads(self.raw[16:16 + text_size])
        self.base = 8 + header_size

    def entries(self, tree=None, prefix=''):
        for name, value in (self.header if tree is None else tree).get('files', {}).items():
            name = prefix + name
            if 'files' in value:
                yield from self.entries(value, name + '/')
            else:
                yield name, value

    def read(self, name):
        value = dict(self.entries())[name]
        start = self.base + int(value['offset'])
        return self.raw[start:start + value['size']]

    def rewrite(self, replacements):
        header = copy.deepcopy(self.header)
        chunks = []
        offset = 0
        for name, entry in self.entries(header):
            if entry.get('unpacked') or 'link' in entry:
                if name in replacements:
                    raise ValueError('不可覆盖 unpacked 或符号链接条目')
                continue
            content = replacements.get(name, self.read(name))
            entry['offset'], entry['size'] = str(offset), len(content)
            if name in replacements and 'integrity' in entry:
                block = entry['integrity'].get('blockSize', 4 * 1024 * 1024)
                entry['integrity'] = {
                    'algorithm': 'SHA256', 'hash': hashlib.sha256(content).hexdigest(),
                    'blockSize': block,
                    'blocks': [hashlib.sha256(content[i:i + block]).hexdigest() for i in range(0, len(content), block)],
                }
            chunks.append(content)
            offset += len(content)
        text = json.dumps(header, ensure_ascii=False, separators=(',', ':')).encode('utf8')
        padding = (4 - (len(text) % 4)) % 4
        header_pickle = struct.pack('<II', 4 + len(text) + padding, len(text)) + text + bytes(padding)
        return struct.pack('<II', 4, len(header_pickle)) + header_pickle + b''.join(chunks)
