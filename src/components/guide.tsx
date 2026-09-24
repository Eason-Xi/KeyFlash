import Link from 'next/link';
import { Cpu, Usb, Zap, ShieldCheck, ArrowRight } from 'lucide-react';
import { PageHeading } from './ui';
export function Guide() {
  return (
    <div className="page guide-page">
      <PageHeading
        eyebrow="GETTING STARTED"
        title="第一次烧录，从这里开始。"
        description="准备一根 USB 数据线、一块兼容的开发板，以及一点创造力。"
      />
      <div className="guide-steps">
        {[
          {
            icon: Cpu,
            n: '01',
            title: '确认硬件与固件',
            text: '核对芯片、PCB 型号、硬件版本和引脚定义。ESP32、ESP32-S3 与 ESP32-C3 不能混刷；芯片相同也不意味着键盘接线兼容。',
          },
          {
            icon: Usb,
            n: '02',
            title: '连接你的设备',
            text: '在电脑上使用 Chrome 或 Edge 打开网站，通过数据线连接设备。关闭占用串口的 IDE 或终端，然后点击“连接设备”，在浏览器弹窗中选择串口。',
          },
          {
            icon: Zap,
            n: '03',
            title: '选择版本并烧录',
            text: '登录后选择稳定版本，核对地址和硬件信息。开始烧录后保持连接，等待文件下载、校验、写入和设备校验完成，再测试键盘功能。',
          },
          {
            icon: ShieldCheck,
            n: '04',
            title: '分享兼容性结果',
            text: '记录系统、浏览器、键盘型号与烧录结果。检查按键、RGB、蓝牙与旋钮，让后来的使用者更容易找到适配的固件。',
          },
        ].map(({ icon: Icon, n, title, text }) => (
          <article className="panel" key={n}>
            <div className="guide-step-top">
              <Icon size={26} />
              <span>{n}</span>
            </div>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <section className="panel prose">
        <h2>常见问题</h2>
        <details open>
          <summary>找不到串口或连接失败？</summary>
          <p>
            确认 USB 线能传输数据。部分开发板需要安装厂商提供的 CH340 或 CP210x
            驱动。关闭串口监视器；按住 BOOT，按一下 RESET，松开 BOOT
            后重试。不同开发板的下载模式可能不同，请以硬件文档为准。
          </p>
        </details>
        <details>
          <summary>为什么 Safari / Firefox 无法在线烧录？</summary>
          <p>
            本项目面向支持 Web Serial 的桌面 Chrome /
            Edge。在线烧录页面会检测实际浏览器能力；站点需要 HTTPS，本地开发可使用 localhost。
          </p>
        </details>
        <details>
          <summary>会丢失原来的设置吗？</summary>
          <p>
            写入目标分区会覆盖对应数据。勾选“擦除全部
            Flash”还会清除其他分区中的键位、网络和设备配置。请先按照设备文档备份重要配置。
          </p>
        </details>
        <details>
          <summary>SHA-256 校验通过是否代表固件安全？</summary>
          <p>
            校验只能证明下载内容与作者上传内容一致，无法证明固件无恶意或一定兼容。请优先选择来源可信、硬件要求明确且有真实测试反馈的项目。
          </p>
        </details>
        <details>
          <summary>上传哪些文件，地址怎么填写？</summary>
          <p>
            MVP 在线烧录支持原始 BIN 文件。使用构建工具生成的 flash_args 或 flasher_args.json
            核对地址。常见应用地址是 0x10000、分区表为 0x8000，但不能套用到所有项目；合并镜像常用
            0x0。HEX / UF2 需要转换为适合 ESP32 的 BIN 后上传。
          </p>
        </details>
      </section>
      <Link href="/explore" className="button primary">
        准备好了，发现固件 <ArrowRight size={17} />
      </Link>
    </div>
  );
}
