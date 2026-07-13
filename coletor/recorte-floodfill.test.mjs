import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temPy = spawnSync('python3', ['-c', 'import scipy,numpy,PIL']).status === 0;

test('recorte flood-fill: corpo claro opaco + fundo transparente', { skip: temPy ? false : 'python3+scipy indisponível' }, () => {
  const out = join(mkdtempSync(join(tmpdir(), 'rec-')), 'o.png');
  const r = spawnSync('python3', ['recortar.py', 'lib/__fixtures__/bolsa-clara-estudio.jpg', out], { cwd: process.cwd() });
  assert.equal(r.status, 0, r.stderr?.toString());
  assert.ok(existsSync(out), 'gerou o PNG');
  const chk = spawnSync('python3', ['-c', [
    'import sys,numpy as np',
    'from PIL import Image',
    `a=np.asarray(Image.open('${out}').convert('RGBA'))[:,:,3]/255.0`,
    'H,W=a.shape',
    'body=a[int(0.42*H):int(0.62*H),int(0.32*W):int(0.68*W)].mean()',
    'corner=a[:int(0.06*H),:int(0.06*W)].mean()',
    'sys.exit(0 if (body>0.9 and corner<0.1) else 1)',
  ].join('\n')]);
  assert.equal(chk.status, 0, 'corpo opaco (>0.9) e canto transparente (<0.1)');
});
