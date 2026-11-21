const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

// MDB Reader는 Jet OLE DB를 쓰는 32비트 .NET Framework 프로그램이다. Windows 배포
// 직전에 소스와 함께 다시 컴파일해 JS/C# 스트리밍 프로토콜 버전이 어긋나지 않게 한다.
if (process.platform !== 'win32') {
  console.log('Skipping MDB Reader build outside Windows.');
  process.exit(0);
}

const windowsDir = process.env.WINDIR || 'C:\\Windows';
const compiler = path.join(windowsDir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe');
if (!existsSync(compiler)) {
  console.error(`C# compiler was not found: ${compiler}`);
  process.exit(1);
}

const source = path.join('electron', 'helpers', 'MdbReader.cs');
const output = path.join('electron', 'helpers', 'MdbReader.exe');
const result = spawnSync(compiler, [
  '/nologo',
  '/target:exe',
  '/platform:x86',
  `/out:${output}`,
  '/reference:System.Data.dll',
  '/reference:System.Web.Extensions.dll',
  source,
], { stdio: 'inherit' });

process.exit(result.status ?? 1);
