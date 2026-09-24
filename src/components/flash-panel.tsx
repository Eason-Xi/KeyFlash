'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Usb, Zap, ShieldCheck, CheckCircle2, AlertTriangle, Terminal, Unplug } from 'lucide-react';
import type { ESPLoader, Transport } from 'esptool-js';
import type { Project, Release } from '@/lib/types';
import { getFile } from '@/lib/api';
import { db } from '@/lib/supabase';
import { formatBytes, message } from '@/lib/validation';
import { prepareFirmware } from '@/lib/firmware';
import { useApp } from './providers';
export function FlashPanel({ project: p, releases }: { project: Project; releases: Release[] }) {
  const params = useSearchParams();
  const { user, notify } = useApp();
  const [releaseId, setReleaseId] = useState(
    params.get('version') ||
      releases.find((r) => r.channel === 'stable')?.id ||
      releases[0]?.id ||
      '',
  );
  const release = releases.find((r) => r.id === releaseId);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState('idle');
  const [device, setDevice] = useState('');
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState('—');
  const [logs, setLogs] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [erase, setErase] = useState(false);
  const [error, setError] = useState('');
  const loader = useRef<ESPLoader | null>(null);
  const transport = useRef<Transport | null>(null);
  const busy = phase === 'connecting' || phase === 'flashing';
  const running = useRef(false);
  const mounted = useRef(true);
  function log(text: string) {
    if (mounted.current) setLogs((v) => [...v.slice(-199), text.replace(/\x1b\[[0-9;]*m/g, '')]);
  }
  useEffect(() => {
    mounted.current = true;
    setSupported('serial' in navigator && window.isSecureContext);
    const guard = (e: BeforeUnloadEvent) => {
      if (running.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    const blockNav = (e: MouseEvent) => {
      if (running.current && (e.target as Element)?.closest('a[href]')) {
        e.preventDefault();
        notify('烧录进行中，请完成后再离开页面', true);
      }
    };
    document.addEventListener('click', blockNav, true);
    return () => {
      mounted.current = false;
      window.removeEventListener('beforeunload', guard);
      document.removeEventListener('click', blockNav, true);
      if (!running.current) void transport.current?.disconnect().catch(() => {});
    };
  }, [notify]);
  async function disconnect() {
    try {
      await transport.current?.disconnect();
    } catch {
    } finally {
      transport.current = null;
      loader.current = null;
      setDevice('');
    }
  }
  async function connect() {
    if (!release || !user) return;
    setPhase('connecting');
    setError('');
    setLogs([]);
    setProgress(0);
    try {
      const port = await navigator.serial.requestPort();
      const { ESPLoader, Transport } = await import('esptool-js');
      const t = new Transport(port);
      transport.current = t;
      const l = new ESPLoader({
        transport: t,
        baudrate: release.manifest.baudRate,
        terminal: { clean: () => setLogs([]), write: log, writeLine: log },
      });
      loader.current = l;
      await l.main();
      const chip = l.chip.CHIP_NAME;
      if (chip !== p.chip) throw new Error(`芯片不匹配：当前设备为 ${chip}，固件需要 ${p.chip}。`);
      const size = await l.detectFlashSize();
      if (!size) throw new Error('无法识别 Flash 容量，已停止连接以避免越界写入。');
      const match = size.match(/^(\d+)(KB|MB)$/);
      if (!match) throw new Error(`无法解析 Flash 容量：${size}`);
      const bytes = Number(match[1]) * (match[2] === 'MB' ? 1048576 : 1024);
      if (release.manifest.files.some((f) => f.address + Math.ceil(f.size / 4096) * 4096 > bytes))
        throw new Error(`固件超出当前设备 ${size} Flash 容量`);
      setDevice(`${chip} · ${size} · ${t.getInfo()}`);
      setPhase('connected');
      log('设备已连接。请核对硬件信息后开始烧录。');
    } catch (e) {
      await disconnect();
      setPhase('error');
      setError(
        e instanceof DOMException && e.name === 'NotFoundError'
          ? '未选择设备。可重新点击连接设备。'
          : message(e),
      );
    }
  }
  async function flash() {
    if (!release || !loader.current || !user || !confirmed) return;
    running.current = true;
    setPhase('flashing');
    setError('');
    let sessionId = '';
    let hardwareWritten = false;
    try {
      log('下载固件并进行 SHA-256 校验…');
      const files = await prepareFirmware(release.manifest, getFile, (name) =>
        log(`${name} SHA-256 校验通过`),
      );
      const { data, error: saveError } = await db()
        .from('flash_sessions')
        .insert({
          user_id: user.id,
          project_id: p.id,
          version_id: release.id,
          chip: p.chip,
          status: 'started',
        })
        .select('id')
        .single();
      if (saveError) throw saveError;
      sessionId = data.id;
      const SparkMD5 = (await import('spark-md5')).default;
      log(erase ? '正在擦除全部 Flash 并写入…' : '正在擦除目标扇区并写入…');
      const start = performance.now();
      const total = files.reduce((a, f) => a + f.data.length, 0);
      await loader.current.writeFlash({
        fileArray: files,
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: erase,
        compress: true,
        calculateMD5Hash: (image) => SparkMD5.ArrayBuffer.hash(image.slice().buffer),
        reportProgress: (i, w, t) => {
          const written =
            files.slice(0, i).reduce((a, f) => a + f.data.length, 0) +
            files[i].data.length * (w / t);
          setProgress(Math.min(99, Math.round((written / total) * 100)));
          setSpeed(
            `${(written / 1024 / Math.max(0.1, (performance.now() - start) / 1000)).toFixed(1)} KB/s`,
          );
        },
      });
      hardwareWritten = true;
      log('写入与设备 MD5 校验通过。');
      try {
        await loader.current.after('hard_reset');
        log('已发送设备重启指令。');
      } catch {
        log('自动重启未完成，请手动按 RESET 重启设备。');
      }
      const { error: recordError } = await db()
        .from('flash_sessions')
        .update({ status: 'success' })
        .eq('id', sessionId);
      if (recordError) log(`设备已烧录成功，但历史记录同步失败：${recordError.message}`);
      setProgress(100);
      setPhase('success');
    } catch (e) {
      const text = message(e);
      setError(text);
      log(`错误：${text}`);
      setPhase('error');
      if (sessionId && !hardwareWritten) {
        const { error: recordError } = await db()
          .from('flash_sessions')
          .update({ status: 'failed', error: text.slice(0, 2000) })
          .eq('id', sessionId);
        if (recordError) log('烧录失败记录未能同步。');
      }
    } finally {
      running.current = false;
      await disconnect();
    }
  }
  const disabled =
    p.demo ||
    !release ||
    !release.online_enabled ||
    !release.manifest.files.length ||
    p.status === 'archived';
  return (
    <section className="panel flash-panel">
      <div className="panel-title">
        <h2>
          <Zap size={20} />
          在线烧录
        </h2>
        <Link href="/guide">查看教程</Link>
      </div>
      <p className="muted">连接你的键盘，在浏览器中完成固件更新。</p>
      {supported === false && (
        <div className="warning">
          <AlertTriangle size={19} />
          当前环境不支持 Web Serial，请使用桌面版 Chrome / Edge，并通过 HTTPS 或 localhost 打开。
        </div>
      )}
      {disabled && (
        <div className="warning">
          <AlertTriangle size={19} />
          {p.demo
            ? '这是示例项目，没有可用的烧录文件。发布真实固件后即可在线烧录。'
            : '此版本尚未提供可在线烧录的固件，或项目已归档。'}
        </div>
      )}
      {!user && (
        <div className="inline-note">
          在线烧录需要<Link href="/login">登录账号</Link>，以便保存你的设备与烧录记录。
        </div>
      )}
      <label className="field-label">
        选择固件版本
        <select
          value={releaseId}
          disabled={busy || Boolean(device)}
          onChange={(e) => {
            setReleaseId(e.target.value);
            setConfirmed(false);
            setPhase('idle');
          }}
        >
          {releases.length ? (
            releases.map((r) => (
              <option key={r.id} value={r.id}>
                v{r.version} · {r.channel} · {r.hardware}
              </option>
            ))
          ) : (
            <option value="">暂无版本</option>
          )}
        </select>
      </label>
      <div className="flash-device">
        <span className={device ? 'connected' : ''}>
          <Usb size={27} />
        </span>
        <div>
          <strong>{device || '尚未连接设备'}</strong>
          <p>
            {device
              ? '已识别设备，请确认下方硬件信息。'
              : '使用支持数据传输的 USB 线连接 ESP32 设备。'}
          </p>
        </div>
        <button
          className="button secondary small"
          disabled={busy || !supported || disabled || !user}
          onClick={
            device
              ? async () => {
                  await disconnect();
                  setPhase('idle');
                }
              : connect
          }
        >
          {device ? (
            <>
              <Unplug size={15} />
              断开
            </>
          ) : phase === 'connecting' ? (
            '连接中…'
          ) : (
            '连接设备'
          )}
        </button>
      </div>
      <div className="manifest-summary">
        <span>
          目标芯片<strong>{p.chip}</strong>
        </span>
        <span>
          文件大小
          <strong>
            {formatBytes(release?.manifest.files.reduce((n, f) => n + f.size, 0) || 0)}
          </strong>
        </span>
        <span>
          波特率<strong>{release?.manifest.baudRate.toLocaleString() || '—'}</strong>
        </span>
      </div>
      {release?.manifest.files.map((f) => (
        <div className="file-address" key={f.path}>
          <code>{f.name}</code>
          <code>0x{f.address.toString(16).padStart(6, '0')}</code>
          <span>{formatBytes(f.size)}</span>
        </div>
      ))}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          我已确认设备为 <strong>{release?.hardware || p.hardware}</strong>
          ，并了解固件更新会覆盖目标区域的数据。
        </span>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={erase}
          disabled={busy}
          onChange={(e) => setErase(e.target.checked)}
        />
        <span>擦除全部 Flash（包括已保存的键位、网络与设备配置）</span>
      </label>
      <button
        className="button primary full"
        disabled={busy || !device || !confirmed || disabled || !user}
        onClick={flash}
      >
        <Zap size={17} />
        {phase === 'flashing'
          ? '正在烧录，请勿断开设备…'
          : phase === 'success'
            ? '重新连接后可再次烧录'
            : '开始烧录'}
      </button>
      {(busy || progress > 0) && (
        <div className="progress-section">
          <div>
            <span>{phase === 'success' ? '烧录完成' : '烧录进度'}</span>
            <strong>
              {progress}% · {speed}
            </strong>
          </div>
          <progress value={progress} max={100} />
        </div>
      )}
      {error && (
        <div className="warning" role="alert">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {phase === 'success' && (
        <div className="success-box">
          <CheckCircle2 size={26} />
          <div>
            <strong>固件已写入并通过校验</strong>
            <p>请测试按键、旋钮和灯光，并分享兼容性结果。</p>
            <Link href={`/project/${p.slug}/compatibility`} className="button secondary small">
              提交成功 / 失败反馈
            </Link>
          </div>
        </div>
      )}
      <div className="serial-log">
        <div>
          <Terminal size={15} />
          烧录日志<span>ESPTOOL-JS</span>
        </div>
        <pre aria-live="polite">{logs.join('\n') || '等待连接设备…'}</pre>
      </div>
      <p className="micro-note">
        <ShieldCheck size={14} />
        下载后验证 SHA-256，写入后校验设备 MD5。烧录期间请勿关闭页面或拔出设备。
      </p>
    </section>
  );
}
