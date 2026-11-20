"""Extract verified frontend assets from the recipient's own native binary."""
import argparse
import hashlib
import json
from pathlib import Path
import zlib


def extract(binary, manifest, output):
    recipe = json.loads(Path(manifest).read_text(encoding='utf8'))
    with Path(binary).open('rb') as stream:
        assets = {}
        for name, entry in recipe.items():
            stream.seek(entry['offset'])
            compressed = stream.read(entry['compressed_size'])
            content = zlib.decompress(compressed, -15) if entry['method'] == 8 else compressed
            if len(content) != entry['size'] or hashlib.sha256(content).hexdigest() != entry['sha256']:
                raise RuntimeError('原生前端不匹配已审核的 2.33.0：' + name)
            assets[name] = content
    target = Path(output)
    target.mkdir(parents=True, exist_ok=True)
    for name, content in assets.items():
        if name == 'index.html':
            content = content.replace(b'<title>Jetski Web</title>', b'<title>Antigravity</title>')
        (target / name).write_bytes(content)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('binary')
    parser.add_argument('manifest')
    parser.add_argument('output')
    args = parser.parse_args()
    extract(args.binary, args.manifest, args.output)
