import Link from 'next/link';
import { PageHeading } from './ui';
const CONTACT = 'ccxi1221@gmail.com';
const UPDATED = '2026 年 9 月 29 日';
type Section = { title: string; body: React.ReactNode };
function LegalPage({
  eyebrow,
  title,
  description,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: Section[];
}) {
  return (
    <div className="page legal-page">
      <PageHeading eyebrow={eyebrow} title={title} description={description} />
      <article className="panel legal-body">
        <p className="legal-updated">最近更新：{UPDATED}</p>
        {sections.map((s, i) => (
          <section key={s.title}>
            <h2>
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ))}
      </article>
    </div>
  );
}
export function Privacy() {
  return (
    <LegalPage
      eyebrow="PRIVACY"
      title="隐私政策"
      description="说明 KeyFlash 收集哪些信息、如何使用，以及你拥有的权利。"
      sections={[
        {
          title: '我们收集的信息',
          body: (
            <ul>
              <li>
                <strong>登录信息：</strong>你使用 GitHub 或 Google
                登录时，我们从对应服务获取邮箱地址、账号
                ID、用户名或显示名称以及头像链接。我们不会获取或保存你的 GitHub / Google 密码。
              </li>
              <li>
                <strong>你发布的内容：</strong>
                项目资料、固件文件、版本说明、评价与评分，以及兼容性报告中你填写的系统、浏览器、硬件和
                USB 芯片等信息。
              </li>
              <li>
                <strong>使用记录：</strong>
                你的收藏，以及在线烧录记录（所选项目、版本、芯片类型、烧录结果和错误信息）。
              </li>
              <li>
                <strong>技术信息：</strong>
                登录状态保存在你浏览器的本地存储中；网站托管和数据库服务商会记录访问日志（如 IP
                地址、浏览器类型），用于安全和故障排查。
              </li>
            </ul>
          ),
        },
        {
          title: '在线烧录',
          body: (
            <p>
              在线烧录通过浏览器的 Web Serial
              接口在你的电脑上直接与设备通信，固件文件下载到浏览器后在本地写入。我们只记录上面提到的烧录结果，不会读取或上传设备上的其他数据。
            </p>
          ),
        },
        {
          title: '我们如何使用这些信息',
          body: (
            <ul>
              <li>提供登录、创建账号和社区功能（发布、下载、收藏、评价、兼容性验证）。</li>
              <li>展示你的公开昵称和作品，统计项目的烧录、收藏和评分数据。</li>
              <li>排查故障、防止滥用和保障服务安全。</li>
            </ul>
          ),
        },
        {
          title: '公开与私密',
          body: (
            <ul>
              <li>公开可见：昵称、你发布的项目和固件、评价、评分和兼容性报告。</li>
              <li>仅你本人可见：邮箱地址、收藏列表和烧录记录。邮箱不会显示在任何公开页面。</li>
              <li>我们不出售你的个人信息，不投放广告，也不使用第三方统计或追踪工具。</li>
            </ul>
          ),
        },
        {
          title: '第三方服务',
          body: (
            <ul>
              <li>Supabase：提供数据库、登录和文件存储，数据中心位于新加坡。</li>
              <li>Vercel：提供网站托管。</li>
              <li>GitHub、Google：仅用于登录身份验证，其对数据的处理适用各自的隐私政策。</li>
            </ul>
          ),
        },
        {
          title: '保存与删除',
          body: (
            <p>
              账号存续期间我们会保存上述信息。你可以随时发送邮件到{' '}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>{' '}
              申请查看、更正或删除你的账号和个人信息，我们会在核实身份后尽快处理。已被他人下载的固件无法从对方设备上撤回。
            </p>
          ),
        },
        {
          title: '未成年人',
          body: <p>本服务不面向 14 周岁以下的儿童。如发现相关情况，请联系我们删除。</p>,
        },
        {
          title: '政策变更与联系',
          body: (
            <p>
              本政策更新时，我们会修改本页顶部的日期；重大变更会在网站上提示。如有任何疑问，请联系{' '}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>。另请参阅
              <Link href="/terms">服务条款</Link>。
            </p>
          ),
        },
      ]}
    />
  );
}
export function Terms() {
  return (
    <LegalPage
      eyebrow="TERMS"
      title="服务条款"
      description="使用 KeyFlash 前，请阅读以下条款。登录或使用本服务即表示你同意这些条款。"
      sections={[
        {
          title: '服务说明',
          body: (
            <p>
              KeyFlash 是一个 ESP32
              键盘固件社区，提供固件的发布、下载、在线烧录和兼容性交流。本服务按现状提供，我们会尽力保证可用，但不承诺服务不中断或没有错误。
            </p>
          ),
        },
        {
          title: '账号',
          body: (
            <p>
              你通过 GitHub 或 Google 账号登录，首次登录时自动创建 KeyFlash
              账号。你需要对自己账号下的所有行为负责。
            </p>
          ),
        },
        {
          title: '你发布的内容',
          body: (
            <ul>
              <li>你保留所发布项目和固件的权利，并按你声明的开源协议授权他人使用。</li>
              <li>你授予 KeyFlash 存储、展示和分发这些内容的权利，以便提供本服务。</li>
              <li>你需确保有权发布这些内容，且内容不侵犯他人的知识产权或其他权利。</li>
            </ul>
          ),
        },
        {
          title: '固件与烧录风险',
          body: (
            <p>
              固件由社区成员发布，KeyFlash 不对其内容、安全性或兼容性作出保证。烧录前请核对芯片、PCB
              和硬件版本。烧录错误的固件可能导致设备无法启动或损坏，相关风险由你自行承担。
            </p>
          ),
        },
        {
          title: '禁止的行为',
          body: (
            <ul>
              <li>发布恶意固件，或含有后门、窃取数据等有害功能的代码。</li>
              <li>发布侵权、违法、骚扰或垃圾内容。</li>
              <li>攻击、滥用或试图绕过本服务的安全限制。</li>
            </ul>
          ),
        },
        {
          title: '内容处理',
          body: <p>对违反本条款的内容，我们可以隐藏、删除，或限制相关账号的使用。</p>,
        },
        {
          title: '条款变更与联系',
          body: (
            <p>
              条款更新时，我们会修改本页顶部的日期。如有疑问，请联系{' '}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>。个人信息的处理方式见
              <Link href="/privacy">隐私政策</Link>。
            </p>
          ),
        },
      ]}
    />
  );
}
